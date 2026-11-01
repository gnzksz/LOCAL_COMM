import { isConfigured, login, logout, onSession } from './firebase.js';
import { register, watchMyNotifications } from './service.js';
import { authScreen, brandBlock, html, icon, loginForm, render, sidebarFooter, toast, wireLoginForm } from './ui.js';
import * as newReport from './views/new-report.js';
import * as notifications from './views/notifications.js';
import * as reportDetail from './views/report-detail.js';
import * as profile from './views/profile.js';
import * as reports from './views/reports.js';

const app = document.getElementById('app');

const ROUTES = [
  { pattern: /^#\/reports$/, view: reports, nav: 'reports' },
  { pattern: /^#\/new$/, view: newReport, nav: 'new' },
  { pattern: /^#\/reports\/([\w-]+)$/, view: reportDetail, nav: 'reports' },
  { pattern: /^#\/notifications$/, view: notifications, nav: 'notifications' },
  { pattern: /^#\/profile$/, view: profile, nav: 'profile' },
];

const NAV = [
  { key: 'reports', icon: 'list', href: '#/reports', label: 'My reports' },
  { key: 'new', icon: 'plus', href: '#/new', label: 'New report' },
  { key: 'notifications', icon: 'bell', href: '#/notifications', label: 'Notifications' },
  { key: 'profile', icon: 'user', href: '#/profile', label: 'My profile' },
];

let notice = ''; // why the last sign-in was refused (shown on the login page)
let user = undefined; // undefined = still checking, null = signed out
let current = null;
let shellFor = null;
let stopSession = [];
let mode = 'login';

function renderLogin() {
  teardown();
  shellFor = null;
  const signingUp = mode === 'register';
  render(
    app,
    authScreen({
      theme: 'resident',
      headline: 'See a problem in your community? Report it.',
      blurb: 'Send a photo and location, then follow your report until it is resolved. (Test page that stands in for the mobile app.)',
      points: [
        ['pin', 'Attach a photo and your location'],
        ['clock', 'Track the status of every report'],
        ['bell', 'Get notified when it is being fixed'],
      ],
      form: loginForm({
        title: signingUp ? 'Create your account' : 'Welcome back',
        subtitle: signingUp ? 'Register as a resident' : 'Sign in as a resident',
        submitLabel: signingUp ? 'Create account' : 'Sign in',
        notice,
        fields: signingUp ? html`<div class="field"><label>Full name</label>
          <div class="input-wrap">${icon('users')}<input name="name" placeholder="Juan Dela Cruz" required /></div></div>` : '',
        footer: html`<p class="login-help"><a href="#/login" id="toggle">
          ${signingUp ? 'Already have an account? Sign in' : 'No account yet? Register'}</a></p>`,
      }),
    })
  );
  const form = document.getElementById('login');
  const ui = wireLoginForm(form);
  document.getElementById('toggle').onclick = (e) => {
    e.preventDefault();
    notice = '';
    mode = signingUp ? 'login' : 'register';
    renderLogin();
  };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    notice = '';
    ui.showError('');
    ui.busy(signingUp ? 'Creating account…' : 'Signing in…');
    try {
      if (signingUp) await register({ name: form.name.value, email: form.email.value, password: form.password.value });
      else await login(form.email.value.trim(), form.password.value);
      // onSession() takes over from here (and explains why if this account cannot use the portal).
    } catch (err) {
      ui.showError(err.message);
      ui.idle();
    }
  });
}

function renderShell(profile) {
  render(
    app,
    html`
      <div class="shell">
        <aside class="sidebar">
          ${brandBlock('Resident (test page)')}
          <div class="nav-label">Menu</div>
          ${NAV.map(
            (n) => html`<a class="nav-link" data-nav="${n.key}" href="${n.href}">${icon(n.icon)}<span>${n.label}</span>
              ${n.key === 'notifications' && html`<span class="count-pill" id="unread-count" hidden></span>`}</a>`
          )}
          ${sidebarFooter(profile)}
        </aside>
        <main class="main" id="main"></main>
      </div>`
  );
  document.getElementById('logout').onclick = logout;
  shellFor = profile.id;
}

function startSession(profile) {
  stopSession.push(
    watchMyNotifications(profile.id, (list) => {
      const pill = document.getElementById('unread-count');
      if (!pill) return;
      const unread = list.filter((n) => !n.is_read).length;
      pill.textContent = unread;
      pill.hidden = unread === 0;
    })
  );
  // Toast for notifications that arrive while the page is open.
  let first = true;
  stopSession.push(
    watchMyNotifications(profile.id, (list) => {
      if (!first) list.filter((n) => !n.is_read).slice(0, 1).forEach((n) => toast(`${n.title}`, 'success'));
      first = false;
    })
  );
}

function endSession() {
  stopSession.forEach((stop) => stop());
  stopSession = [];
}

function teardown() {
  current?.destroy?.();
  current = null;
}

async function route() {
  if (user === undefined) return render(app, html`<div class="loading">Loading…</div>`);
  const hash = location.hash || '#/reports';

  if (!user) {
    endSession();
    if (hash !== '#/login') return (location.hash = '#/login');
    return renderLogin();
  }
  if (hash === '#/login') return (location.hash = '#/reports');

  if (shellFor !== user.id || !document.getElementById('main')) {
    renderShell(user);
    endSession();
    startSession(user);
  }

  const match = ROUTES.map((r) => ({ r, m: hash.match(r.pattern) })).find((x) => x.m);
  if (!match) return (location.hash = '#/reports');

  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === match.r.nav));
  teardown();
  const main = document.getElementById('main');
  main.innerHTML = '';
  current = (await match.r.view.mount(main, match.m.slice(1), user)) || null;
}

window.addEventListener('hashchange', route);

if (!isConfigured) {
  render(app, html`<div class="login-wrap"><div class="card login-card"><h1>Firebase is not set up yet</h1>
    <p>Paste your Firebase web config into <code>public/js/config.js</code>.</p></div></div>`);
} else {
  route();
  onSession((profile, problem) => {
    user = profile;
    if (problem) notice = problem;
    route();
  });
}
