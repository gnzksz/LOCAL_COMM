import { ISSUE_TYPES } from '../config.js';
import { exportCsv, printRows } from '../export.js';
import { CATEGORIES, NO_CATEGORY, filterRequests, subscribeRequests } from '../service.js';
import { emptyState, errorState, html, icon, loading, render, shortId, skeletonStats, stars, statCards, statusBadge, timeAgo } from '../ui.js';

const PAGE_SIZE = 20;
const SORTS = [
  ['newest', 'Newest first'],
  ['oldest', 'Oldest first'],
  ['updated', 'Recently updated'],
  ['status', 'Status'],
  ['issue_type', 'Issue type'],
];

// Quick filters above the table. A value holds one or more statuses joined by commas.
const CHIPS = [
  ['', 'All'],
  ['Pending', 'Pending'],
  ['Assigned,In Progress', 'In progress'],
  ['Resolved', 'Resolved'],
  ['Rejected,Archived', 'Closed'],
];

const options = (items) =>
  items.map((v) => {
    const [value, label] = Array.isArray(v) ? v : [v, v];
    return html`<option value="${value}">${label}</option>`;
  });

const FRESH = { status: '', issue_type: '', category: '', q: '', from: '', to: '', sort: 'newest' };

export function mount(el) {
  const state = { ...FRESH };
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
        <div class="head-actions">
          <button type="button" class="btn" id="export-csv">${icon('download')}<span>Export CSV</span></button>
          <button type="button" class="btn" id="print">${icon('printer')}<span>Print</span></button>
        </div>
      </div>
      <div id="stats">${skeletonStats()}</div>
      <div class="chip-row" id="chips" role="group" aria-label="Quick filter by status"></div>
      <form class="filters" id="filters">
        <div class="field"><label for="f-q">Search</label><input id="f-q" type="search" name="q" placeholder="Description, address, resident or ref" /></div>
        <div class="field"><label for="f-issue">Issue type</label>
          <select id="f-issue" name="issue_type"><option value="">All</option>${options(ISSUE_TYPES)}</select></div>
        <div class="field"><label for="f-cat">Category</label>
          <select id="f-cat" name="category"></select></div>
        <div class="field"><label for="f-from">From</label><input id="f-from" type="date" name="from" /></div>
        <div class="field"><label for="f-to">To</label><input id="f-to" type="date" name="to" /></div>
        <div class="field"><label for="f-sort">Sort by</label><select id="f-sort" name="sort">${options(SORTS)}</select></div>
        <button type="button" class="btn" id="reset">Reset</button>
      </form>
      <div class="card" id="results">${loading()}</div>`
  );

  const stats = el.querySelector('#stats');
  const chips = el.querySelector('#chips');
  const form = el.querySelector('#filters');
  const results = el.querySelector('#results');
  const category = form.elements.category;

  function drawStats() {
    const n = (...s) => all.filter((r) => s.includes(r.status)).length;
    render(stats, statCards([
      { label: 'Total reports', value: all.length, tone: 'blue', icon: 'clipboard' },
      { label: 'Pending review', value: n('Pending'), tone: 'amber', icon: 'clock' },
      { label: 'In progress', value: n('Assigned', 'In Progress'), tone: 'violet', icon: 'tool' },
      { label: 'Resolved', value: n('Resolved', 'Archived'), tone: 'green', icon: 'check' },
    ]));
  }

  function drawChips() {
    render(
      chips,
      html`${CHIPS.map(([value, label]) => {
        const count = value ? all.filter((r) => value.split(',').includes(r.status)).length : all.length;
        return html`<button type="button" class="chip" data-status="${value}" aria-pressed="${String(state.status === value)}">${label} <b>${count}</b></button>`;
      })}`
    );
  }

  // The category list is the presets plus any other label already used on a report.
  function drawCategories() {
    const used = [...new Set(all.map((r) => r.category).filter(Boolean))];
    const names = [...new Set([...CATEGORIES, ...used])];
    render(category, html`<option value="">All</option><option value="${NO_CATEGORY}">No category</option>${options(names)}`);
    category.value = state.category;
  }

  const filtered = () => filterRequests(all, state);
  const summary = () => {
    const bits = [];
    const chip = CHIPS.find(([v]) => v === state.status);
    if (state.status) bits.push(`Status: ${chip?.[1] ?? state.status}.`);
    for (const [key, label] of [['issue_type', 'Issue'], ['category', 'Category'], ['q', 'Search'], ['from', 'From'], ['to', 'To']]) {
      if (state[key]) bits.push(`${label}: ${state[key] === NO_CATEGORY ? 'none' : state[key]}.`);
    }
    return bits.join(' ');
  };

  function draw() {
    if (error) return render(results, errorState(error));
    if (!ready) return render(results, loading());
    const rows = filtered();
    if (!rows.length) {
      const filtering = Object.entries(state).some(([k, v]) => k !== 'sort' && v);
      return render(
        results,
        filtering
          ? emptyState({ icon: 'search', title: 'No requests match these filters', text: 'Try a different search or clear the filters.', action: { label: 'Clear filters', id: 'clear' } })
          : emptyState({ icon: 'inbox', title: 'No service requests yet', text: 'Reports from residents show up here as soon as they are sent.' })
      );
    }
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
                    <td><img class="thumb" data-zoom src="${r.thumb}" alt="Photo of ${r.issue_type} report ${shortId(r.id)}" loading="lazy" /></td>
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

  function reset() {
    form.reset();
    Object.assign(state, FRESH);
    category.value = '';
    offset = 0;
    drawChips();
    draw();
  }

  // Live: the table redraws whenever a report is added or changes (no manual refresh).
  const stop = subscribeRequests((list, err) => {
    error = err;
    if (ready) list.filter((r) => !seen.has(r.id)).forEach((r) => flash.add(r.id));
    list.forEach((r) => seen.add(r.id));
    all = list;
    ready = !err || list.length > 0;
    drawStats();
    drawChips();
    drawCategories();
    draw();
  });

  form.addEventListener('input', () => {
    for (const key of Object.keys(state)) if (key !== 'status') state[key] = form.elements[key].value.trim();
    offset = 0;
    draw();
  });
  form.addEventListener('submit', (e) => e.preventDefault());
  el.querySelector('#reset').onclick = reset;

  chips.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-status]');
    if (!chip) return;
    state.status = chip.dataset.status;
    offset = 0;
    drawChips();
    draw();
  });

  el.querySelector('#export-csv').onclick = () => exportCsv(filtered());
  el.querySelector('#print').onclick = () => printRows(filtered(), summary());

  results.addEventListener('click', (e) => {
    if (e.target.closest('#clear')) return reset();
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
