// Staff data layer on top of Firestore (Spark plan: no Cloud Functions).
import { collection, onSnapshot, query, where } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';
import { mapDoc, requireStatus, writeStatusChange, serverTimestamp } from './data.js';
import { db, getProfile } from './firebase.js';

export { getPhoto, watchHistory, watchNotifications, watchRequest } from './data.js';

/** Live list of the reports assigned to this staff member, newest assignment first. */
export function watchAssignments(staffId, cb) {
  return onSnapshot(
    query(collection(db, 'requests'), where('assigned_staff_id', '==', staffId)),
    (snap) => cb(snap.docs.map(mapDoc).sort((a, b) => (b.assigned_at || '').localeCompare(a.assigned_at || ''))),
    (err) => cb([], err)
  );
}

async function ownRequest(id, ...statuses) {
  const r = await requireStatus(id, ...statuses);
  if (r.assigned_staff_id !== getProfile().id) throw new Error('This report is not assigned to you.');
  return r;
}

const trimmed = (note) => (note || '').trim().slice(0, 500) || null;

// Update progress: mark as In Progress, resident is notified
export async function startRequest(id, note) {
  const r = await ownRequest(id, 'Assigned');
  const text = trimmed(note);
  await writeStatusChange(r, { status: 'In Progress' }, {
    note: text,
    notify: {
      userId: r.resident_id,
      title: 'Your report is now In Progress',
      message: `Field personnel are now working on your report (${r.issue_type}).${text ? ` Note: ${text}` : ''}`,
    },
  });
}

// Complete the work: mark as Resolved, resident is notified and asked for feedback
export async function resolveRequest(id, note) {
  const r = await ownRequest(id, 'In Progress');
  const text = trimmed(note);
  await writeStatusChange(r, { status: 'Resolved', resolved_at: serverTimestamp() }, {
    note: text,
    notify: {
      userId: r.resident_id,
      title: 'Your report has been Resolved',
      message: `Your report (${r.issue_type}) has been resolved. Please rate the service and leave feedback.${text ? ` Note: ${text}` : ''}`,
    },
  });
}
