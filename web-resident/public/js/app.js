import { IDLE_SECONDS } from './config.js';
import { isConfigured, logout, onSession, stashNotice } from './firebase.js';
import { subscribeNotifications, unreadCount } from './service.js';
import { createBell } from './bell.js';
import { brandBlock, html, icon, render, sidebarFooter, skipLink, startIdleLogout, toast, topbar, wireShell } from './ui.js';
import * as newReport from './views/new-report.js';
import * as notifications from './views/notifications.js';
import * as reportDetail from './views/report-detail.js';
import * as profile from './views/profile.js';
import * as reports from './views/reports.js';
import { openVerifyModal } from './views/verify.js';

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
let askedToVerify = false;

function renderShell(profile) {
  render(
    app,
    html`
      ${skipLink}
      <div class="shell">
        <aside class="sidebar" aria-label="Main menu">
          ${brandBlock('Resident portal')}
          <div class="nav-label">Menu</div>
          ${NAV.map(
            (n) => html`<a class="nav-link" data-nav="${n.key}" href="${n.href}" title="${n.label}">${icon(n.icon)}<span>${n.label}</span>
              ${n.key === 'notifications' && html`<span class="count-pill" id="unread-count" hidden></span>`}</a>`
          )}
          ${sidebarFooter(profile)}
        </aside>
        <div class="column">
          ${topbar()}
          <div class="verify-banner" id="verify-banner" role="status" hidden>
            ${icon('mail')}<span>Verify your email to send reports.</span><button type="button" class="link-btn" id="verify-open">Verify now</button>
          </div>
          <main class="main" id="main" tabindex="-1"></main>
        </div>
      </div>`
  );
  document.getElementById('logout').onclick = logout;
  wireShell();
  shellFor = profile.id;
}

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
  // The badge shows only the UNREAD notifications and disappears at 0; it follows the database live.
  const bell = createBell(document.getElementById('topbar-actions'), profile);
  stopSession.push(
    bell.destroy,
    subscribeNotifications(profile.id, (list, added) => {
      bell.update(list);
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
  let hash = location.hash;

  if (!user) {
    endSession();
    return render(app, html`<div class="loading">Taking you to sign in…</div>`); // onSession() is redirecting
  }

  if (shellFor !== user.id || !document.getElementById('main')) {
    renderShell(user);
    endSession();
    startSession(user);
  }

  hash ||= '#/reports';
  const match = ROUTES.map((r) => ({ r, m: hash.match(r.pattern) })).find((x) => x.m);
  if (!match) return (location.hash = '#/reports');
  // Nobody can send a report before confirming their email: the "Verify your email" modal opens instead of the form.
  if (!user.emailVerified && match.r.nav === 'new') {
    location.hash = '#/reports';
    return openVerifyModal(user);
  }
  const banner = document.getElementById('verify-banner');
  banner.hidden = user.emailVerified;
  banner.querySelector('#verify-open').onclick = () => openVerifyModal(user);
  // A new account sees the modal once, right after signing in (it can be closed with "Later").
  if (!user.emailVerified && !askedToVerify) {
    askedToVerify = true;
    openVerifyModal(user);
  }

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
// The verify screen tells the app when the email was confirmed.
window.addEventListener('lcs:verified', () => {
  if (user) user.emailVerified = true;
  const banner = document.getElementById('verify-banner');
  if (banner) banner.hidden = true;
});

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
