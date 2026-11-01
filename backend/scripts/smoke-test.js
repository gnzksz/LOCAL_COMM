// End-to-end walk through the service request flow diagram against a running server.
// Usage: npm start (in another terminal), then `npm run smoke`.
// Requires the seeded admin account (npm run seed).
import assert from 'node:assert/strict';
import { io } from 'socket.io-client';

const BASE = process.env.API_URL || 'http://localhost:4000';
const ADMIN = {
  identifier: process.env.SEED_ADMIN_EMAIL || 'admin@localcomm.test',
  password: process.env.SEED_ADMIN_PASSWORD || 'admin123',
};
const unique = Date.now().toString().slice(-8);

// 1x1 PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

async function api(method, path, { token, body, form } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  let payload;
  if (form) payload = form;
  else if (body) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, { method, headers, body: payload });
  const data = await res.json();
  return { status: res.status, data };
}

function step(msg) {
  console.log(`  ✓ ${msg}`);
}

function requestForm(fields, withPhoto = true) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  if (withPhoto) form.append('photo', new Blob([PNG], { type: 'image/png' }), 'evidence.png');
  return form;
}

function waitFor(socket, event) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timed out waiting for "${event}"`)), 3000);
    socket.once(event, (payload) => {
      clearTimeout(t);
      resolve(payload);
    });
  });
}

function connect(token) {
  return new Promise((resolve, reject) => {
    const s = io(BASE, { auth: { token }, transports: ['websocket'] });
    s.once('connect', () => resolve(s));
    s.once('connect_error', reject);
  });
}

console.log(`Smoke test against ${BASE}`);

// Start -> Register / log in (email or phone number)
const reg = await api('POST', '/api/auth/register', {
  body: { name: 'Juan Dela Cruz', phone: `09${unique}1`, password: 'secret123' },
});
assert.equal(reg.status, 201, JSON.stringify(reg.data));
const residentLogin = await api('POST', '/api/auth/login', {
  body: { identifier: `09${unique}1`, password: 'secret123' },
});
assert.equal(residentLogin.status, 200);
const resident = residentLogin.data.token;
step('Resident registered and logged in with phone number');

const adminLogin = await api('POST', '/api/auth/login', { body: ADMIN });
assert.equal(adminLogin.status, 200, 'Admin login failed — did you run `npm run seed`?');
const admin = adminLogin.data.token;

const depts = await api('GET', '/api/admin/departments', { token: admin });
const sanitation = depts.data.items.find((d) => d.name === 'Sanitation');
const createdStaff = await api('POST', '/api/admin/staff', {
  token: admin,
  body: {
    name: 'Pedro Santos',
    email: `pedro${unique}@localcomm.test`,
    password: 'staff123',
    department_id: sanitation.id,
  },
});
assert.equal(createdStaff.status, 201, JSON.stringify(createdStaff.data));
const staffLogin = await api('POST', '/api/auth/login', {
  body: { identifier: `pedro${unique}@localcomm.test`, password: 'staff123' },
});
const staff = staffLogin.data.token;
step('Admin created a staff account in Sanitation');

// Roles are enforced
assert.equal((await api('GET', '/api/admin/requests', { token: resident })).status, 403);
step('Resident cannot access admin endpoints');

const adminSocket = await connect(admin);
const residentSocket = await connect(resident);

// Create service request -> Photo and location attached? No -> complete details
const fields = {
  issue_type: 'Garbage / Waste Collection',
  description: 'Uncollected garbage for 3 days near the chapel',
  address: 'Purok 3, Brgy. San Isidro',
};
const noPhoto = await api('POST', '/api/requests', {
  token: resident,
  form: requestForm({ ...fields, latitude: '14.5995', longitude: '120.9842' }, false),
});
assert.equal(noPhoto.status, 422);
assert.deepEqual(noPhoto.data.details.missing, ['photo']);
const noLocation = await api('POST', '/api/requests', { token: resident, form: requestForm(fields) });
assert.equal(noLocation.status, 422);
assert.deepEqual(noLocation.data.details.missing, ['location']);
step('Incomplete reports (no photo / no location) are refused');

// Yes -> Save report and notify dashboard (real-time), Status = Pending
const newOnDashboard = waitFor(adminSocket, 'request:new');
const created = await api('POST', '/api/requests', {
  token: resident,
  form: requestForm({ ...fields, latitude: '14.5995', longitude: '120.9842' }),
});
assert.equal(created.status, 201, JSON.stringify(created.data));
assert.equal(created.data.request.status, 'Pending');
const live = await newOnDashboard;
assert.equal(live.id, created.data.request.id);
const reqId = created.data.request.id;
const photo = await fetch(BASE + created.data.request.photo_url);
assert.equal(photo.status, 200);
step(`Report #${reqId} saved as Pending and pushed live to admin dashboard`);

