import { Router } from 'express';
import { ROLES, STATUS } from '../config.js';
import { db, transaction } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { emitToAdmins, notifyUser } from '../services/notify.js';
import {
  assertStatus,
  findRequest,
  getHistory,
  getRequestOr404,
  listRequests,
  parsePaging,
  recordHistory,
} from '../services/requests.js';

const router = Router();
router.use(requireAuth, requireRole(ROLES.STAFF));

function assignedRequestOr404(id, user) {
  const request = getRequestOr404(id);
  if (request.assigned_staff_id !== user.id) throw new HttpError(404, 'Service request not found');
  return request;
}

/** Move an assigned request to a new status, then notify the resident and admins. */
function transition(req, { from, to, timestampColumn, title, message }) {
  const request = assignedRequestOr404(req.params.id, req.user);
  assertStatus(request, from);
  const note = req.body.note?.trim() || null;
  const extra = timestampColumn ? `, ${timestampColumn} = datetime('now')` : '';

  transaction(() => {
    db.prepare(
      `UPDATE service_requests SET status = ?, updated_at = datetime('now')${extra} WHERE id = ?`
    ).run(to, request.id);
    recordHistory(request.id, to, req.user.id, note);
  });

  notifyUser(request.resident_id, {
    requestId: request.id,
    title,
    message: message(request) + (note ? ` Note: ${note}` : ''),
  });
  const updated = findRequest(request.id);
  emitToAdmins('request:updated', updated);
  return updated;
}

// View assigned reports: description, photo, location.
router.get('/requests', (req, res) => {
  const { limit, offset } = parsePaging(req.query);
  const params = [req.user.id];
  let where = 'WHERE r.assigned_staff_id = ?';
  if (req.query.status) {
    where += ' AND r.status = ?';
    params.push(req.query.status);
  }
  res.json(listRequests(where, params, 'r.assigned_at DESC', limit, offset));
});

router.get('/requests/:id', (req, res) => {
  const request = assignedRequestOr404(req.params.id, req.user);
  res.json({ request, history: getHistory(request.id) });
});

// Update progress: mark as In Progress.
router.post('/requests/:id/start', (req, res) => {
  const request = transition(req, {
    from: STATUS.ASSIGNED,
    to: STATUS.IN_PROGRESS,
    title: 'Your report is now In Progress',
    message: (r) => `Field personnel are now working on report #${r.id} (${r.issue_type}).`,
  });
  res.json({ request });
});

// Complete the work: mark as Resolved.
router.post('/requests/:id/resolve', (req, res) => {
  const request = transition(req, {
    from: STATUS.IN_PROGRESS,
    to: STATUS.RESOLVED,
    timestampColumn: 'resolved_at',
    title: 'Your report has been Resolved',
    message: (r) =>
      `Report #${r.id} (${r.issue_type}) has been resolved. Please rate the service and leave feedback.`,
  });
  res.json({ request });
});

export default router;
