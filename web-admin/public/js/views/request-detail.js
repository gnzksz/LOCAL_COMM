import {
  activeCount, archiveRequest, assignRequest, getPhoto, rejectRequest, requestsOnce, setCategory, staffOnce, watchHistory,
  watchRequest,
} from '../service.js';
import { errorState, formatDate, html, loading, mapEmbed, openDialog, render, shortId, stars, statusBadge, timeline, toast } from '../ui.js';

export function mount(el, [id]) {
  render(el, loading());

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

  function draw() {
    if (error) return render(el, errorState(error));
    if (!loaded) return render(el, loading());
    if (!request) return render(el, errorState(new Error('Service request not found')));
    const r = request;
    const canDecide = r.status === 'Pending';
    const canReassign = r.status === 'Assigned';
    render(
      el,
      html`
        <p><a href="#/requests">← All requests</a></p>
        <div class="page-head">
          <div><h1>${r.issue_type} <span class="muted">#${shortId(r.id)}</span></h1>
            <div>${statusBadge(r.status)} <span class="muted">submitted ${formatDate(r.created_at)}</span></div></div>
        </div>
        <div class="detail">
          <div class="stack">
            <div class="card">
              <img class="detail-photo" src="${photo || r.thumb}" alt="Photo evidence" />
              <h2 style="margin-top:14px">Description</h2>
              <p style="white-space:pre-wrap">${r.description}</p>
              <dl class="kv">
                <dt>Resident</dt><dd>${r.resident_name} <span class="muted">${r.resident_email || ''}</span></dd>
                <dt>Address</dt><dd>${r.address || '—'}</dd>
                <dt>Coordinates</dt><dd>${r.latitude.toFixed(5)}, ${r.longitude.toFixed(5)}</dd>
                <dt>Category</dt><dd>${r.category || '—'}
                  <button class="btn btn-sm btn-ghost" id="categorize">Edit</button></dd>
                <dt>Assigned to</dt><dd>${r.assigned_staff_name ? html`${r.assigned_staff_name} · ${r.assigned_department_name}` : '—'}</dd>
              </dl>
              ${r.rejection_reason && html`<p class="callout"><strong>Rejected:</strong> ${r.rejection_reason}</p>`}
              ${r.rating && html`<h2 style="margin-top:14px">Resident feedback</h2>
                <p>${stars(r.rating)} ${r.feedback && html`<br />${r.feedback}`}</p>`}
              <div class="actions">
                ${canDecide && html`<button class="btn btn-primary" id="assign">Valid: assign to staff</button>
                  <button class="btn btn-danger" id="reject">Invalid: reject</button>`}
                ${canReassign && html`<button class="btn" id="assign">Reassign</button>`}
                ${r.status === 'Resolved' && html`<button class="btn btn-primary" id="archive">Archive request</button>`}
              </div>
            </div>
          </div>
          <div class="stack">
            ${mapEmbed(r.latitude, r.longitude)}
            <div class="card"><h2>Status history</h2>${timeline(history)}</div>
          </div>
        </div>`
    );
    wire(r);
  }

  function wire(r) {
    el.querySelector('#categorize').onclick = () =>
      openDialog({
        title: 'Categorize report',
        content: html`<div class="field"><label>Category / priority label</label>
          <input name="category" value="${r.category || ''}" placeholder="e.g. High priority" /></div>`,
        onSubmit: async ({ category }) => {
          await setCategory(r.id, category);
          toast('Category saved', 'success');
        },
      });

    el.querySelector('#reject')?.addEventListener('click', () =>
      openDialog({
        title: 'Reject / flag report',
        submitLabel: 'Reject report',
        danger: true,
        content: html`<p class="muted">The resident will be notified with this reason.</p>
          <div class="field"><label>Reason</label><textarea name="reason" required></textarea></div>`,
        onSubmit: async ({ reason }) => {
          await rejectRequest(r.id, reason);
          toast('Report rejected; resident notified', 'success');
        },
      })
    );

    el.querySelector('#assign')?.addEventListener('click', async () => {
      let staff;
      let all;
      try {
        [staff, all] = await Promise.all([staffOnce(), requestsOnce()]);
      } catch (err) {
        return toast(err.message, 'error');
      }
      if (!staff.length) return toast('Create a staff account first (Staff & departments).', 'error');
      openDialog({
        title: 'Assign to field personnel',
        submitLabel: 'Assign',
        content: html`
          <div class="field"><label>Staff member</label>
            <select name="staff_id" required>
              ${staff.map((s) => html`<option value="${s.id}" ${s.id === r.assigned_staff_id && 'selected'}>
                ${s.name} (${s.department_name}) · ${activeCount(all, s.id)} active</option>`)}
            </select></div>
          <div class="field"><label>Category (optional)</label><input name="category" value="${r.category || ''}" /></div>
          <div class="field"><label>Note for the record (optional)</label><input name="note" /></div>`,
        onSubmit: async ({ staff_id, category, note }) => {
          await assignRequest(r.id, staff_id, { category, note });
          toast('Report assigned', 'success');
        },
      });
    });

    el.querySelector('#archive')?.addEventListener('click', () =>
      openDialog({
        title: 'Archive completed request',
        submitLabel: 'Archive',
        content: html`<div class="field"><label>Note (optional)</label><input name="note" /></div>`,
        onSubmit: async ({ note }) => {
          await archiveRequest(r.id, note);
          toast('Request archived', 'success');
        },
      })
    );
  }

  // Live: status changes made by staff/residents appear here without a refresh.
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
