import { watchAssignments } from '../service.js';
import { errorState, html, loading, render, shortId, statusBadge, timeAgo } from '../ui.js';

const TABS = [
  ['active', 'Active'],
  ['Assigned', 'To start'],
  ['In Progress', 'In progress'],
  ['Resolved', 'Resolved'],
  ['', 'All'],
];

export function mount(el, _params, user) {
  let tab = 'active';
  let all = null;
  let error = null;

  render(
    el,
    html`
      <div class="page-head">
        <div><h1>My assignments</h1><div class="muted">Reports assigned to you by the admin. New ones appear live.</div></div>
        <div class="filters" id="tabs" style="margin:0">
          ${TABS.map(([key, label]) => html`<button class="btn btn-sm ${key === tab && 'btn-primary'}" data-tab="${key}">${label}</button>`)}
        </div>
      </div>
      <div class="card" id="results">${loading()}</div>`
  );
  const results = el.querySelector('#results');
  const tabs = el.querySelector('#tabs');

  function draw() {
    if (error) return render(results, errorState(error));
    if (!all) return render(results, loading());
    const rows = all.filter((r) =>
      tab === 'active' ? r.status === 'Assigned' || r.status === 'In Progress' : !tab || r.status === tab
    );
    if (!rows.length) return render(results, html`<div class="empty">Nothing here right now.</div>`);
    render(
      results,
      html`<div class="table-wrap"><table>
        <thead><tr><th>Ref</th><th>Photo</th><th>Issue</th><th>Location</th><th>Status</th><th>Assigned</th></tr></thead>
        <tbody>${rows.map(
          (r) => html`<tr class="clickable" data-id="${r.id}">
            <td>${shortId(r.id)}</td>
            <td><img class="thumb" src="${r.thumb}" alt="" loading="lazy" /></td>
            <td><strong>${r.issue_type}</strong>
              <div class="small muted">${r.description.slice(0, 80)}${r.description.length > 80 ? '…' : ''}</div></td>
            <td>${r.address || `${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}`}</td>
            <td>${statusBadge(r.status)}</td>
            <td title="${r.assigned_at}">${timeAgo(r.assigned_at)}</td>
          </tr>`
        )}</tbody></table></div>`
    );
  }

  tabs.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tab]');
    if (!btn) return;
    tab = btn.dataset.tab;
    tabs.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('btn-primary', b === btn));
    draw();
  });
  results.addEventListener('click', (e) => {
    const row = e.target.closest('tr[data-id]');
    if (row) location.hash = `#/assignments/${row.dataset.id}`;
  });

  const stop = watchAssignments(user.id, (list, err) => {
    all = list;
    error = err || null;
    draw();
  });
  return { destroy: stop };
}
