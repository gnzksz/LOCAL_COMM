import { watchMyRequests } from '../service.js';
import { errorState, html, loading, render, shortId, stars, statCards, statusBadge, timeAgo } from '../ui.js';

export function mount(el, _params, user) {
  render(
    el,
    html`
      <div class="page-head">
        <div><h1>My reports</h1><div class="muted">Status updates appear here live.</div></div>
        <a class="btn btn-primary" href="#/new">New report</a>
      </div>
      <div id="stats"></div>
      <div class="card" id="results">${loading()}</div>`
  );
  const results = el.querySelector('#results');

  const stop = watchMyRequests(user.id, (list, err) => {
    const n = (...s) => list.filter((r) => s.includes(r.status)).length;
    render(el.querySelector('#stats'), statCards([
      { label: 'My reports', value: list.length, tone: 'blue', icon: 'clipboard' },
      { label: 'Pending', value: n('Pending'), tone: 'amber', icon: 'clock' },
      { label: 'Being fixed', value: n('Assigned', 'In Progress'), tone: 'violet', icon: 'tool' },
      { label: 'Resolved', value: n('Resolved', 'Archived'), tone: 'green', icon: 'check' },
    ]));
    if (err) return render(results, errorState(err));
    if (!list.length) return render(results, html`<div class="empty">You have not sent any reports yet.</div>`);
    render(
      results,
      html`<div class="table-wrap"><table>
        <thead><tr><th>Ref</th><th>Photo</th><th>Issue</th><th>Status</th><th>Rating</th><th>Sent</th></tr></thead>
        <tbody>${list.map(
          (r) => html`<tr class="clickable" data-id="${r.id}">
            <td>${shortId(r.id)}</td>
            <td><img class="thumb" src="${r.thumb}" alt="" /></td>
            <td class="wrap"><strong>${r.issue_type}</strong>
              <div class="small muted">${r.description.slice(0, 80)}${r.description.length > 80 ? '…' : ''}</div></td>
            <td>${statusBadge(r.status)}</td>
            <td>${stars(r.rating)}</td>
            <td title="${r.created_at}">${timeAgo(r.created_at)}</td>
          </tr>`
        )}</tbody></table></div>`
    );
  });

  results.addEventListener('click', (e) => {
    const row = e.target.closest('tr[data-id]');
    if (row) location.hash = `#/reports/${row.dataset.id}`;
  });
  return { destroy: stop };
}
