import { bucketize, donutChart, lineChart } from '../charts.js';
import { subscribeRequests, summarize, watchDepartments } from '../service.js';
import { emptyState, errorState, html, loading, render, skeletonStats, statCards } from '../ui.js';

const STATUS_COLORS = {
  Pending: 'var(--st-pending)',
  Assigned: 'var(--st-assigned)',
  'In Progress': 'var(--st-in-progress)',
  Resolved: 'var(--st-resolved)',
  Rejected: 'var(--st-rejected)',
  Archived: 'var(--st-archived)',
};
const STATUS_ORDER = Object.keys(STATUS_COLORS);

const PRESETS = [
  ['7', 'Last 7 days'],
  ['30', 'Last 30 days'],
  ['90', 'Last 90 days'],
  ['all', 'All time'],
];

const bars = (rows, labelKey) => {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return rows.length
    ? rows.map(
        (r) => html`<div class="bar-row"><span>${r[labelKey]}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${(r.count / max) * 100}%"></div></div>
          <strong>${r.count}</strong></div>`
      )
    : html`<div class="empty">No data</div>`;
};

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function mount(el) {
  let preset = '30';
  render(
    el,
    html`
      <div class="page-head">
        <div><h1>Summary reports</h1><div class="muted">Overview of service requests and performance.</div></div>
      </div>
      <div class="range-bar">
        <div class="chip-row" id="presets" role="group" aria-label="Date range">
          ${PRESETS.map(([key, label]) => html`<button type="button" class="chip" data-preset="${key}" aria-pressed="${String(key === preset)}">${label}</button>`)}
        </div>
        <form class="field-row" id="range" style="display:flex;gap:12px;flex-wrap:wrap">
          <div class="field"><label for="from">From</label><input id="from" type="date" name="from" /></div>
          <div class="field"><label for="to">To</label><input id="to" type="date" name="to" /></div>
        </form>
      </div>
      <div id="content">${skeletonStats()}${loading()}</div>`
  );
  const content = el.querySelector('#content');
  const form = el.querySelector('#range');
  const presets = el.querySelector('#presets');
  let requests = null;
  let departments = null;
  let error = null;

  // A preset fills the From / To boxes; typing a date by hand switches the presets off.
  function applyPreset(key) {
    preset = key;
    const today = new Date();
    if (key === 'all') {
      form.from.value = '';
      form.to.value = '';
    } else {
      const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (Number(key) - 1));
      form.from.value = ymd(from);
      form.to.value = ymd(today);
    }
    presets.querySelectorAll('[data-preset]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === preset)));
  }

  function draw() {
    if (error) return render(content, errorState(error));
    if (!requests || !departments) return render(content, html`${skeletonStats()}${loading()}`);
    const range = { from: form.from.value, to: form.to.value };
    const { totals, byStatus, byIssueType, byDepartment } = summarize(requests, departments, range);
    if (!requests.length) {
      return render(content, html`<div class="card">${emptyState({
        icon: 'chart',
        title: 'No reports yet',
        text: 'Charts appear here as soon as residents send their first report.',
      })}</div>`);
    }

    const resolvedCount = byStatus.filter((s) => ['Resolved', 'Archived'].includes(s.status)).reduce((n, s) => n + s.count, 0);
    const series = bucketize(requests, range.from, range.to);
    const unit = series.step === 1 ? 'day' : series.step === 7 ? 'week' : 'month';
    const statusCount = new Map(byStatus.map((s) => [s.status, s.count]));
    const segments = STATUS_ORDER.map((status) => ({ label: status, value: statusCount.get(status) || 0, color: STATUS_COLORS[status] }));

    render(
      content,
      html`
        ${statCards([
          { label: 'Total requests', value: totals.total, tone: 'blue', icon: 'clipboard' },
          { label: 'Resolved / archived', value: resolvedCount, tone: 'green', icon: 'check' },
          { label: `Average rating (${totals.rated} rated)`, value: totals.average_rating ?? '—', tone: 'amber', icon: 'chart' },
          { label: 'Avg. hours to resolve', value: totals.average_resolution_hours ?? '—', tone: 'violet', icon: 'clock' },
        ])}
        <div class="card" style="margin-bottom:20px">
          <div class="card-head"><h2>Reports over time</h2><span class="muted small">per ${unit}</span></div>
          ${lineChart({
            labels: series.labels,
            unit,
            series: [
              { name: 'Reported', values: series.reported, color: 'var(--primary)' },
              { name: 'Resolved', values: series.resolved, color: 'var(--st-resolved)' },
            ],
          })}
        </div>
        <div class="cols-2">
          <div class="card"><h2>By status</h2>${donutChart({ segments, title: 'Reports' })}</div>
          <div class="card"><h2>By issue type</h2>${bars(byIssueType, 'issue_type')}</div>
        </div>
        <div class="card"><h2>By department</h2>
          ${byDepartment.length
            ? html`<div class="table-wrap"><table>
                <thead><tr><th>Department</th><th>Assigned</th><th>Resolved</th><th>Avg. rating</th></tr></thead>
                <tbody>${byDepartment.map(
                  (d) => html`<tr><td>${d.name}</td><td>${d.assigned}</td><td>${d.resolved}</td><td>${d.average_rating ?? '—'}</td></tr>`
                )}</tbody>
              </table></div>`
            : emptyState({ icon: 'users', title: 'No departments yet', text: 'Add a department under Staff & departments.', action: { label: 'Go to Staff & departments', href: '#/staff' } })}
        </div>`
    );
  }

  presets.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-preset]');
    if (!btn) return;
    applyPreset(btn.dataset.preset);
    draw();
  });
  form.addEventListener('change', () => {
    preset = '';
    presets.querySelectorAll('[data-preset]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
    draw();
  });
  form.addEventListener('submit', (e) => e.preventDefault());
  applyPreset(preset);

  const stops = [
    subscribeRequests((list, err) => {
      requests = list;
      error = err;
      draw();
    }),
    watchDepartments((list) => {
      departments = list;
      draw();
    }),
  ];
  return { destroy: () => stops.forEach((stop) => stop()) };
}
