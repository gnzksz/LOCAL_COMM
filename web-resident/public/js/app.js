import { isConfigured, logout, onSession } from './firebase.js';
import { subscribeNotifications, unreadCount } from './service.js';
import { brandBlock, html, icon, render, sidebarFooter, toast } from './ui.js';
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

let user = undefined; // undefined = still checking, null = signed out
let current = null;
let shellFor = null;
let stopSession = [];

function renderShell(profile) {
  render(
    app,
    html`
      <div class="shell">
        <aside class="sidebar">
          ${brandBlock('Resident portal')}
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
  // The badge shows only the UNREAD notifications and disappears at 0; it follows the database live.
  stopSession.push(
    subscribeNotifications(profile.id, (list, added) => {
      const pill = document.getElementById('unread-count');
      if (pill) {
        const unread = unreadCount(list);
        pill.textContent = unread > 99 ? '99+' : unread;
        pill.hidden = unread === 0;
      }
      // Toast for notifications that arrive while the page is open.
      added.filter((n) => !n.is_read).forEach((n) => toast(n.title, 'success'));
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
    return render(app, html`<div class="loading">Taking you to sign in…</div>`); // onSession() is redirecting
  }

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
