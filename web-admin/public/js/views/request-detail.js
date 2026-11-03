import { ISSUE_TYPES } from '../config.js';
import {
  CATEGORIES, activeCount, archiveRequest, assignRequest, deleteRequest, getPhoto, rejectRequest, requestsOnce, setCategory, staffOnce,
  updateRequestDetails, watchHistory, watchRequest,
} from '../service.js';
import { reauthField, verifyPassword } from '../reauth.js';
import { breadcrumbs, errorState, formatDate, html, icon, loading, mapEmbed, openDialog, render, shortId, stars, statusBadge, timeline, toast } from '../ui.js';

// The preset labels, plus the report's own label when it is something else (an older free-text value).
const categoryOptions = (current) =>
  [...new Set([...CATEGORIES, ...(current ? [current] : [])])].map(
    (c) => html`<option value="${c}" ${c === current && 'selected'}>${c}</option>`
  );

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

  function draw() {
    if (error) return render(el, errorState(error));
    if (!loaded) return render(el, loading('page'));
    if (!request) return render(el, errorState(new Error('Service request not found')));
    const r = request;
    const canDecide = r.status === 'Pending';
    const canReassign = r.status === 'Assigned';
    render(
      el,
      html`
        ${breadcrumbs([['Service requests', '#/requests'], [`${r.issue_type} #${shortId(r.id)}`]])}
        <div class="page-head">
          <div><h1>${r.issue_type} <span class="muted">#${shortId(r.id)}</span></h1>
            <div>${statusBadge(r.status)} <span class="muted">submitted ${formatDate(r.created_at)}</span></div></div>
        </div>
        <div class="detail">
          <div class="stack">
            <div class="card">
              <img class="detail-photo" data-zoom src="${photo || r.thumb}" alt="Photo evidence: click to enlarge" />
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
              <div class="actions">
                <button class="btn" id="edit-details">${icon('edit')}<span>Edit details</span></button>
                <button class="btn btn-danger" id="delete-request">${icon('trash')}<span>Delete report</span></button>
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
        content: html`<div class="field"><label for="cat">Category / priority label</label>
          <select id="cat" name="category"><option value="">No category</option>${categoryOptions(r.category)}</select></div>`,
        onSubmit: async ({ category }) => {
          await setCategory(r.id, category);
          toast('Category saved', 'success');
        },
      });

    el.querySelector('#reject')?.addEventListener('click', () =>
      openDialog({
        title: 'Reject this report?',
        submitLabel: 'Yes, reject report',
        danger: true,
        content: html`<p>This marks the report as <strong>invalid</strong>. It cannot be assigned afterwards, and the resident is told why.</p>
          <div class="field"><label for="reason">Reason (the resident will read this)</label><textarea id="reason" name="reason" required></textarea></div>`,
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
        title: r.status === 'Assigned' ? 'Reassign this report?' : 'Assign to field personnel',
        submitLabel: r.status === 'Assigned' ? 'Yes, reassign' : 'Assign',
        danger: r.status === 'Assigned',
        content: html`
          ${r.status === 'Assigned' && html`<p class="callout">Now assigned to <strong>${r.assigned_staff_name}</strong>. They will no longer see this report, and the new person is notified.</p>`}
          <div class="field"><label>Staff member</label>
            <select name="staff_id" required>
              ${staff.map((s) => html`<option value="${s.id}" ${s.id === r.assigned_staff_id && 'selected'}>
                ${s.name} (${s.department_name}) · ${activeCount(all, s.id)} active</option>`)}
            </select></div>
          <div class="field"><label for="a-cat">Category (optional)</label>
            <select id="a-cat" name="category"><option value="">No category</option>${categoryOptions(r.category)}</select></div>
          <div class="field"><label>Note for the record (optional)</label><input name="note" /></div>`,
        onSubmit: async ({ staff_id, category, note }) => {
          await assignRequest(r.id, staff_id, { category, note });
          toast('Report assigned', 'success');
        },
      });
    });

    el.querySelector('#edit-details').onclick = () =>
      openDialog({
        title: 'Edit report details',
        submitLabel: 'Save changes',
        content: html`
          <div class="field"><label for="e-issue">Issue type</label>
            <select id="e-issue" name="issue_type" required>
              ${ISSUE_TYPES.map((t) => html`<option ${t === r.issue_type && 'selected'}>${t}</option>`)}</select></div>
          <div class="field"><label for="e-desc">Description</label>
            <textarea id="e-desc" name="description" maxlength="2000" required>${r.description}</textarea></div>
          <div class="field"><label for="e-addr">Address / landmark (optional)</label>
            <input id="e-addr" name="address" maxlength="200" value="${r.address || ''}" /></div>
          <p class="muted small">The status, photo, location and history stay the same.</p>`,
        onSubmit: async (values) => {
          await updateRequestDetails(r.id, values);
          toast('Report details saved', 'success');
        },
      });

    el.querySelector('#delete-request').onclick = () =>
      openDialog({
        title: 'Delete this report?',
        submitLabel: 'Yes, delete for good',
        danger: true,
        content: html`<p>This removes <strong>${r.issue_type} #${shortId(r.id)}</strong> permanently, together with its photo and its status history.
            It disappears for the resident${r.assigned_staff_name ? ' and for the assigned staff' : ''} too. This cannot be undone.</p>
          <p class="muted small">To close a finished report but keep it in the records, use <strong>Archive</strong> instead.</p>
          ${reauthField()}`,
        onSubmit: async (values) => {
          await verifyPassword(values);
          location.hash = '#/requests';
          await deleteRequest(r.id);
          toast('Report deleted', 'success');
        },
      });

    el.querySelector('#archive')?.addEventListener('click', () =>
      openDialog({
        title: 'Archive this request?',
        submitLabel: 'Yes, archive',
        content: html`<p>Archiving closes the request for good. It stays in the records and in the reports, but no more changes can be made.</p>
          <div class="field"><label for="n">Note (optional)</label><input id="n" name="note" /></div>
          ${reauthField()}`,
        onSubmit: async (values) => {
          await verifyPassword(values);
          await archiveRequest(r.id, values.note);
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
