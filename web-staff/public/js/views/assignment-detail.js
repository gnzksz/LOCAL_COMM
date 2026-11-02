import { getPhoto, resolveRequest, startRequest, watchHistory, watchRequest } from '../service.js';
import { breadcrumbs, errorState, formatDate, html, loading, mapEmbed, openDialog, render, shortId, stars, statusBadge, timeline, toast } from '../ui.js';

export function mount(el, [id]) {
  render(el, loading('page'));

  let request;
  let history = [];
  let photo = null;
  let error = null;
  let loaded = false;

  // The full photo is a separate document; show the thumbnail until it arrives.
  getPhoto(id).then((p) => {
    photo = p;
    if (loaded) draw();
  }).catch(() => {});

  function advance({ run, title, submitLabel, hint, success }) {
    openDialog({
      title,
      submitLabel,
      content: html`<p class="muted">${hint}</p>
        <div class="field"><label>Note (optional)</label><textarea name="note" placeholder="e.g. Truck dispatched, 2 workers on site"></textarea></div>`,
      onSubmit: async ({ note }) => {
        await run(id, note);
        toast(success, 'success');
      },
    });
  }

  function draw() {
    if (error) return render(el, errorState(new Error('This report is no longer assigned to you.')));
    if (!loaded) return render(el, loading('page'));
    if (!request) return render(el, errorState(new Error('Report not found')));
    const r = request;
    render(
      el,
      html`
        ${breadcrumbs([['My assignments', '#/assignments'], [`${r.issue_type} #${shortId(r.id)}`]])}
        <div class="page-head">
          <div><h1>${r.issue_type} <span class="muted">#${shortId(r.id)}</span></h1>
            <div>${statusBadge(r.status)} <span class="muted">assigned ${formatDate(r.assigned_at)}</span></div></div>
          <div class="actions" style="margin:0">
            ${r.status === 'Assigned' && html`<button class="btn btn-primary" id="start">Mark as In Progress</button>`}
            ${r.status === 'In Progress' && html`<button class="btn btn-primary" id="resolve">Mark as Resolved</button>`}
          </div>
        </div>
        <div class="detail">
          <div class="stack">
            <div class="card">
              <img class="detail-photo" src="${photo || r.thumb}" alt="Photo evidence" />
              <h2 style="margin-top:14px">Description</h2>
              <p style="white-space:pre-wrap">${r.description}</p>
              <dl class="kv">
                <dt>Address</dt><dd>${r.address || '—'}</dd>
                <dt>Coordinates</dt><dd>${r.latitude.toFixed(5)}, ${r.longitude.toFixed(5)}</dd>
                <dt>Department</dt><dd>${r.assigned_department_name}</dd>
                <dt>Category</dt><dd>${r.category || '—'}</dd>
                <dt>Reported by</dt><dd>${r.resident_name}</dd>
              </dl>
              ${r.rating && html`<h2 style="margin-top:14px">Resident feedback</h2>
                <p>${stars(r.rating)} ${r.feedback && html`<br />${r.feedback}`}</p>`}
            </div>
          </div>
          <div class="stack">
            ${mapEmbed(r.latitude, r.longitude)}
            <div class="card"><h2>Status history</h2>${timeline(history)}</div>
          </div>
        </div>`
    );

    el.querySelector('#start')?.addEventListener('click', () =>
      advance({
        run: startRequest,
        title: 'Start working on this report',
        submitLabel: 'Mark In Progress',
        hint: 'The resident will be notified that work has started.',
        success: 'Marked as In Progress; resident notified',
      })
    );
    el.querySelector('#resolve')?.addEventListener('click', () =>
      advance({
        run: resolveRequest,
        title: 'Complete the work',
        submitLabel: 'Mark Resolved',
        hint: 'The resident will be notified and asked to rate the service.',
        success: 'Marked as Resolved; resident notified',
      })
    );
  }

  // Live: the page updates by itself after each action (and if the admin reassigns the report).
  const stops = [
    watchRequest(id, (r, err) => {
      request = r;
      error = err || null;
      loaded = true;
      draw();
    }),
    watchHistory(id, (h) => {
      history = h;
      if (loaded) draw();
    }),
  ];
  return { destroy: () => stops.forEach((stop) => stop()) };
}
