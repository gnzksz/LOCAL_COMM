// Firestore helpers shared by the admin and staff portals.
import {
  collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where, writeBatch,
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';
import { db, getProfile } from './firebase.js';

/** Firestore doc -> plain object with id and ISO date strings (every `*_at` field). */
export function mapDoc(d) {
  const data = d.data();
  const out = { ...data, id: d.id };
  for (const key of Object.keys(data)) {
    if (key.endsWith('_at')) out[key] = data[key]?.toDate ? data[key].toDate().toISOString() : data[key] ?? null;
  }
  return out;
}

const friendly = (err) =>
  err.code === 'permission-denied' ? new Error('You do not have access to this data.') : err;

/** Live view of one request. `cb(request | null, error?)`; returns an unsubscribe function. */
export function watchRequest(id, cb) {
  return onSnapshot(
    doc(db, 'requests', id),
    (snap) => cb(snap.exists() ? mapDoc(snap) : null),
    (err) => cb(null, friendly(err))
  );
}

/** Live status history of one request, oldest first. */
export function watchHistory(id, cb) {
  return onSnapshot(
    query(collection(db, 'requests', id, 'history'), orderBy('created_at')),
    (snap) => cb(snap.docs.map(mapDoc)),
    (err) => cb([], friendly(err))
  );
}

/** Full-size photo (a data URL), stored apart from the request so lists stay light. */
const photoCache = new Map();
export async function getPhoto(requestId) {
  if (photoCache.has(requestId)) return photoCache.get(requestId);
  const snap = await getDoc(doc(db, 'requests', requestId, 'photo', 'main'));
  const data = snap.exists() ? snap.get('data') : null;
  if (data) photoCache.set(requestId, data);
  return data;
}

/**
 * Live notifications for a user. `cb` is called only for notifications that arrive after
 * the first load (used for toasts).
 */
export function watchNotifications(userId, cb) {
  let first = true;
  return onSnapshot(
    query(collection(db, 'notifications'), where('user_id', '==', userId)),
    (snap) => {
      if (!first) snap.docChanges().filter((c) => c.type === 'added').forEach((c) => cb(mapDoc(c.doc)));
      first = false;
    },
    () => {}
  );
}

// ---- Status changes -----------------------------------------------------------------------
// Without Cloud Functions the browser writes the change itself: one batch containing the request
// update, a history entry and (optionally) a notification. firestore.rules only accepts the batch
// if it follows the flow, so these helpers cannot be used to skip a step.

/**
 * Apply `patch` to a request and record it. Everything is committed atomically.
 * @param {object} request  current request (needs id and status)
 * @param {object} patch    fields to change (include `status` when the status changes)
 * @param {{note?: string, notify?: {userId: string, title: string, message: string}}} extra
 */
export async function writeStatusChange(request, patch, { note = null, notify = null } = {}) {
  const actor = getProfile();
  const batch = writeBatch(db);
  const ref = doc(db, 'requests', request.id);

  batch.update(ref, { ...patch, updated_at: serverTimestamp() });

  if (patch.status) {
    batch.set(doc(collection(ref, 'history')), {
      status: patch.status,
      note: note || null,
      actor_id: actor.id,
      actor_name: actor.name,
      actor_role: actor.role,
      created_at: serverTimestamp(),
    });
  }
  if (notify) {
    batch.set(doc(collection(db, 'notifications')), {
      user_id: notify.userId,
      request_id: request.id,
      from_id: actor.id,
      title: notify.title,
      message: notify.message,
      is_read: false,
      created_at: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (err) {
    if (err.code === 'permission-denied') {
      throw new Error('That action is not allowed right now. The report may have just changed, so check its status and try again.');
    }
    throw err;
  }
}

/** Read the request fresh and make sure it is in one of the expected statuses. */
export async function requireStatus(id, ...allowed) {
  const snap = await getDoc(doc(db, 'requests', id));
  if (!snap.exists()) throw new Error('Service request not found');
  const request = mapDoc(snap);
  if (!allowed.includes(request.status)) {
    throw new Error(`Action not allowed while request is "${request.status}" (expected: ${allowed.join(' or ')})`);
  }
  return request;
}

/** Validate and clean the contact fields of a form: { name, phone, address }. */
export function contactPatch({ name, phone, address }) {
  const clean = (name || '').trim();
  if (!clean) throw new Error('Name is required');
  return {
    name: clean.slice(0, 100),
    phone: (phone || '').trim().slice(0, 30) || null,
    address: (address || '').trim().slice(0, 200) || null,
  };
}

/** Update a user document (the rules decide who may change what). */
export async function saveUser(id, patch) {
  try {
    await updateDoc(doc(db, 'users', id), patch);
  } catch (err) {
    if (err.code === 'permission-denied') {
      throw new Error('That change is not allowed. If this keeps happening, publish the latest rules (npm run deploy in the firebase folder).');
    }
    throw err;
  }
}

export { serverTimestamp };
