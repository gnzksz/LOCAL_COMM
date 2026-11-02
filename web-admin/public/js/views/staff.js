import {
  activeCount, addDepartment, createStaff, subscribeRequests, updateStaffInfo, watchDepartments, watchStaff,
} from '../service.js';
import { passwordProblem } from '../password.js';
import { reauthField, verifyPassword } from '../reauth.js';
import { contactFields, emptyState, html, loading, openDialog, render, toast } from '../ui.js';

// Common departments of a barangay (the admin can still add any other name with "Other").
const PRESET_DEPARTMENTS = [
  'Sanitation',
  'Peace & Order',
  'Public Works / Engineering',
  'Water & Drainage',
  'Electrical',
  'Health',
  'Fire & Rescue',
  'Social Welfare',
  'Environment',
  'Traffic Management',
  'Disaster Risk Reduction',
];
const OTHER = '__other__';
const NEW_PREFIX = 'new:';

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
              : emptyState({ icon: 'users', title: 'No staff accounts yet', text: 'Create an account so reports can be assigned to field personnel.', action: { label: 'Add staff account', id: 'empty-add-staff' } })}
          </div>
        </div>`
    );

    // Pick a common barangay department from the list instead of typing it; "Other" lets the admin type a new name.
    el.querySelector('#add-dept').onclick = () => {
      const free = PRESET_DEPARTMENTS.filter((n) => !departments.some((d) => d.name.toLowerCase() === n.toLowerCase()));
      openDialog({
        title: 'Add department',
        content: html`
          <div class="field"><label for="dept-pick">Department</label>
            <select id="dept-pick" name="pick" required>
              ${free.map((n) => html`<option value="${n}">${n}</option>`)}
              <option value="${OTHER}">Other (type a name)…</option>
            </select></div>
          <div class="field" id="dept-other" ${free.length ? 'hidden' : ''}>
            <label for="dept-name">Department name</label><input id="dept-name" name="name" maxlength="100" autocomplete="off" /></div>`,
        onOpen: (form) => {
          const other = form.querySelector('#dept-other');
          const sync = () => {
            other.hidden = form.pick.value !== OTHER;
            if (!other.hidden) form.name.focus();
          };
          form.pick.addEventListener('change', sync);
        },
        onSubmit: async ({ pick, name }) => {
          const value = pick === OTHER ? name : pick;
          if (!value?.trim()) throw new Error('Type the department name');
          await addDepartment(value, departments);
          toast('Department added', 'success');
        },
      });
    };

    el.querySelector('#add-staff').onclick = () => {
      // The list holds the departments that exist, plus the common ones that do not exist yet: picking one of those
      // creates the department together with the account, so nothing has to be typed or set up first.
      const missing = PRESET_DEPARTMENTS.filter((n) => !departments.some((d) => d.name.toLowerCase() === n.toLowerCase()));
      openDialog({
        title: 'Add staff account',
        content: html`
          <div class="field"><label>Full name</label><input name="name" required /></div>
          <div class="field"><label>Email</label><input name="email" type="email" required /></div>
          <div class="field"><label>Password for the new account</label><input name="password" type="password" autocomplete="new-password" required />
            <span class="muted small">At least 8 characters, with a letter and a number.</span></div>
          <div class="field"><label>Department</label>
            <select name="department_id" required>
              ${departments.map((d) => html`<option value="${d.id}">${d.name}</option>`)}
              ${missing.map((n) => html`<option value="${NEW_PREFIX}${n}">${n}</option>`)}
            </select></div>
          ${reauthField()}`,
        onSubmit: async (values) => {
          const weak = passwordProblem(values.password);
          if (weak) throw new Error(weak);
          await verifyPassword(values);
          let departmentId = values.department_id;
          if (departmentId.startsWith(NEW_PREFIX)) departmentId = await addDepartment(departmentId.slice(NEW_PREFIX.length), departments);
          await createStaff({ ...values, department_id: departmentId });
          toast('Staff account created', 'success');
        },
      });
    };

    el.querySelector('#empty-add-staff')?.addEventListener('click', () => el.querySelector('#add-staff').click());

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
