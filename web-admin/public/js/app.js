import { isConfigured, logout, onSession } from './firebase.js';
import { subscribeRequests, watchNotifications } from './service.js';
import { brandBlock, html, icon, render, sidebarFooter, toast } from './ui.js';
import * as requestDetail from './views/request-detail.js';
import * as requests from './views/requests.js';
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
];

const NAV = [
  { key: 'requests', icon: 'list', href: '#/requests', label: 'Service requests' },
  { key: 'reports', icon: 'chart', href: '#/reports', label: 'Summary reports' },
  { key: 'staff', icon: 'users', href: '#/staff', label: 'Staff & departments' },
  { key: 'residents', icon: 'user', href: '#/residents', label: 'Residents' },
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
      <p class="muted small">See web-admin/README.md.</p></div></div>`
  );
}

function renderShell(profile) {
  render(
    app,
    html`
      <div class="shell">
        <aside class="sidebar">
          ${brandBlock('Admin portal')}
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
    return render(app, html`<div class="loading">Taking you to sign in…</div>`); // onSession() is redirecting
  }

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
  onSession((profile) => {
    user = profile;
    route();
  });
}
