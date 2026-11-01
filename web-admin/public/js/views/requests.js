import { ISSUE_TYPES, STATUSES } from '../config.js';
import { filterRequests, subscribeRequests } from '../service.js';
import { errorState, html, loading, render, shortId, stars, statCards, statusBadge, timeAgo } from '../ui.js';

const PAGE_SIZE = 20;
const SORTS = [
  ['newest', 'Newest first'],
  ['oldest', 'Oldest first'],
  ['updated', 'Recently updated'],
  ['status', 'Status'],
  ['issue_type', 'Issue type'],
];

const options = (items) =>
  items.map((v) => {
    const [value, label] = Array.isArray(v) ? v : [v, v];
    return html`<option value="${value}">${label}</option>`;
  });

export function mount(el) {
  const state = { status: '', issue_type: '', category: '', q: '', from: '', to: '', sort: 'newest' };
  let offset = 0;
  let all = [];
  let error = null;
  let ready = false;
  const seen = new Set();
  let flash = new Set();

  render(
    el,
    html`
      <div class="page-head">
        <div><h1>Service requests</h1><div class="muted">Review, categorize and assign resident reports. Updates appear live.</div></div>
      </div>
      <div id="stats"></div>
      <form class="filters" id="filters">
        <div class="field"><label>Search</label><input type="search" name="q" placeholder="Description, address, resident or ref" /></div>
        <div class="field"><label>Status</label>
          <select name="status"><option value="">All</option>${options(STATUSES)}</select></div>
        <div class="field"><label>Issue type</label>
          <select name="issue_type"><option value="">All</option>${options(ISSUE_TYPES)}</select></div>
        <div class="field"><label>Category</label><input name="category" placeholder="e.g. High priority" /></div>
        <div class="field"><label>From</label><input type="date" name="from" /></div>
        <div class="field"><label>To</label><input type="date" name="to" /></div>
        <div class="field"><label>Sort by</label><select name="sort">${options(SORTS)}</select></div>
        <button type="button" class="btn" id="reset">Reset</button>
      </form>
      <div class="card" id="results">${loading()}</div>`
  );

  const stats = el.querySelector('#stats');
  function drawStats() {
    const n = (...s) => all.filter((r) => s.includes(r.status)).length;
    render(stats, statCards([
      { label: 'Total reports', value: all.length, tone: 'blue', icon: 'clipboard' },
      { label: 'Pending review', value: n('Pending'), tone: 'amber', icon: 'clock' },
      { label: 'In progress', value: n('Assigned', 'In Progress'), tone: 'violet', icon: 'tool' },
      { label: 'Resolved', value: n('Resolved', 'Archived'), tone: 'green', icon: 'check' },
    ]));
  }

  const form = el.querySelector('#filters');
  const results = el.querySelector('#results');

  function draw() {
    if (error) return render(results, errorState(error));
    if (!ready) return render(results, loading());
    const rows = filterRequests(all, state);
    if (!rows.length) return render(results, html`<div class="empty">No service requests match these filters.</div>`);
    offset = Math.min(offset, Math.floor((rows.length - 1) / PAGE_SIZE) * PAGE_SIZE);
    const page = rows.slice(offset, offset + PAGE_SIZE);
    render(
      results,
      html`
        <div class="table-wrap">
          <table>
            <thead><tr>
              <th>Ref</th><th>Photo</th><th>Issue</th><th>Resident</th><th>Status</th>
              <th>Assigned to</th><th>Rating</th><th>Submitted</th>
            </tr></thead>
            <tbody>
              ${page.map(
                (r) => html`
                  <tr class="clickable ${flash.has(r.id) && 'is-new'}" data-id="${r.id}">
                    <td>${shortId(r.id)}</td>
                    <td><img class="thumb" src="${r.thumb}" alt="" loading="lazy" /></td>
                    <td class="wrap"><strong>${r.issue_type}</strong>
                      ${r.category && html`<div class="small muted">${r.category}</div>`}
                      <div class="small muted">${r.description.slice(0, 70)}${r.description.length > 70 ? '…' : ''}</div></td>
                    <td>${r.resident_name}</td>
                    <td>${statusBadge(r.status)}</td>
                    <td>${r.assigned_staff_name ? html`${r.assigned_staff_name}<div class="small muted">${r.assigned_department_name}</div>` : '—'}</td>
                    <td>${stars(r.rating)}</td>
                    <td title="${r.created_at}">${timeAgo(r.created_at)}</td>
                  </tr>`
              )}
            </tbody>
          </table>
        </div>
        <div class="pager">
          <span class="muted">Showing ${offset + 1}–${offset + page.length} of ${rows.length}</span>
          <span>
            <button class="btn btn-sm" data-page="prev" ${offset === 0 && 'disabled'}>← Previous</button>
            <button class="btn btn-sm" data-page="next" ${offset + PAGE_SIZE >= rows.length && 'disabled'}>Next →</button>
          </span>
        </div>`
    );
    flash = new Set();
  }

  // Live: the table redraws whenever a report is added or changes (no manual refresh).
  const stop = subscribeRequests((list, err) => {
    error = err;
    if (ready) list.filter((r) => !seen.has(r.id)).forEach((r) => flash.add(r.id));
    list.forEach((r) => seen.add(r.id));
    all = list;
    ready = !err || list.length > 0;
    drawStats();
    draw();
  });

  form.addEventListener('input', () => {
    for (const key of Object.keys(state)) state[key] = form.elements[key].value.trim();
    offset = 0;
    draw();
  });
  form.addEventListener('submit', (e) => e.preventDefault());
  el.querySelector('#reset').onclick = () => {
    form.reset();
    Object.assign(state, { status: '', issue_type: '', category: '', q: '', from: '', to: '', sort: 'newest' });
    offset = 0;
    draw();
  };
  results.addEventListener('click', (e) => {
    const pager = e.target.closest('[data-page]');
    if (pager) {
      offset = Math.max(0, offset + (pager.dataset.page === 'next' ? PAGE_SIZE : -PAGE_SIZE));
      return draw();
    }
    const row = e.target.closest('tr[data-id]');
    if (row) location.hash = `#/requests/${row.dataset.id}`;
  });

  return { destroy: stop };
}
