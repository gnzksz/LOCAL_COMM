// Notification bell in the top bar: an unread badge and a dropdown with the latest notifications.
// It shows the same live list as the sidebar badge and the Notifications page (see service.js).
import { markAllNotificationsRead, markNotificationRead, unreadCount } from './service.js';
import { html, icon, render, timeAgo } from './ui.js';

const LATEST = 6;

/** Adds the bell to `container` (the top bar's button area). Returns { update(list), destroy() }. */
export function createBell(container) {
  const wrap = document.createElement('div');
  wrap.className = 'bell';
  container.prepend(wrap);
  render(
    wrap,
    html`<button type="button" class="icon-btn" id="bell-btn" aria-haspopup="true" aria-expanded="false" aria-controls="bell-panel" aria-label="Notifications">
        ${icon('bell')}<span class="bell-badge" hidden></span>
      </button>
      <div class="bell-panel" id="bell-panel" hidden></div>`
  );
  const button = wrap.querySelector('#bell-btn');
  const badge = wrap.querySelector('.bell-badge');
  const panel = wrap.querySelector('#bell-panel');
  let list = [];

  function drawPanel() {
    const unread = unreadCount(list);
    render(
      panel,
      html`<div class="bell-head"><strong>Notifications</strong>
          <button type="button" class="link-btn" id="bell-all" ${unread === 0 && 'disabled'}>Mark all as read</button></div>
        ${list.length
          ? html`<div class="bell-list">${list.slice(0, LATEST).map(
              (n) => html`<a class="notif ${n.is_read ? 'read' : 'unread'}" href="#/reports/${n.request_id}" data-id="${n.id}">
                <span class="dot" aria-hidden="true"></span>
                <span class="notif-body"><span class="notif-title">${n.title}</span>
                  <span class="notif-text">${n.message}</span>
                  <span class="small muted">${timeAgo(n.created_at)}</span></span></a>`
            )}</div>`
          : html`<div class="bell-empty">${icon('bell')}<div>You are all caught up.</div></div>`}
        <a class="bell-foot" href="#/notifications">See all notifications</a>`
    );
  }

  function update(next) {
    list = next;
    const unread = unreadCount(list);
    badge.textContent = unread > 99 ? '99+' : unread;
    badge.hidden = unread === 0;
    button.setAttribute('aria-label', unread ? `Notifications, ${unread} unread` : 'Notifications');
    if (!panel.hidden) drawPanel();
  }

  function setOpen(open) {
    panel.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (open) drawPanel();
  }

  button.addEventListener('click', () => setOpen(panel.hidden));
  panel.addEventListener('click', (e) => {
    if (e.target.closest('#bell-all')) return markAllNotificationsRead(list).catch(() => {});
    const row = e.target.closest('.notif.unread');
    if (row) markNotificationRead(row.dataset.id).catch(() => {});
    if (e.target.closest('a')) setOpen(false);
  });

  const onDocClick = (e) => !wrap.contains(e.target) && setOpen(false);
  const onKey = (e) => {
    if (e.key === 'Escape' && !panel.hidden) {
      setOpen(false);
      button.focus();
    }
  };
  const onRoute = () => setOpen(false);
  document.addEventListener('click', onDocClick);
  document.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', onRoute);

  return {
    update,
    destroy() {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('hashchange', onRoute);
      wrap.remove();
    },
  };
}
