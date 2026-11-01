import { subscribeRequests, summarize, watchDepartments } from '../service.js';
import { errorState, html, loading, render } from '../ui.js';

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
        <div class="stat-grid">
          <div class="card stat"><div class="muted">Total requests</div><div class="value">${totals.total}</div></div>
          <div class="card stat"><div class="muted">Resolved / archived</div><div class="value">${resolvedCount}</div></div>
          <div class="card stat"><div class="muted">Average rating</div>
            <div class="value">${totals.average_rating ?? '—'}</div><div class="small muted">${totals.rated} rated</div></div>
          <div class="card stat"><div class="muted">Avg. time to resolve</div>
            <div class="value">${totals.average_resolution_hours ?? '—'}</div><div class="small muted">hours</div></div>
        </div>
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
