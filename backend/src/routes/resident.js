import { Router } from 'express';
import { ISSUE_TYPES, ROLES, STATUS } from '../config.js';
import { db, transaction } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { photoUpload, removeUpload } from '../middleware/upload.js';
import { emitToAdmins, emitToUser } from '../services/notify.js';
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
router.use(requireAuth, requireRole(ROLES.RESIDENT));

function ownRequestOr404(id, user) {
  const request = getRequestOr404(id);
  if (request.resident_id !== user.id) throw new HttpError(404, 'Service request not found');
  return request;
}

/**
 * Create service request (multipart/form-data):
 *   photo (file), issue_type, description, latitude, longitude, address?
 * Implements the "Photo and location attached?" check: if either is missing
 * the request is refused with 422 so the app can ask the resident to complete details.
 */
router.post('/', photoUpload.single('photo'), (req, res) => {
  const photo = req.file?.filename;
  try {
    const issueType = req.body.issue_type?.trim();
    const description = req.body.description?.trim();
    const address = req.body.address?.trim() || null;
    const lat = Number.parseFloat(req.body.latitude);
    const lng = Number.parseFloat(req.body.longitude);

    const missing = [];
    if (!photo) missing.push('photo');
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180)
      missing.push('location');
    if (!issueType) missing.push('issue_type');
    if (!description) missing.push('description');
    if (missing.length) {
      throw new HttpError(422, 'Please complete the details of your report', { missing });
    }
    if (!ISSUE_TYPES.includes(issueType)) {
      throw new HttpError(422, 'Unknown issue type', { allowed: ISSUE_TYPES });
    }

    const id = transaction(() => {
      const { lastInsertRowid } = db
        .prepare(
          `INSERT INTO service_requests
             (resident_id, issue_type, description, photo_path, latitude, longitude, address, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(req.user.id, issueType, description, photo, lat, lng, address, STATUS.PENDING);
      recordHistory(lastInsertRowid, STATUS.PENDING, req.user.id, 'Report submitted');
      return lastInsertRowid;
    });

    const request = findRequest(id);
    emitToAdmins('request:new', request); // real-time dashboard update
    res.status(201).json({ request });
  } catch (err) {
    removeUpload(photo);
    throw err;
  }
});

router.get('/', (req, res) => {
  const { limit, offset } = parsePaging(req.query);
  const params = [req.user.id];
  let where = 'WHERE r.resident_id = ?';
  if (req.query.status) {
    where += ' AND r.status = ?';
    params.push(req.query.status);
  }
  res.json(listRequests(where, params, 'r.created_at DESC', limit, offset));
});

router.get('/:id', (req, res) => {
  const request = ownRequestOr404(req.params.id, req.user);
  res.json({ request, history: getHistory(request.id) });
});

// "Rate / give feedback" after the request is resolved.
router.post('/:id/feedback', (req, res) => {
  const request = ownRequestOr404(req.params.id, req.user);
  assertStatus(request, STATUS.RESOLVED);
  if (request.rating != null) throw new HttpError(409, 'Feedback was already submitted');

  const rating = Number(req.body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new HttpError(422, 'Rating must be a whole number from 1 to 5');
  }
  const feedback = req.body.feedback?.trim() || null;

  db.prepare(
    `UPDATE service_requests SET rating = ?, feedback = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(rating, feedback, request.id);

  const updated = findRequest(request.id);
  emitToAdmins('request:feedback', updated);
  if (updated.assigned_staff_id) emitToUser(updated.assigned_staff_id, 'request:updated', updated);
  res.json({ request: updated });
});

export default router;
