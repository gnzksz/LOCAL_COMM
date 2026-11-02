import { markAllNotificationsRead, markNotificationRead, subscribeNotifications, unreadCount } from '../service.js';
import { emptyState, html, icon, loading, render, timeAgo } from '../ui.js';

// How long a notification stays marked "new" while the page is open, so the resident can notice it.
const SEEN_AFTER_MS = 1500;

export function mount(el, _params, user) {
  render(
    el,
    html`
      <div class="page-head">
        <div><h1>Notifications</h1>
          <div class="muted">Sent when your report is rejected, In Progress or Resolved.</div></div>
        <button class="btn" id="mark-all" disabled>${icon('check')}<span>Mark all as read</span></button>
      </div>
      <div class="card" id="results">${loading()}</div>`
  );
  const results = el.querySelector('#results');
  const markAll = el.querySelector('#mark-all');
  let current = [];
  let timer = null;

  const stop = subscribeNotifications(user.id, (list) => {
    current = list;
    const unread = unreadCount(list);
    markAll.disabled = unread === 0;

    if (!list.length) {
      render(results, emptyState({
        icon: 'bell',
        title: 'No notifications yet',
        text: 'You will be told here when a report is rejected, being fixed or resolved.',
        action: { label: 'See my reports', href: '#/reports' },
      }));
    } else {
      render(
        results,
        html`${list.map(
          (n) => html`<a class="notif ${n.is_read ? 'read' : 'unread'}" href="#/reports/${n.request_id}" data-id="${n.id}">
            <span class="dot" aria-hidden="true"></span>
            <span class="notif-body">
              <span class="notif-title">${n.title}${!n.is_read && html` <span class="badge badge-pending">new</span>`}</span>
              <span class="notif-text">${n.message}</span>
              <span class="small muted">${timeAgo(n.created_at)}</span>
            </span>
          </a>`
        )}`
      );
    }

    // Everything shown on this page counts as seen shortly after it appears (also for ones that arrive meanwhile).
    clearTimeout(timer);
    if (unread) timer = setTimeout(() => markAllNotificationsRead(current).catch(() => {}), SEEN_AFTER_MS);
  });

  markAll.addEventListener('click', () => {
    clearTimeout(timer);
    markAllNotificationsRead(current).catch(() => {});
  });
  // Opening one notification marks it as read right away.
  results.addEventListener('click', (e) => {
    const row = e.target.closest('.notif.unread');
    if (row) markNotificationRead(row.dataset.id).catch(() => {});
  });

  return { destroy: () => { clearTimeout(timer); stop(); } };
}