// Review report: view details, categorize, sort, filter
const list = await api('GET', '/api/admin/requests?status=Pending&sort=newest&q=chapel', { token: admin });
assert.ok(list.data.items.some((r) => r.id === reqId));
const categorized = await api('PATCH', `/api/admin/requests/${reqId}`, {
  token: admin,
  body: { category: 'High priority' },
});
assert.equal(categorized.data.request.category, 'High priority');
step('Admin filtered, viewed and categorized the report');

// Valid report? No -> Notify resident: report rejected / flagged -> End
const spam = await api('POST', '/api/requests', {
  token: resident,
  form: requestForm({ ...fields, description: 'test test', latitude: '14.6', longitude: '120.98' }),
});
const rejectedNotif = waitFor(residentSocket, 'notification');
const rejected = await api('POST', `/api/admin/requests/${spam.data.request.id}/reject`, {
  token: admin,
  body: { reason: 'Duplicate / test submission' },
});
assert.equal(rejected.data.request.status, 'Rejected');
assert.match((await rejectedNotif).title, /rejected/i);
step('Invalid report rejected and resident notified');

// Valid report? Yes -> Assign to department / field personnel
const assigned = await api('POST', `/api/admin/requests/${reqId}/assign`, {
  token: admin,
  body: { staff_id: createdStaff.data.staff.id },
});
assert.equal(assigned.status, 200, JSON.stringify(assigned.data));
assert.equal(assigned.data.request.status, 'Assigned');
assert.equal(assigned.data.request.assigned_department_name, 'Sanitation');
step('Valid report assigned to Sanitation / Pedro Santos');

// Staff: View assigned report
const mine = await api('GET', '/api/staff/requests', { token: staff });
assert.equal(mine.data.items.length, 1);
assert.ok(mine.data.items[0].photo_url && mine.data.items[0].latitude);
step('Staff sees assigned report with description, photo and location');

// Resolving before starting is not allowed
assert.equal((await api('POST', `/api/staff/requests/${reqId}/resolve`, { token: staff })).status, 409);

// Update progress: In Progress -> resident notified
let notif = waitFor(residentSocket, 'notification');
const started = await api('POST', `/api/staff/requests/${reqId}/start`, {
  token: staff,
  body: { note: 'Truck dispatched' },
});
assert.equal(started.data.request.status, 'In Progress');
assert.match((await notif).title, /In Progress/);
step('Staff marked In Progress; resident notified in real time');

// Feedback is only allowed once resolved
assert.equal(
  (await api('POST', `/api/requests/${reqId}/feedback`, { token: resident, body: { rating: 5 } })).status,
  409
);

// Complete the work: Resolved -> resident notified
notif = waitFor(residentSocket, 'notification');
const resolved = await api('POST', `/api/staff/requests/${reqId}/resolve`, { token: staff });
assert.equal(resolved.data.request.status, 'Resolved');
assert.match((await notif).title, /Resolved/);
step('Staff marked Resolved; resident notified in real time');

// Rate / give feedback -> feedback recorded
const feedbackLive = waitFor(adminSocket, 'request:feedback');
const fb = await api('POST', `/api/requests/${reqId}/feedback`, {
  token: resident,
  body: { rating: 5, feedback: 'Mabilis ang aksyon, salamat!' },
});
assert.equal(fb.status, 200);
assert.equal((await feedbackLive).rating, 5);
step('Resident rated 5/5; feedback pushed to admin dashboard');

// Archive completed request; view summary reports -> End
const archived = await api('POST', `/api/admin/requests/${reqId}/archive`, { token: admin });
assert.equal(archived.data.request.status, 'Archived');
const detail = await api('GET', `/api/requests/${reqId}`, { token: resident });
assert.deepEqual(
  detail.data.history.map((h) => h.status),
  ['Pending', 'Assigned', 'In Progress', 'Resolved', 'Archived']
);
const summary = await api('GET', '/api/admin/reports/summary', { token: admin });
assert.ok(summary.data.totals.total >= 2);
assert.ok(summary.data.byDepartment.find((d) => d.name === 'Sanitation').resolved >= 1);
step('Request archived; full status history recorded; summary report available');

const notifs = await api('GET', '/api/notifications', { token: resident });
assert.equal(notifs.data.unread, 3);
await api('POST', '/api/notifications/read-all', { token: resident });
assert.equal((await api('GET', '/api/notifications', { token: resident })).data.unread, 0);
step('Resident notification inbox works');

adminSocket.close();
residentSocket.close();
console.log('\nAll flow steps passed.');
