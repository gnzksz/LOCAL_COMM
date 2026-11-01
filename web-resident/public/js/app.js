import { isConfigured, login, logout, onSession } from './firebase.js';
import { register, watchMyNotifications } from './service.js';
import { html, render, toast } from './ui.js';
import * as newReport from './views/new-report.js';
import * as notifications from './views/notifications.js';
import * as reportDetail from './views/report-detail.js';
import * as reports from './views/reports.js';

const app = document.getElementById('app');

const ROUTES = [
  { pattern: /^#\/reports$/, view: reports, nav: 'reports' },
  { pattern: /^#\/new$/, view: newReport, nav: 'new' },
  { pattern: /^#\/reports\/([\w-]+)$/, view: reportDetail, nav: 'reports' },
  { pattern: /^#\/notifications$/, view: notifications, nav: 'notifications' },
];

const NAV = [
  { key: 'reports', href: '#/reports', label: 'My reports' },
  { key: 'new', href: '#/new', label: 'New report' },
  { key: 'notifications', href: '#/notifications', label: 'Notifications' },
];

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
    html`
      <div class="login-wrap">
        <form class="card login-card" id="login">
          <h1>LOCAL_COMM</h1>
          <p class="muted">Resident test page (stands in for the mobile app)</p>
          ${signingUp && html`<div class="field"><label>Full name</label><input name="name" required /></div>`}
          <div class="field"><label for="id">Email</label><input id="id" name="email" type="email" required autofocus /></div>
          <div class="field"><label for="pw">Password</label><input id="pw" name="password" type="password" minlength="6" required /></div>
          <p class="form-error" hidden></p>
          <button class="btn btn-primary" type="submit">${signingUp ? 'Create account' : 'Sign in'}</button>
          <p class="small" style="text-align:center"><a href="#/login" id="toggle">
            ${signingUp ? 'Already have an account? Sign in' : 'No account yet? Register'}</a></p>
        </form>
      </div>`
  );
  const form = document.getElementById('login');
  const error = form.querySelector('.form-error');
  document.getElementById('toggle').onclick = (e) => {
    e.preventDefault();
    mode = signingUp ? 'login' : 'register';
    renderLogin();
  };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.hidden = true;
    const button = form.querySelector('button');
    button.disabled = true;
    try {
      if (signingUp) await register({ name: form.name.value, email: form.email.value, password: form.password.value });
      else await login(form.email.value.trim(), form.password.value);
      // onSession() takes over from here.
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
      button.disabled = false;
    }
  });
}

function renderShell(profile) {
  render(
    app,
    html`
      <div class="shell">
        <aside class="sidebar">
          <div class="brand">LOCAL_COMM<small>Resident (test page)</small></div>
          ${NAV.map(
            (n) => html`<a class="nav-link" data-nav="${n.key}" href="${n.href}"><span>${n.label}</span>
              ${n.key === 'notifications' && html`<span class="count-pill" id="unread-count" hidden></span>`}</a>`
          )}
          <div class="sidebar-footer">
            <div class="muted">${profile.name}</div>
            <button class="btn btn-sm" id="logout">Sign out</button>
          </div>
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
  onSession((profile) => {
    user = profile;
    route();
  });
}
