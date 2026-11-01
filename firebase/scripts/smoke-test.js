// End-to-end walk through the service request flow diagram against the Firebase emulators
// (Auth + Firestore), using the same client SDK and the same batches as the web apps.
// Besides the happy path it checks that firestore.rules refuse everything that skips a step.
// Run with: npm test   (starts the emulators, runs this file, stops them)
import assert from 'node:assert/strict';
import { initializeApp as initAdmin } from 'firebase-admin/app';
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  collection, connectFirestoreEmulator, doc, getDoc, getDocs, getFirestore, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { seed } from './seed.js';

const PROJECT = process.env.GCLOUD_PROJECT || 'demo-local-comm';
const unique = Date.now().toString().slice(-8);

initAdmin({ projectId: PROJECT });
await seed();

// 1x1 PNG as a data URL (the app stores compressed photos this way, no Cloud Storage on Spark)
const PHOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/** One independent client (own auth session) per person. */
function client(name) {
  const app = initializeApp({ projectId: PROJECT, apiKey: 'fake-api-key' }, name);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  return { auth, db, name: null, role: null, uid: null };
}

const step = (msg) => console.log(`  ✓ ${msg}`);

async function eventually(fn, what, ms = 8000) {
  const end = Date.now() + ms;
  for (;;) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (err) {
      if (Date.now() > end) throw err;
    }
    if (Date.now() > end) throw new Error(`Timed out waiting for: ${what}`);
    await new Promise((r) => setTimeout(r, 150));
  }
}

async function expectDenied(promise, what) {
  try {
    await promise;
  } catch (err) {
    assert.equal(err.code, 'permission-denied', `${what}: expected permission-denied but got "${err.code}: ${err.message}"`);
    return;
  }
  assert.fail(`${what}: expected the rules to refuse this, but it succeeded`);
}

// ---- the same batches the web apps write ----------------------------------------------------

/** Request update + history entry + optional notification, committed atomically. */
function statusChange(c, requestId, patch, { note = null, notify = null } = {}) {
  const batch = writeBatch(c.db);
  const ref = doc(c.db, 'requests', requestId);
  batch.update(ref, { ...patch, updated_at: serverTimestamp() });
  if (patch.status) {
    batch.set(doc(collection(ref, 'history')), {
      status: patch.status, note, actor_id: c.uid, actor_name: c.name, actor_role: c.role, created_at: serverTimestamp(),
    });
  }
  if (notify) {
    batch.set(doc(collection(c.db, 'notifications')), {
      user_id: notify.userId, request_id: requestId, from_id: c.uid, title: notify.title, message: notify.message,
      is_read: false, created_at: serverTimestamp(),
    });
  }
  return batch.commit();
}

/** Resident submits a report: request + full photo + first history entry in one batch. */
function submitReport(c, overrides = {}, { withPhoto = true } = {}) {
  const batch = writeBatch(c.db);
  const ref = doc(collection(c.db, 'requests'));
  batch.set(ref, {
    resident_id: c.uid, resident_name: c.name, resident_email: c.email,
    issue_type: 'Garbage / Waste Collection', description: 'Uncollected garbage for 3 days near the chapel',
    thumb: PHOTO, latitude: 14.5995, longitude: 120.9842, address: 'Purok 3', category: null, status: 'Pending',
    assigned_staff_id: null, assigned_staff_name: null, assigned_department_id: null, assigned_department_name: null,
    rejection_reason: null, rating: null, feedback: null,
    created_at: serverTimestamp(), updated_at: serverTimestamp(), assigned_at: null, resolved_at: null, archived_at: null,
    ...overrides,
  });
  if (withPhoto) batch.set(doc(ref, 'photo', 'main'), { data: PHOTO });
  batch.set(doc(collection(ref, 'history')), {
    status: 'Pending', note: 'Report submitted', actor_id: c.uid, actor_name: c.name, actor_role: 'resident',
    created_at: serverTimestamp(),
  });
  return batch.commit().then(() => ref.id);
}

// ---- actors ------------------------------------------------------------------------------------

const admin = client('admin');
const staff = client('staff');
const staff2 = client('staff2');
const resident = client('resident');
const resident2 = client('resident2');
const signup = client('signup'); // throw-away app used to create staff logins (like the admin web app)

console.log(`Smoke test against the Firebase emulators (project ${PROJECT})`);

const adminCred = await signInWithEmailAndPassword(admin.auth, 'admin@localcomm.test', 'admin123');
Object.assign(admin, { uid: adminCred.user.uid, name: 'System Administrator', role: 'admin' });
step('Admin signed in');

