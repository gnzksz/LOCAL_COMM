// Resident data layer (Spark plan: no Cloud Functions or Storage). This mirrors what the Android app will do.
import { createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import {
  collection, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, writeBatch,
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';
import { mapDoc } from './data.js';
import { auth, db, getProfile } from './firebase.js';

export { getPhoto, watchHistory, watchNotifications, watchRequest } from './data.js';

const AUTH_ERRORS = {
  'auth/email-already-in-use': 'That email is already registered',
  'auth/invalid-email': 'Enter a valid email address',
  'auth/weak-password': 'Password must be at least 6 characters',
};

/** Resident self-registration with email + password. */
export async function register({ name, email, password }) {
  const cleanName = (name || '').trim();
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanName) throw new Error('Name is required');
  let uid;
  try {
    uid = (await createUserWithEmailAndPassword(auth, cleanEmail, password)).user.uid;
  } catch (err) {
    throw new Error(AUTH_ERRORS[err.code] || err.message);
  }
  await setDoc(doc(db, 'users', uid), { name: cleanName, email: cleanEmail, role: 'resident', created_at: serverTimestamp() });
}

/** Live list of my reports, newest first. */
export function watchMyRequests(uid, cb) {
  return onSnapshot(
    query(collection(db, 'requests'), where('resident_id', '==', uid)),
    (snap) => cb(snap.docs.map(mapDoc).sort((a, b) => b.created_at.localeCompare(a.created_at))),
    (err) => cb([], err)
  );
}

export function watchMyNotifications(uid, cb) {
  return onSnapshot(
    query(collection(db, 'notifications'), where('user_id', '==', uid)),
    (snap) => cb(snap.docs.map(mapDoc).sort((a, b) => b.created_at.localeCompare(a.created_at))),
    () => cb([])
  );
}

export const markRead = (id) => updateDoc(doc(db, 'notifications', id), { is_read: true });

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
