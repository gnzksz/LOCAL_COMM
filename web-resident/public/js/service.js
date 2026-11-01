// Resident data layer (Spark plan: no Cloud Functions or Storage). This mirrors what the Android app will do.
import {
  collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where, writeBatch,
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';
import { mapDoc } from './data.js';
import { db, getProfile } from './firebase.js';

export { getPhoto, watchHistory, watchRequest } from './data.js';

/** Live list of my reports, newest first. */
export function watchMyRequests(uid, cb) {
  return onSnapshot(
    query(collection(db, 'requests'), where('resident_id', '==', uid)),
    (snap) => cb(snap.docs.map(mapDoc).sort((a, b) => b.created_at.localeCompare(a.created_at))),
    (err) => cb([], err)
  );
}

// ---- Notifications: ONE live listener shared by the sidebar badge, the toasts and the Notifications page ----
// Every notification has is_read (false until the resident sees it). The badge is the number of unread ones,
// counted from this live list, so it always matches the database (also after a refresh or a new sign-in).

let store = null; // { uid, items, ready, subs, unsub }

/**
 * `cb(list, added)` runs now (when data is ready) and on every change. `list` is newest first;
 * `added` holds notifications that arrived after the first load (used for toasts). Returns an unsubscribe.
 */
export function subscribeNotifications(uid, cb) {
  if (!store || store.uid !== uid) {
    store?.unsub();
    const mine = { uid, items: [], ready: false, subs: new Set(), unsub: () => {} };
    store = mine;
    mine.unsub = onSnapshot(
      query(collection(db, 'notifications'), where('user_id', '==', uid)),
      (snap) => {
        const added = mine.ready ? snap.docChanges().filter((c) => c.type === 'added').map((c) => mapDoc(c.doc)) : [];
        mine.items = snap.docs.map(mapDoc).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
        mine.ready = true;
        mine.subs.forEach((fn) => fn(mine.items, added));
      },
      () => {}
    );
  }
  const mine = store;
  mine.subs.add(cb);
  if (mine.ready) cb(mine.items, []);
  return () => mine.subs.delete(cb);
}

export const unreadCount = (list) => list.filter((n) => !n.is_read).length;

const READ = () => ({ is_read: true, read_at: serverTimestamp() });

export const markNotificationRead = (id) => updateDoc(doc(db, 'notifications', id), READ());

/** Mark every unread notification in `list` as read in one batch (read ones are kept, only styled differently). */
export async function markAllNotificationsRead(list) {
  const unread = list.filter((n) => !n.is_read);
  if (!unread.length) return;
  const batch = writeBatch(db);
  unread.forEach((n) => batch.update(doc(db, 'notifications', n.id), READ()));
  await batch.commit();
}

// ---- Photo compression ------------------------------------------------------------------------
// Photos are stored in Firestore as JPEG data URLs: the full photo (max ~800 000 chars) and a tiny thumbnail.

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => reject(new Error('That file is not a readable image'));
    img.src = url;
  });
}

function toDataUrl(img, maxSide, quality) {
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

export async function compressPhoto(file) {
  const img = await loadImage(file);
  let photo = '';
  for (const [side, quality] of [[1024, 0.7], [900, 0.6], [768, 0.5], [640, 0.45]]) {
    photo = toDataUrl(img, side, quality);
    if (photo.length <= 700000) break;
  }
  if (photo.length > 800000) throw new Error('Photo is too large even after compressing. Try another photo.');
  return { photo, thumb: toDataUrl(img, 96, 0.6) };
}

// ---- Submit a report ---------------------------------------------------------------------------

/** One batch: the request, its full photo and the first history entry. The rules refuse it without photo and location. */
export async function submitReport({ issue_type, description, address, latitude, longitude, photo, thumb }) {
  const me = getProfile();
  const batch = writeBatch(db);
  const ref = doc(collection(db, 'requests'));
  batch.set(ref, {
    resident_id: me.id,
    resident_name: me.name,
    resident_email: me.email,
    issue_type,
    description: description.trim(),
    thumb,
    latitude,
    longitude,
    address: (address || '').trim() || null,
    category: null,
    status: 'Pending',
    assigned_staff_id: null,
    assigned_staff_name: null,
    assigned_department_id: null,
    assigned_department_name: null,
    rejection_reason: null,
    rating: null,
    feedback: null,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    assigned_at: null,
    resolved_at: null,
    archived_at: null,
  });
  batch.set(doc(ref, 'photo', 'main'), { data: photo });
  batch.set(doc(collection(ref, 'history')), {
    status: 'Pending',
    note: 'Report submitted',
    actor_id: me.id,
    actor_name: me.name,
    actor_role: 'resident',
    created_at: serverTimestamp(),
  });
  try {
    await batch.commit();
  } catch (err) {
    if (err.code === 'permission-denied') throw new Error('The report was refused. Make sure the photo, location, issue type and description are all filled in.');
    throw err;
  }
  return ref.id;
}

/** "Rate / give feedback" once the report is Resolved (only possible once). */
export async function submitFeedback(id, rating, feedback) {
  try {
    await updateDoc(doc(db, 'requests', id), {
      rating,
      feedback: (feedback || '').trim().slice(0, 1000) || null,
      updated_at: serverTimestamp(),
    });
  } catch (err) {
    if (err.code === 'permission-denied') throw new Error('Feedback can only be sent once, after the report is Resolved.');
    throw err;
  }
}

/** The three numbers on the profile page of a resident (live). */
export function watchProfileStats(uid, cb) {
  return watchMyRequests(uid, (list) => {
    const n = (...s) => list.filter((r) => s.includes(r.status)).length;
    cb([
      { label: 'Total reports', value: list.length, tone: 'blue', icon: 'clipboard' },
      { label: 'Pending', value: n('Pending'), tone: 'amber', icon: 'clock' },
      { label: 'Resolved', value: n('Resolved', 'Archived'), tone: 'green', icon: 'check' },
    ]);
  });
}
