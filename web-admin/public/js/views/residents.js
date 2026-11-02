import { subscribeRequests, updateContact, watchResidents } from '../service.js';
import { contactFields, emptyState, errorState, formatDate, html, loading, openDialog, render, toast } from '../ui.js';

export function mount(el) {
  render(
    el,
    html`
      <div class="page-head">
        <div><h1>Residents</h1><div class="muted">People who registered in the mobile app. You can correct their contact info.</div></div>
        <div class="field" style="margin:0"><input type="search" id="q" placeholder="Search name, email or phone" style="min-width:260px" /></div>
      </div>
      <div class="card" id="results">${loading()}</div>`
  );
  const results = el.querySelector('#results');
  let residents = null;
  let requests = [];
  let query = '';

  function draw() {
    if (!residents) return;
    const needle = query.toLowerCase();
    const rows = residents.filter((r) => !needle || [r.name, r.email, r.phone, r.address].join(' ').toLowerCase().includes(needle));
    if (!rows.length) {
      return render(results, residents.length
        ? emptyState({ icon: 'search', title: 'No residents match your search', text: 'Check the spelling or search by email or phone instead.' })
        : emptyState({ icon: 'user', title: 'No residents yet', text: 'People who sign up on the website or the mobile app appear here.' }));
    }
    render(
      results,
      html`<div class="table-wrap"><table>
        <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Address</th><th>Reports</th><th>Joined</th><th></th></tr></thead>
        <tbody>${rows.map(
          (r) => html`<tr>
            <td><strong>${r.name}</strong></td>
            <td>${r.email}</td>
            <td>${r.phone || '—'}</td>
            <td class="wrap">${r.address || '—'}</td>
            <td>${requests.filter((q) => q.resident_id === r.id).length}</td>
            <td>${formatDate(r.created_at)}</td>
            <td><button class="btn btn-sm" data-edit="${r.id}">Edit</button></td>
          </tr>`
        )}</tbody></table></div>`
    );
  }

  results.addEventListener('click', (e) => {
    const button = e.target.closest('[data-edit]');
    if (!button) return;
    const r = residents.find((x) => x.id === button.dataset.edit);
    openDialog({
      title: `Edit ${r.name}`,
      content: html`${contactFields(r)}
        <p class="muted small">Email: ${r.email}. The email is the login, so only the owner can change it (My profile, with a confirmation link).
          Reports already sent keep the old name.</p>`,
      onSubmit: async (values) => {
        await updateContact(r.id, values);
        toast('Resident info updated', 'success');
      },
    });
  });
  el.querySelector('#q').addEventListener('input', (e) => {
    query = e.target.value.trim();
    draw();
  });

  const stops = [
    watchResidents((list, err) => {
      if (err) return render(results, errorState(err));
      residents = list;
      draw();
    }),
    subscribeRequests((list) => {
      requests = list;
      draw();
    }),
  ];
  return { destroy: () => stops.forEach((stop) => stop()) };
}
