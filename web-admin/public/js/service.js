// Admin data layer on top of Firestore + Cloud Functions.
import { deleteApp, initializeApp } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import {
  connectAuthEmulator, createUserWithEmailAndPassword, getAuth,
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import {
  addDoc, collection, doc, getDoc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, where,
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';
import { USE_EMULATORS } from './config.js';
import { mapDoc, requireStatus, writeStatusChange } from './data.js';
import { db, firebaseOptions } from './firebase.js';

export { getPhoto, watchHistory, watchNotifications, watchRequest } from './data.js';

// ---- All requests: one shared live listener ------------------------------------------
// The dashboard is for one barangay, so the full list is kept in memory and filtered,
// sorted and paged in the browser. That keeps it live without Firestore composite indexes.

const MAX_REQUESTS = 1000;
const subscribers = new Set();
let unsubscribe = null;
let items = [];
let loaded = false;
let lastError = null;

function startListening() {
  unsubscribe = onSnapshot(
    query(collection(db, 'requests'), orderBy('created_at', 'desc'), limit(MAX_REQUESTS)),
    (snap) => {
      items = snap.docs.map(mapDoc);
      loaded = true;
      lastError = null;
      subscribers.forEach((cb) => cb(items, null));
    },
    (err) => {
      lastError = err;
      subscribers.forEach((cb) => cb(items, err));
    }
  );
}

/** `cb(requests, error?)` runs now (if data is ready) and on every change. Returns unsubscribe. */
export function subscribeRequests(cb) {
  subscribers.add(cb);
  if (!unsubscribe) startListening();
  else if (loaded) cb(items, null);
  else if (lastError) cb(items, lastError);
  return () => {
    subscribers.delete(cb);
    if (!subscribers.size && unsubscribe) {
      unsubscribe();
      unsubscribe = null;
      loaded = false;
      items = [];
    }
  };
}

const SORTS = {
  newest: (a, b) => b.created_at.localeCompare(a.created_at),
  oldest: (a, b) => a.created_at.localeCompare(b.created_at),
  updated: (a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''),
  status: (a, b) => a.status.localeCompare(b.status) || b.created_at.localeCompare(a.created_at),
  issue_type: (a, b) => a.issue_type.localeCompare(b.issue_type) || b.created_at.localeCompare(a.created_at),
};

const localDate = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Review reports: filter + sort. filters: status, issue_type, category, q, from, to. */
export function filterRequests(list, { status, issue_type, category, q, from, to, sort } = {}) {
  const needle = q?.toLowerCase();
  return list
    .filter((r) => {
      if (status && r.status !== status) return false;
      if (issue_type && r.issue_type !== issue_type) return false;
      if (category && !(r.category || '').toLowerCase().includes(category.toLowerCase())) return false;
      if (from && localDate(r.created_at) < from) return false;
      if (to && localDate(r.created_at) > to) return false;
      if (needle) {
        const haystack = [r.description, r.address, r.resident_name, r.id].join(' ').toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    })
    .sort(SORTS[sort] || SORTS.newest);
}

// ---- Summary reports --------------------------------------------------------------------

export function summarize(list, departments, { from, to } = {}) {
  const rows = list.filter((r) => (!from || localDate(r.created_at) >= from) && (!to || localDate(r.created_at) <= to));
  const average = (nums, digits) => {
    if (!nums.length) return null;
    const value = nums.reduce((a, b) => a + b, 0) / nums.length;
    return Number(value.toFixed(digits));
  };
  const count = (key) => {
    const map = new Map();
    for (const r of rows) map.set(r[key], (map.get(r[key]) || 0) + 1);
    return [...map].map(([name, n]) => ({ [key]: name, count: n })).sort((a, b) => b.count - a.count);
  };
  const ratings = rows.filter((r) => r.rating != null).map((r) => r.rating);
  const hours = rows.filter((r) => r.resolved_at).map((r) => (new Date(r.resolved_at) - new Date(r.created_at)) / 36e5);

  return {
    totals: { total: rows.length, average_rating: average(ratings, 2), rated: ratings.length, average_resolution_hours: average(hours, 1) },
    byStatus: count('status'),
    byIssueType: count('issue_type'),
    byDepartment: departments.map((d) => {
      const mine = rows.filter((r) => r.assigned_department_id === d.id);
      return {
        id: d.id,
        name: d.name,
        assigned: mine.length,
        resolved: mine.filter((r) => r.status === 'Resolved' || r.status === 'Archived').length,
        average_rating: average(mine.filter((r) => r.rating != null).map((r) => r.rating), 2),
      };
    }),
  };
}

// ---- Departments & staff ------------------------------------------------------------------

export function watchDepartments(cb) {
  return onSnapshot(query(collection(db, 'departments'), orderBy('name')), (snap) => cb(snap.docs.map(mapDoc)), () => cb([]));
}

export function watchStaff(cb) {
  return onSnapshot(
    query(collection(db, 'users'), where('role', '==', 'staff')),
    (snap) => cb(snap.docs.map(mapDoc).sort((a, b) => a.name.localeCompare(b.name))),
    () => cb([])
  );
}

function once(subscribe) {
  return new Promise((resolve, reject) => {
    let stop;
    let done = false;
    stop = subscribe((value, err) => {
      if (done) return;
      done = true;
      queueMicrotask(() => stop?.());
      return err ? reject(err) : resolve(value);
    });
  });
}

/** Current list of staff / requests as a promise (for dialogs). */
export const staffOnce = () => once(watchStaff);
export const requestsOnce = () => once(subscribeRequests);

export const activeCount =(list, staffId) =>
  list.filter((r) => r.assigned_staff_id === staffId && (r.status === 'Assigned' || r.status === 'In Progress')).length;

export async function addDepartment(name, existing) {
  const clean = name.trim();
  if (!clean) throw new Error('Department name is required');
  if (existing.some((d) => d.name.toLowerCase() === clean.toLowerCase())) throw new Error('Department already exists');
  await addDoc(collection(db, 'departments'), { name: clean, created_at: serverTimestamp() });
}

const AUTH_ERRORS = {
  'auth/email-already-in-use': 'Email is already registered',
  'auth/invalid-email': 'A valid email is required',
  'auth/weak-password': 'Password must be at least 6 characters',
};

/**
 * Create a staff login + profile. The Auth account is made on a throw-away second Firebase app,
 * so the admin stays signed in on the main one.
 */
export async function createStaff({ name, email, password, department_id }) {
  const cleanName = (name || '').trim();
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanName) throw new Error('Name is required');
  if (!password || password.length < 6) throw new Error('Password must be at least 6 characters');

  const department = await getDoc(doc(db, 'departments', department_id));
  if (!department.exists()) throw new Error('Department does not exist');

  const secondary = initializeApp(firebaseOptions, `staff-signup-${Date.now()}`);
  try {
    const auth = getAuth(secondary);
    if (USE_EMULATORS) connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    let uid;
    try {
      uid = (await createUserWithEmailAndPassword(auth, cleanEmail, password)).user.uid;
    } catch (err) {
      throw new Error(AUTH_ERRORS[err.code] || err.message);
    }
    await setDoc(doc(db, 'users', uid), {
      name: cleanName,
      email: cleanEmail,
      role: 'staff',
      department_id,
      department_name: department.get('name'),
      created_at: serverTimestamp(),
    });
    return { id: uid };
  } finally {
    await deleteApp(secondary);
  }
}

// ---- Actions on a report (the rules in firestore.rules enforce the flow) --------------------

export async function setCategory(id, category) {
  const r = await requireStatus(id, 'Pending', 'Assigned', 'In Progress', 'Resolved', 'Rejected', 'Archived');
  await writeStatusChange(r, { category: (category || '').trim().slice(0, 100) || null });
}

// "Valid report?" -> No: reject / flag and notify resident
export async function rejectRequest(id, reason) {
  const text = (reason || '').trim().slice(0, 500);
  if (!text) throw new Error('A reason is required when rejecting a report');
  const r = await requireStatus(id, 'Pending');
  await writeStatusChange(r, { status: 'Rejected', rejection_reason: text }, {
    note: text,
    notify: { userId: r.resident_id, title: 'Report rejected / flagged', message: `Your report (${r.issue_type}) was not accepted: ${text}` },
  });
}

// "Valid report?" -> Yes: assign to department / field personnel (re-assignable until the staff starts)
export async function assignRequest(id, staffId, { category, note } = {}) {
  const staff = await getDoc(doc(db, 'users', staffId));
  if (!staff.exists() || staff.get('role') !== 'staff') throw new Error('Choose an existing staff account');
  const r = await requireStatus(id, 'Pending', 'Assigned');
  const patch = {
    status: 'Assigned',
    assigned_staff_id: staff.id,
    assigned_staff_name: staff.get('name'),
    assigned_department_id: staff.get('department_id'),
    assigned_department_name: staff.get('department_name'),
    assigned_at: serverTimestamp(),
  };
  if ((category || '').trim()) patch.category = category.trim().slice(0, 100);
  await writeStatusChange(r, patch, {
    note: (note || '').trim().slice(0, 500) || `Assigned to ${staff.get('name')}`,
    notify: { userId: staff.id, title: 'New assignment', message: `You have been assigned a report: ${r.issue_type}` },
  });
}

export async function archiveRequest(id, note) {
  const r = await requireStatus(id, 'Resolved');
  await writeStatusChange(r, { status: 'Archived', archived_at: serverTimestamp() }, { note: (note || '').trim().slice(0, 500) || null });
}