// Admin creates staff: Auth account on a separate app, profile written by the admin
async function createStaff(c, name, email, departmentId) {
  const cred = await createUserWithEmailAndPassword(signup.auth, email, 'staff123');
  const department = await getDoc(doc(admin.db, 'departments', departmentId));
  await setDoc(doc(admin.db, 'users', cred.user.uid), {
    name, email, role: 'staff', department_id: departmentId, department_name: department.get('name'),
    created_at: serverTimestamp(),
  });
  await signInWithEmailAndPassword(c.auth, email, 'staff123');
  Object.assign(c, { uid: cred.user.uid, name, role: 'staff', email });
  return cred.user.uid;
}
const pedro = await createStaff(staff, 'Pedro Santos', `pedro${unique}@localcomm.test`, 'sanitation');
await createStaff(staff2, 'Maria Cruz', `maria${unique}@localcomm.test`, 'electrical');
assert.equal(admin.auth.currentUser.uid, admin.uid);
step('Admin created two staff accounts (Sanitation, Electrical) and stayed signed in');

// Residents register with email + password
async function register(c, name, email) {
  const cred = await createUserWithEmailAndPassword(c.auth, email, 'secret123');
  await setDoc(doc(c.db, 'users', cred.user.uid), { name, email, role: 'resident', created_at: serverTimestamp() });
  Object.assign(c, { uid: cred.user.uid, name, role: 'resident', email });
}
await register(resident, 'Juan Dela Cruz', `juan${unique}@mail.test`);
await register(resident2, 'Ana Reyes', `ana${unique}@mail.test`);
step('Residents registered with email and password');

const sneaky = client('sneaky');
const sneakyCred = await createUserWithEmailAndPassword(sneaky.auth, `sneaky${unique}@mail.test`, 'secret123');
await expectDenied(
  setDoc(doc(sneaky.db, 'users', sneakyCred.user.uid), { name: 'Sneaky', email: `sneaky${unique}@mail.test`, role: 'admin', created_at: serverTimestamp() }),
  'self-registering as admin'
);
await expectDenied(
  setDoc(doc(resident.db, 'users', 'fake-staff'), { name: 'X', email: 'x@mail.test', role: 'staff', department_id: 'sanitation', department_name: 'Sanitation', created_at: serverTimestamp() }),
  'resident creating a staff profile'
);
await expectDenied(updateDoc(doc(resident.db, 'users', resident.uid), { role: 'admin' }), 'changing own role');
step('Nobody can become admin or staff on their own');

// ---- "Photo and location attached?" -> No: complete details --------------------------------------

await expectDenied(submitReport(resident, {}, { withPhoto: false }), 'report without photo');
await expectDenied(submitReport(resident, { thumb: '' }), 'report with empty thumbnail');
await expectDenied(submitReport(resident, { latitude: null }), 'report without location');
await expectDenied(submitReport(resident, { latitude: 123 }), 'report with impossible location');
await expectDenied(submitReport(resident, { status: 'Resolved' }), 'report created already Resolved');
await expectDenied(submitReport(resident, { resident_id: resident2.uid }), "report in someone else's name");
await expectDenied(submitReport(resident, { issue_type: 'Made up' }), 'unknown issue type');
step('Incomplete or tampered reports (no photo / no location / wrong status or owner) are refused');

// ---- Yes -> Save report, notify dashboard (real-time), Status = Pending ---------------------------------

const live = [];
const unsubscribe = onSnapshot(query(collection(admin.db, 'requests'), orderBy('created_at', 'desc')), (snap) =>
  live.push(snap.docs.map((d) => `${d.id}:${d.get('status')}`))
);
const reqId = await submitReport(resident);
await eventually(() => live.some((l) => l.includes(`${reqId}:Pending`)), 'live dashboard update');
const history = () => getDocs(query(collection(admin.db, `requests/${reqId}/history`), orderBy('created_at')));
assert.equal((await history()).size, 1);
assert.equal((await getDoc(doc(admin.db, 'requests', reqId, 'photo', 'main'))).get('data'), PHOTO);
step(`Report saved as Pending with photo and history; dashboard updated live (${reqId})`);

// ---- Access control on the report ------------------------------------------------------------------

