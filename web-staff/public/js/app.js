import { IDLE_SECONDS } from './config.js';
import { isConfigured, logout, onSession, stashNotice } from './firebase.js';
import { watchAssignments, watchNotifications } from './service.js';
import { brandBlock, html, icon, render, sidebarFooter, skipLink, startIdleLogout, toast, topbar, wireShell } from './ui.js';
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

function renderShell(profile) {
  render(
    app,
    html`
      ${skipLink}
      <div class="shell">
        <aside class="sidebar" aria-label="Main menu">
          ${brandBlock('Staff portal')}
          <div class="nav-label">Menu</div>
          <a class="nav-link" data-nav="assignments" href="#/assignments" title="My assignments">${icon('clipboard')}<span>My assignments</span>
            <span class="count-pill" id="active-count" hidden></span></a>
          <a class="nav-link" data-nav="profile" href="#/profile" title="My profile">${icon('user')}<span>My profile</span></a>
          ${sidebarFooter(profile)}
        </aside>
        <div class="column">
          ${topbar()}
          <main class="main" id="main" tabindex="-1"></main>
        </div>
      </div>`
  );
  document.getElementById('logout').onclick = logout;
  wireShell();
  shellFor = profile.id;
}

// Background subscriptions that live as long as the staff member is signed in.
function startSession(profile) {
  // Signed out after a while without activity; a warning dialog counts down the last minute.
  stopSession.push(
    startIdleLogout({
      seconds: IDLE_SECONDS,
      onTimeout: () => {
        stashNotice('You were signed out because you were inactive for a while.');
        logout();
      },
    })
  );
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
    return render(app, html`<div class="loading">Taking you to sign in…</div>`); // onSession() is redirecting
  }

  if (shellFor !== user.id || !document.getElementById('main')) {
    renderShell(user);
    endSession();
    startSession(user);
  }

  const match = ROUTES.map((r) => ({ r, m: hash.match(r.pattern) })).find((x) => x.m);
  if (!match) return (location.hash = '#/assignments');

  document.querySelectorAll('[data-nav]').forEach((a) => {
    const on = a.dataset.nav === match.r.nav;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
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
