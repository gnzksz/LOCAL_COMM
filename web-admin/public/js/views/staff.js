import {
  activeCount, addDepartment, createStaff, subscribeRequests, updateStaffInfo, watchDepartments, watchStaff,
} from '../service.js';
import { contactFields, html, loading, openDialog, render, toast } from '../ui.js';

export function mount(el) {
  render(el, loading());
  let departments = null;
  let staff = null;
  let requests = [];

  function draw() {
    if (!departments || !staff) return;
    render(
      el,
      html`
        <div class="page-head">
          <div><h1>Staff & departments</h1><div class="muted">Field personnel who can be assigned to reports.</div></div>
          <div><button class="btn" id="add-dept">Add department</button>
            <button class="btn btn-primary" id="add-staff">Add staff account</button></div>
        </div>
        <div class="cols-2">
          <div class="card"><h2>Departments</h2>
            ${departments.map((d) => html`<div>${d.name} <span class="muted small">· ${staff.filter((s) => s.department_id === d.id).length} staff</span></div>`)}
          </div>
          <div class="card"><h2>Staff</h2>
            ${staff.length
              ? html`<div class="table-wrap"><table>
                  <thead><tr><th>Name</th><th>Contact</th><th>Department</th><th>Active</th><th></th></tr></thead>
                  <tbody>${staff.map(
                    (s) => html`<tr>
                      <td><strong>${s.name}</strong></td>
                      <td>${s.email}${s.phone && html`<div class="small muted">${s.phone}</div>`}</td>
                      <td>${s.department_name}</td>
                      <td>${activeCount(requests, s.id)}</td>
                      <td><button class="btn btn-sm" data-edit="${s.id}">Edit</button></td>
                    </tr>`
                  )}</tbody></table></div>`
              : html`<div class="empty">No staff accounts yet.</div>`}
          </div>
        </div>`
    );

    el.querySelector('#add-dept').onclick = () =>
      openDialog({
        title: 'Add department',
        content: html`<div class="field"><label>Name</label><input name="name" required /></div>`,
        onSubmit: async ({ name }) => {
          await addDepartment(name, departments);
          toast('Department added', 'success');
        },
      });

    el.querySelector('#add-staff').onclick = () => {
      if (!departments.length) return toast('Add a department first.', 'error');
      openDialog({
        title: 'Add staff account',
        content: html`
          <div class="field"><label>Full name</label><input name="name" required /></div>
          <div class="field"><label>Email</label><input name="email" type="email" required /></div>
          <div class="field"><label>Password (min 6 characters)</label><input name="password" type="password" minlength="6" required /></div>
          <div class="field"><label>Department</label>
            <select name="department_id" required>${departments.map((d) => html`<option value="${d.id}">${d.name}</option>`)}</select></div>`,
        onSubmit: async (values) => {
          await createStaff(values);
          toast('Staff account created', 'success');
        },
      });
    };

    el.querySelectorAll('[data-edit]').forEach((button) => {
      button.onclick = () => {
        const s = staff.find((x) => x.id === button.dataset.edit);
        openDialog({
          title: `Edit ${s.name}`,
          content: html`
            ${contactFields(s)}
            <div class="field"><label>Department</label>
              <select name="department_id" required>
                ${departments.map((d) => html`<option value="${d.id}" ${d.id === s.department_id && 'selected'}>${d.name}</option>`)}
              </select></div>
            <p class="muted small">Email: ${s.email}. The email is the login, so only the owner can change it (My profile, with a confirmation link).
              Reports already assigned keep the old name and department.</p>`,
          onSubmit: async (values) => {
            await updateStaffInfo(s.id, values, departments);
            toast('Staff info updated', 'success');
          },
        });
      };
    });
  }

  const stops = [
    watchDepartments((list) => {
      departments = list;
      draw();
    }),
    watchStaff((list) => {
      staff = list;
      draw();
    }),
    subscribeRequests((list) => {
      requests = list;
      draw();
    }),
  ];
  return { destroy: () => stops.forEach((stop) => stop()) };
}