await expectDenied(getDoc(doc(resident2.db, 'requests', reqId)), 'other resident reading the report');
await expectDenied(getDoc(doc(resident2.db, 'requests', reqId, 'photo', 'main')), "other resident reading the photo");
await expectDenied(getDoc(doc(staff.db, 'requests', reqId)), 'unassigned staff reading the report');
await expectDenied(updateDoc(doc(resident.db, 'requests', reqId), { status: 'Resolved', updated_at: serverTimestamp() }), 'resident changing status');
await expectDenied(statusChange(admin, reqId, { status: 'Resolved', resolved_at: serverTimestamp() }), 'admin jumping Pending -> Resolved');
await expectDenied(statusChange(admin, reqId, { status: 'Archived', archived_at: serverTimestamp() }), 'admin jumping Pending -> Archived');
await expectDenied(updateDoc(doc(admin.db, 'requests', reqId), { description: 'edited' }), 'admin editing the description');
step('Residents see only their own reports; no one can skip a step or edit a report');

// ---- Review report: categorize ------------------------------------------------------------------------

await statusChange(admin, reqId, { category: 'High priority' });
assert.equal((await getDoc(doc(admin.db, 'requests', reqId))).get('category'), 'High priority');
step('Admin categorized the report');

// ---- Valid report? No -> Notify resident -> End ------------------------------------------------------------

const spam = await submitReport(resident, { description: 'test test' });
const residentNotifs = () => getDocs(query(collection(resident.db, 'notifications'), where('user_id', '==', resident.uid)));
await expectDenied(statusChange(resident, spam, { status: 'Rejected', rejection_reason: 'x' }), 'resident rejecting');
await expectDenied(statusChange(admin, spam, { status: 'Rejected' }), 'rejecting without a reason');
await expectDenied(
  statusChange(admin, spam, { status: 'Rejected', rejection_reason: 'dup' }, { notify: { userId: resident2.uid, title: 'x', message: 'x' } }),
  'notifying someone unrelated to the report'
);
await statusChange(admin, spam, { status: 'Rejected', rejection_reason: 'Duplicate / test submission' }, {
  note: 'Duplicate / test submission',
  notify: { userId: resident.uid, title: 'Report rejected / flagged', message: 'Your report was not accepted: Duplicate / test submission' },
});
await eventually(async () => (await residentNotifs()).docs.some((d) => /rejected/i.test(d.get('title'))), 'rejection notification');
assert.equal((await getDoc(doc(admin.db, 'requests', spam))).get('status'), 'Rejected');
await expectDenied(
  statusChange(admin, spam, { status: 'Assigned', assigned_staff_id: pedro, assigned_staff_name: 'Pedro Santos', assigned_department_id: 'sanitation', assigned_department_name: 'Sanitation', assigned_at: serverTimestamp() }),
  'assigning a rejected report'
);
step('Invalid report rejected, resident notified, cannot be assigned afterwards');

// ---- Valid report? Yes -> Assign to department / field personnel ----------------------------------------------

const assignPatch = (staffId, name, deptId, deptName) => ({
  status: 'Assigned', assigned_staff_id: staffId, assigned_staff_name: name,
  assigned_department_id: deptId, assigned_department_name: deptName, assigned_at: serverTimestamp(),
});
await expectDenied(statusChange(admin, reqId, assignPatch(resident.uid, 'Juan Dela Cruz', 'sanitation', 'Sanitation')), 'assigning to a non-staff user');
await expectDenied(statusChange(admin, reqId, assignPatch(pedro, 'Pedro Santos', 'electrical', 'Electrical')), "assigning with the wrong department");
await expectDenied(statusChange(staff, reqId, assignPatch(pedro, 'Pedro Santos', 'sanitation', 'Sanitation')), 'staff assigning to themselves');
await statusChange(admin, reqId, assignPatch(pedro, 'Pedro Santos', 'sanitation', 'Sanitation'), {
  note: 'Assigned to Pedro Santos',
  notify: { userId: pedro, title: 'New assignment', message: 'You have been assigned a report' },
});
const assigned = (await getDoc(doc(admin.db, 'requests', reqId))).data();
assert.equal(assigned.status, 'Assigned');
assert.equal(assigned.assigned_department_name, 'Sanitation');
await eventually(async () => {
  const s = await getDocs(query(collection(staff.db, 'notifications'), where('user_id', '==', pedro)));
  return s.docs.some((d) => d.get('title') === 'New assignment');
}, 'staff assignment notification');
step('Valid report assigned to Sanitation / Pedro Santos; staff notified');

// ---- Staff: view assigned report -----------------------------------------------------------------------------

