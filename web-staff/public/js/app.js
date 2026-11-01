import { isConfigured, login, logout, onSession } from './firebase.js';
import { watchAssignments, watchNotifications } from './service.js';
import { authScreen, brandBlock, html, icon, loginForm, render, sidebarFooter, toast, wireLoginForm } from './ui.js';
import * as assignmentDetail from './views/assignment-detail.js';
import * as assignments from './views/assignments.js';
import * as profile from './views/profile.js';

const app = document.getElementById('app');

// Each view exports mount(el, params) and returns { destroy?() }. Views are live (Firestore snapshots).
const ROUTES = [
  { pattern: /^#\/assignments$/, view: assignments, nav: 'assignments' },
  { pattern: /^#\/assignments\/([\w-]+)$/, view: assignmentDetail, nav: 'assignments' },
  { pattern: /^#\/profile$/, view: profile, nav: 'profile' },
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
      <p class="muted small">See web-staff/README.md.</p></div></div>`
  );
}

function renderLogin() {
  teardown();
  shellFor = null;
  render(
    app,
    authScreen({
      theme: 'staff',
      headline: 'Your assigned reports, one tap from done.',
      blurb: 'See what was assigned to you, where it is, and keep residents updated as you work.',
      points: [
        ['clipboard', 'Every assignment with photo and description'],
        ['pin', 'Exact location of each report'],
        ['bell', 'Residents are notified as you update progress'],
      ],
      form: loginForm({
        title: 'Welcome back',
        subtitle: 'Sign in to the staff portal',
        notice,
        footer: html`<p class="login-help">Your account is created by the admin. Forgot it? Ask the admin.</p>`,
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
          ${brandBlock('Staff portal')}
          <div class="nav-label">Menu</div>
          <a class="nav-link" data-nav="assignments" href="#/assignments">${icon('clipboard')}<span>My assignments</span>
            <span class="count-pill" id="active-count" hidden></span></a>
          <a class="nav-link" data-nav="profile" href="#/profile">${icon('user')}<span>My profile</span></a>
          ${sidebarFooter(profile)}
        </aside>
        <main class="main" id="main"></main>
      </div>`
  );
  document.getElementById('logout').onclick = logout;
  shellFor = profile.id;
}

// Background subscriptions that live as long as the staff member is signed in.
function startSession(profile) {
  stopSession.push(
    watchAssignments(profile.id, (list) => {
      const pill = document.getElementById('active-count');
      if (!pill) return;
      const active = list.filter((r) => r.status === 'Assigned' || r.status === 'In Progress').length;
      pill.textContent = active;
      pill.hidden = active === 0;
    }),
    // A new assignment arrives as a notification from the Cloud Function.
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
  const hash = location.hash || '#/assignments';

  if (!user) {
    endSession();
    if (hash !== '#/login') return (location.hash = '#/login');
    return renderLogin();
  }
  if (hash === '#/login') return (location.hash = '#/assignments');

  if (shellFor !== user.id || !document.getElementById('main')) {
    renderShell(user);
    endSession();
    startSession(user);
  }

  const match = ROUTES.map((r) => ({ r, m: hash.match(r.pattern) })).find((x) => x.m);
  if (!match) return (location.hash = '#/assignments');

  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === match.r.nav));
  teardown();
  const main = document.getElementById('main');
  main.innerHTML = '';
  current = (await match.r.view.mount(main, match.m.slice(1), user)) || null;
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
