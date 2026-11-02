import { watchMyRequests } from '../service.js';
import { emptyState, errorState, html, loading, render, shortId, skeletonStats, stars, statCards, statusBadge, timeAgo } from '../ui.js';

export function mount(el, _params, user) {
  render(
    el,
    html`
      <div class="page-head">
        <div><h1>My reports</h1><div class="muted">Status updates appear here live.</div></div>
        <a class="btn btn-cta" href="#/new">New report</a>
      </div>
      <div id="stats">${skeletonStats()}</div>
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
    if (!list.length) {
      return render(results, emptyState({
        icon: 'clipboard',
        title: 'No reports yet',
        text: 'See a broken road, a clogged drain or a fallen light? Send a report with a photo and the barangay will take it from there.',
        action: { label: 'Create your first report', href: '#/new', cta: true },
      }));
    }
    render(
      results,
      html`<div class="table-wrap only-wide"><table>
        <thead><tr><th>Ref</th><th>Photo</th><th>Issue</th><th>Status</th><th>Rating</th><th>Sent</th></tr></thead>
        <tbody>${list.map(
          (r) => html`<tr class="clickable" data-id="${r.id}">
            <td>${shortId(r.id)}</td>
            <td><img class="thumb" data-zoom src="${r.thumb}" alt="Photo of ${r.issue_type} report ${shortId(r.id)}" /></td>
            <td class="wrap"><strong>${r.issue_type}</strong>
              <div class="small muted">${r.description.slice(0, 80)}${r.description.length > 80 ? '…' : ''}</div></td>
            <td>${statusBadge(r.status)}</td>
            <td>${stars(r.rating)}</td>
            <td title="${r.created_at}">${timeAgo(r.created_at)}</td>
          </tr>`
        )}</tbody></table></div>
        <div class="rcards only-narrow">${list.map(
          (r) => html`<a class="rcard" href="#/reports/${r.id}">
            <img src="${r.thumb}" alt="" loading="lazy" />
            <span class="rcard-body">
              <span class="rcard-top"><strong>${r.issue_type}</strong>${statusBadge(r.status)}</span>
              <span class="rcard-desc">${r.description}</span>
              <span class="rcard-foot"><span>#${shortId(r.id)} · ${timeAgo(r.created_at)}</span>${stars(r.rating)}</span>
            </span></a>`
        )}</div>`
    );
  });

  results.addEventListener('click', (e) => {
    const row = e.target.closest('tr[data-id]');
    if (row) location.hash = `#/reports/${row.dataset.id}`;
  });
  return { destroy: stop };
}