const mine = await getDocs(query(collection(staff.db, 'requests'), where('assigned_staff_id', '==', pedro)));
assert.deepEqual(mine.docs.map((d) => d.id), [reqId]);
assert.equal((await getDoc(doc(staff.db, 'requests', reqId, 'photo', 'main'))).get('data'), PHOTO);
await expectDenied(getDoc(doc(staff2.db, 'requests', reqId)), 'other staff reading the report');
await expectDenied(statusChange(staff2, reqId, { status: 'In Progress' }), "another staff starting someone else's report");
await expectDenied(statusChange(staff, reqId, { status: 'Resolved', resolved_at: serverTimestamp() }), 'resolving before starting');
step('Staff sees the assigned report with photo and location; others cannot touch it, and cannot skip "In Progress"');

// ---- Update progress: In Progress -> resident notified -----------------------------------------------------------

await statusChange(staff, reqId, { status: 'In Progress' }, {
  note: 'Truck dispatched',
  notify: { userId: resident.uid, title: 'Your report is now In Progress', message: 'Field personnel are now working on it' },
});
await eventually(async () => (await residentNotifs()).docs.some((d) => /In Progress/.test(d.get('title'))), 'In Progress notification');
await expectDenied(statusChange(admin, reqId, assignPatch(pedro, 'Pedro Santos', 'sanitation', 'Sanitation')), 'reassigning after work started');
step('Staff marked In Progress; resident notified');

await expectDenied(updateDoc(doc(resident.db, 'requests', reqId), { rating: 5, feedback: 'x', updated_at: serverTimestamp() }), 'feedback before resolved');

// ---- Complete the work: Resolved -> resident notified ----------------------------------------------------------------

await statusChange(staff, reqId, { status: 'Resolved', resolved_at: serverTimestamp() }, {
  notify: { userId: resident.uid, title: 'Your report has been Resolved', message: 'Please rate the service' },
});
await eventually(async () => (await residentNotifs()).docs.some((d) => /Resolved/.test(d.get('title'))), 'Resolved notification');
step('Staff marked Resolved; resident notified');

// ---- Rate / give feedback ---------------------------------------------------------------------------------------------

const feedback = (c, rating, text) => updateDoc(doc(c.db, 'requests', reqId), { rating, feedback: text, updated_at: serverTimestamp() });
await expectDenied(feedback(resident, 9, 'x'), 'rating out of range');
await expectDenied(feedback(resident2, 5, 'x'), "rating someone else's report");
await expectDenied(updateDoc(doc(resident.db, 'requests', reqId), { rating: 5, status: 'Archived', updated_at: serverTimestamp() }), 'feedback that also changes the status');
await feedback(resident, 5, 'Mabilis ang aksyon, salamat!');
await expectDenied(feedback(resident, 1, 'changed my mind'), 'second feedback');
await eventually(() => live.at(-1)?.includes(`${reqId}:Resolved`), 'live feedback update');
step('Resident rated 5/5 once; duplicate or out-of-range feedback refused');

// ---- Archive completed request -------------------------------------------------------------------------------------------

await expectDenied(statusChange(staff, reqId, { status: 'Archived', archived_at: serverTimestamp() }), 'staff archiving');
await statusChange(admin, reqId, { status: 'Archived', archived_at: serverTimestamp() });
const finalHistory = await getDocs(query(collection(resident.db, `requests/${reqId}/history`), orderBy('created_at')));
assert.deepEqual(finalHistory.docs.map((d) => d.get('status')), ['Pending', 'Assigned', 'In Progress', 'Resolved', 'Archived']);
await eventually(() => live.at(-1)?.includes(`${reqId}:Archived`), 'live archive update');
await expectDenied(
  setDoc(doc(collection(resident.db, `requests/${reqId}/history`)), { status: 'Pending', note: null, actor_id: resident.uid, actor_name: resident.name, actor_role: 'resident', created_at: serverTimestamp() }),
  'forging a history entry'
);
step('Request archived; full status history recorded; dashboard updated live; history cannot be forged');

// ---- Notifications inbox ----------------------------------------------------------------------------------------------------

const notifs = await residentNotifs();
assert.equal(notifs.size, 3, 'rejected + in progress + resolved');
await updateDoc(notifs.docs[0].ref, { is_read: true });
await expectDenied(updateDoc(notifs.docs[0].ref, { title: 'hacked' }), 'editing a notification');
await expectDenied(getDocs(query(collection(resident2.db, 'notifications'), where('user_id', '==', resident.uid))), "reading someone else's notifications");
await expectDenied(
  setDoc(doc(collection(resident.db, 'notifications')), { user_id: resident2.uid, request_id: reqId, from_id: resident.uid, title: 'spam', message: 'spam', is_read: false, created_at: serverTimestamp() }),
  'resident creating notifications'
);
step('Resident notification inbox works and is private');

unsubscribe();
console.log('\nAll flow steps passed.');
process.exit(0);
