import { markRead, watchMyNotifications } from '../service.js';
import { html, loading, render, timeAgo } from '../ui.js';

export function mount(el, _params, user) {
  render(
    el,
    html`<div class="page-head"><div><h1>Notifications</h1>
      <div class="muted">Sent when your report is rejected, In Progress or Resolved.</div></div></div>
      <div class="card" id="results">${loading()}</div>`
  );
  const results = el.querySelector('#results');

  const stop = watchMyNotifications(user.id, (list) => {
    if (!list.length) return render(results, html`<div class="empty">No notifications yet.</div>`);
    render(
      results,
      html`${list.map(
        (n) => html`<div style="padding:10px 0;border-bottom:1px solid var(--border)">
          <a href="#/reports/${n.request_id}" data-read="${n.id}"><strong>${n.title}</strong></a>
          ${!n.is_read && html`<span class="badge badge-pending">new</span>`}
          <div>${n.message}</div><div class="small muted">${timeAgo(n.created_at)}</div></div>`
      )}`
    );
  });

  results.addEventListener('click', (e) => {
    const link = e.target.closest('[data-read]');
    if (link) markRead(link.dataset.read).catch(() => {});
  });
  return { destroy: stop };
}
