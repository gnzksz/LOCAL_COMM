import { isConfigured, login, logout, onSession } from './firebase.js';
import { watchAssignments, watchNotifications } from './service.js';
import { html, render, toast } from './ui.js';
import * as assignmentDetail from './views/assignment-detail.js';
import * as assignments from './views/assignments.js';

const app = document.getElementById('app');

// Each view exports mount(el, params) and returns { destroy?() }. Views are live (Firestore snapshots).
const ROUTES = [
  { pattern: /^#\/assignments$/, view: assignments },
  { pattern: /^#\/assignments\/([\w-]+)$/, view: assignmentDetail },
];

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
    html`
      <div class="login-wrap">
        <form class="card login-card" id="login">
          <h1>LOCAL_COMM</h1>
          <p class="muted">Staff / field personnel sign in</p>
          <div class="field"><label for="id">Email</label><input id="id" name="email" type="email" required autofocus /></div>
          <div class="field"><label for="pw">Password</label><input id="pw" name="password" type="password" required /></div>
          <p class="form-error" hidden></p>
          <button class="btn btn-primary" type="submit">Sign in</button>
        </form>
      </div>`
  );
  const form = document.getElementById('login');
  const error = form.querySelector('.form-error');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.hidden = true;
    const button = form.querySelector('button');
    button.disabled = true;
    try {
      await login(form.email.value.trim(), form.password.value);
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
          <div class="brand">LOCAL_COMM<small>Staff portal</small></div>
          <a class="nav-link active" href="#/assignments"><span>My assignments</span>
            <span class="count-pill" id="active-count" hidden></span></a>
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
  onSession((profile) => {
    user = profile;
    route();
  });
}
