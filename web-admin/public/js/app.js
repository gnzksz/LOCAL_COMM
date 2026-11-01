import { isConfigured, login, logout, onSession } from './firebase.js';
import { subscribeRequests, watchNotifications } from './service.js';
import { authScreen, brandBlock, html, icon, loginForm, render, sidebarFooter, toast, wireLoginForm } from './ui.js';
import * as requestDetail from './views/request-detail.js';
import * as requests from './views/requests.js';
import * as profile from './views/profile.js';
import * as reports from './views/reports.js';
import * as residents from './views/residents.js';
import * as staff from './views/staff.js';

const app = document.getElementById('app');

// Each view exports mount(el, params) and returns { destroy?() }. Views are live (Firestore
// snapshots), so they update themselves; there is no manual refresh.
const ROUTES = [
  { pattern: /^#\/requests$/, view: requests, nav: 'requests' },
  { pattern: /^#\/requests\/([\w-]+)$/, view: requestDetail, nav: 'requests' },
  { pattern: /^#\/reports$/, view: reports, nav: 'reports' },
  { pattern: /^#\/staff$/, view: staff, nav: 'staff' },
  { pattern: /^#\/residents$/, view: residents, nav: 'residents' },
  { pattern: /^#\/profile$/, view: profile, nav: 'profile' },
];

const NAV = [
  { key: 'requests', icon: 'list', href: '#/requests', label: 'Service requests' },
  { key: 'reports', icon: 'chart', href: '#/reports', label: 'Summary reports' },
  { key: 'staff', icon: 'users', href: '#/staff', label: 'Staff & departments' },
  { key: 'residents', icon: 'user', href: '#/residents', label: 'Residents' },
  { key: 'profile', icon: 'shield', href: '#/profile', label: 'My profile' },
];

let notice = ''; // why the last sign-in was refused (shown on the login page)
let user = undefined; // undefined = still checking, null = signed out
let current = null;
let shellFor = null;
let stopSession = [];

function renderSetupNotice() {
  render(
    app,
    html`<div class="login-wrap"><div class="card login-card">
      <h1>Firebase is not set up yet</h1>
      <p>Paste your Firebase web app config into <code>public/js/config.js</code>, or open this page with
        <code>?emulator</code> to use the local emulators.</p>
      <p class="muted small">See web-admin/README.md.</p></div></div>`
  );
}

function renderLogin() {
  teardown();
  shellFor = null;
  render(
    app,
    authScreen({
      theme: 'admin',
      headline: 'Manage every community report in one place.',
      blurb: 'Review new reports, assign them to field personnel and follow each one until it is resolved.',
      points: [
        ['clipboard', 'Review and categorize reports as they arrive'],
        ['users', 'Assign the right staff and department'],
        ['chart', 'See summary reports and resident feedback'],
      ],
      form: loginForm({
        title: 'Welcome back',
        subtitle: 'Sign in to the admin dashboard',
        notice,
        footer: html`<p class="login-help">Need access? Ask the system administrator.</p>`,
      }),
    })
  );
  const form = document.getElementById('login');
  const ui = wireLoginForm(form);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    notice = '';
    ui.showError('');
    ui.busy('Signing in…');
    try {
      await login(form.email.value.trim(), form.password.value);
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
          ${brandBlock('Admin dashboard')}
          <div class="nav-label">Menu</div>
          ${NAV.map(
            (n) => html`<a class="nav-link" data-nav="${n.key}" href="${n.href}">${icon(n.icon)}<span>${n.label}</span>
              ${n.key === 'requests' && html`<span class="count-pill" id="pending-count" hidden></span>`}</a>`
          )}
          ${sidebarFooter(profile)}
        </aside>
        <main class="main" id="main"></main>
      </div>`
  );
  document.getElementById('logout').onclick = logout;
  shellFor = profile.id;
}

// Background subscriptions that live as long as the admin is signed in.
function startSession(profile) {
  // id -> rating, filled by the first snapshot so only later changes raise a toast.
  let known = null;
  stopSession.push(
    subscribeRequests((list) => {
      const pill = document.getElementById('pending-count');
      if (pill) {
        const pending = list.filter((r) => r.status === 'Pending').length;
        pill.textContent = pending;
        pill.hidden = pending === 0;
      }
      if (known) {
        for (const r of list) {
          if (!known.has(r.id)) toast(`New report: ${r.issue_type} from ${r.resident_name}`, 'success');
          else if (r.rating != null && known.get(r.id) == null) toast(`Report rated ${r.rating}/5 by ${r.resident_name}`);
        }
      }
      known = new Map(list.map((r) => [r.id, r.rating ?? null]));
    }),
    watchNotifications(profile.id, (n) => toast(`${n.title}: ${n.message}`, 'success'))
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
  const hash = location.hash || '#/requests';

  if (!user) {
    endSession();
    if (hash !== '#/login') return (location.hash = '#/login');
    return renderLogin();
  }
  if (hash === '#/login') return (location.hash = '#/requests');

  if (shellFor !== user.id || !document.getElementById('main')) {
    renderShell(user);
    endSession();
    startSession(user);
  }

  const match = ROUTES.map((r) => ({ r, m: hash.match(r.pattern) })).find((x) => x.m);
  if (!match) return (location.hash = '#/requests');

  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === match.r.nav));
  teardown();
  const main = document.getElementById('main');
  main.innerHTML = '';
  current = (await match.r.view.mount(main, match.m.slice(1))) || null;
}

window.addEventListener('hashchange', route);

if (!isConfigured) {
  renderSetupNotice();
} else {
  route();
  onSession((profile, problem) => {
    user = profile;
    if (problem) notice = problem;
    route();
  });
}
