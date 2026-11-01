import { subscribeRequests, summarize, watchDepartments } from '../service.js';
import { errorState, html, loading, render, statCards } from '../ui.js';

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

export function mount(el) {
  render(
    el,
    html`
      <div class="page-head">
        <div><h1>Summary reports</h1><div class="muted">Overview of service requests and performance.</div></div>
        <form class="filters" id="range" style="margin:0">
          <div class="field"><label>From</label><input type="date" name="from" /></div>
          <div class="field"><label>To</label><input type="date" name="to" /></div>
        </form>
      </div>
      <div id="content">${loading()}</div>`
  );
  const content = el.querySelector('#content');
  const form = el.querySelector('#range');
  let requests = null;
  let departments = null;
  let error = null;

  function draw() {
    if (error) return render(content, errorState(error));
    if (!requests || !departments) return render(content, loading());
    const { totals, byStatus, byIssueType, byDepartment } = summarize(requests, departments, {
      from: form.from.value,
      to: form.to.value,
    });
    const resolvedCount = byStatus.filter((s) => ['Resolved', 'Archived'].includes(s.status)).reduce((n, s) => n + s.count, 0);
    render(
      content,
      html`
        ${statCards([
          { label: 'Total requests', value: totals.total, tone: 'blue', icon: 'clipboard' },
          { label: 'Resolved / archived', value: resolvedCount, tone: 'green', icon: 'check' },
          { label: `Average rating (${totals.rated} rated)`, value: totals.average_rating ?? '—', tone: 'amber', icon: 'chart' },
          { label: 'Avg. hours to resolve', value: totals.average_resolution_hours ?? '—', tone: 'violet', icon: 'clock' },
        ])}
        <div class="cols-2">
          <div class="card"><h2>By status</h2>${bars(byStatus, 'status')}</div>
          <div class="card"><h2>By issue type</h2>${bars(byIssueType, 'issue_type')}</div>
        </div>
        <div class="card"><h2>By department</h2>
          <div class="table-wrap"><table>
            <thead><tr><th>Department</th><th>Assigned</th><th>Resolved</th><th>Avg. rating</th></tr></thead>
            <tbody>${byDepartment.map(
              (d) => html`<tr><td>${d.name}</td><td>${d.assigned}</td><td>${d.resolved}</td><td>${d.average_rating ?? '—'}</td></tr>`
            )}</tbody>
          </table></div></div>`
    );
  }

  form.addEventListener('change', draw);
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
