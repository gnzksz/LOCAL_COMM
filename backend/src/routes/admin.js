import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { ROLES, STATUS } from '../config.js';
import { db, transaction } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { emitToAdmins, emitToUser, notifyUser } from '../services/notify.js';
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
router.use(requireAuth, requireRole(ROLES.ADMIN));

const SORTS = {
  newest: 'r.created_at DESC',
  oldest: 'r.created_at ASC',
  updated: 'r.updated_at DESC',
  status: 'r.status ASC, r.created_at DESC',
  issue_type: 'r.issue_type ASC, r.created_at DESC',
};

// ---- Review reports: view details, categorize, sort, filter -------------------------

router.get('/requests', (req, res) => {
  const { limit, offset } = parsePaging(req.query);
  const conditions = [];
  const params = [];
  const filters = {
    status: 'r.status = ?',
    issue_type: 'r.issue_type = ?',
    category: 'r.category = ?',
    department_id: 'r.assigned_department_id = ?',
    staff_id: 'r.assigned_staff_id = ?',
    from: 'date(r.created_at) >= date(?)',
    to: 'date(r.created_at) <= date(?)',
  };
  for (const [key, sql] of Object.entries(filters)) {
    if (req.query[key]) {
      conditions.push(sql);
      params.push(req.query[key]);
    }
  }
  if (req.query.q) {
    conditions.push('(r.description LIKE ? OR r.address LIKE ? OR CAST(r.id AS TEXT) = ?)');
    params.push(`%${req.query.q}%`, `%${req.query.q}%`, req.query.q);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const order = SORTS[req.query.sort] || SORTS.newest;
  res.json(listRequests(where, params, order, limit, offset));
});

router.get('/requests/:id', (req, res) => {
  const request = getRequestOr404(req.params.id);
  res.json({ request, history: getHistory(request.id) });
});

// Categorize a report (label used for sorting/filtering on the dashboard).
router.patch('/requests/:id', (req, res) => {
  const request = getRequestOr404(req.params.id);
  const category = req.body.category?.trim() || null;
  db.prepare(
    `UPDATE service_requests SET category = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(category, request.id);
  res.json({ request: findRequest(request.id) });
});

// ---- Valid report? -> No: reject / flag and notify resident -----------------------

router.post('/requests/:id/reject', (req, res) => {
  const request = getRequestOr404(req.params.id);
  assertStatus(request, STATUS.PENDING);
  const reason = req.body.reason?.trim();
  if (!reason) throw new HttpError(422, 'A reason is required when rejecting a report');

  transaction(() => {
    db.prepare(
      `UPDATE service_requests
          SET status = ?, rejection_reason = ?, updated_at = datetime('now')
        WHERE id = ?`
    ).run(STATUS.REJECTED, reason, request.id);
    recordHistory(request.id, STATUS.REJECTED, req.user.id, reason);
  });

  notifyUser(request.resident_id, {
    requestId: request.id,
    title: 'Report rejected / flagged',
    message: `Your report #${request.id} (${request.issue_type}) was not accepted: ${reason}`,
  });

  const updated = findRequest(request.id);
  emitToAdmins('request:updated', updated);
  res.json({ request: updated });
});

// ---- Valid report? -> Yes: assign to department / field personnel -----------------

router.post('/requests/:id/assign', (req, res) => {
  const request = getRequestOr404(req.params.id);
  // Re-assignment is allowed until the staff starts working on it.
  assertStatus(request, STATUS.PENDING, STATUS.ASSIGNED);

  const staff = db
    .prepare(`SELECT id, name, department_id FROM users WHERE id = ? AND role = 'staff'`)
    .get(Number(req.body.staff_id));
  if (!staff) throw new HttpError(422, 'staff_id must refer to an existing staff account');
  if (!staff.department_id) throw new HttpError(422, 'This staff member has no department');

  const category = req.body.category?.trim() || request.category;
  const note = req.body.note?.trim() || `Assigned to ${staff.name}`;
  const previousStaffId = request.assigned_staff_id;

  transaction(() => {
    db.prepare(
      `UPDATE service_requests
          SET status = ?, assigned_staff_id = ?, assigned_department_id = ?, category = ?,
              assigned_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?`
    ).run(STATUS.ASSIGNED, staff.id, staff.department_id, category, request.id);
    recordHistory(request.id, STATUS.ASSIGNED, req.user.id, note);
  });

  const updated = findRequest(request.id);
  notifyUser(staff.id, {
    requestId: request.id,
    title: 'New assignment',
    message: `You have been assigned report #${request.id}: ${request.issue_type}`,
  });
  if (previousStaffId && previousStaffId !== staff.id) {
    emitToUser(previousStaffId, 'request:unassigned', { id: request.id });
  }
  emitToAdmins('request:updated', updated);
  res.json({ request: updated });
});

// ---- Archive completed request ---------------------------------------------------

router.post('/requests/:id/archive', (req, res) => {
  const request = getRequestOr404(req.params.id);
  assertStatus(request, STATUS.RESOLVED);

  transaction(() => {
    db.prepare(
      `UPDATE service_requests
          SET status = ?, archived_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?`
    ).run(STATUS.ARCHIVED, request.id);
    recordHistory(request.id, STATUS.ARCHIVED, req.user.id, req.body.note?.trim() || null);
  });

  const updated = findRequest(request.id);
  emitToAdmins('request:updated', updated);
  res.json({ request: updated });
});

// ---- View summary reports --------------------------------------------------------

router.get('/reports/summary', (req, res) => {
  const range = [];
  const params = [];
  if (req.query.from) {
    range.push('date(r.created_at) >= date(?)');
    params.push(req.query.from);
  }
  if (req.query.to) {
    range.push('date(r.created_at) <= date(?)');
    params.push(req.query.to);
  }
  const where = range.length ? `WHERE ${range.join(' AND ')}` : '';
  const joinRange = range.length ? `AND ${range.join(' AND ')}` : '';

  const totals = db
    .prepare(
      `SELECT COUNT(*) AS total,
              ROUND(AVG(r.rating), 2) AS average_rating,
              COUNT(r.rating) AS rated,
              ROUND(AVG(CASE WHEN r.resolved_at IS NOT NULL
                  THEN (julianday(r.resolved_at) - julianday(r.created_at)) * 24 END), 1)
                AS average_resolution_hours
         FROM service_requests r ${where}`
    )
    .get(...params);

  const byStatus = db
    .prepare(`SELECT r.status, COUNT(*) AS count FROM service_requests r ${where} GROUP BY r.status`)
    .all(...params);

  const byIssueType = db
    .prepare(
      `SELECT r.issue_type, COUNT(*) AS count FROM service_requests r ${where}
        GROUP BY r.issue_type ORDER BY count DESC`
    )
    .all(...params);

  const byDepartment = db
    .prepare(
      `SELECT d.id, d.name,
              COUNT(r.id) AS assigned,
              COALESCE(SUM(r.status IN ('Resolved', 'Archived')), 0) AS resolved,
              ROUND(AVG(r.rating), 2) AS average_rating
         FROM departments d
         LEFT JOIN service_requests r ON r.assigned_department_id = d.id ${joinRange}
        GROUP BY d.id ORDER BY d.name`
    )
    .all(...params);

  res.json({ totals, byStatus, byIssueType, byDepartment });
});

// ---- Departments & staff accounts -------------------------------------------------

router.get('/departments', (_req, res) => {
  res.json({ items: db.prepare('SELECT * FROM departments ORDER BY name').all() });
});

router.post('/departments', (req, res) => {
  const name = req.body.name?.trim();
  if (!name) throw new HttpError(422, 'Department name is required');
  if (db.prepare('SELECT 1 FROM departments WHERE name = ?').get(name)) {
    throw new HttpError(409, 'Department already exists');
  }
  const department = db.prepare('INSERT INTO departments (name) VALUES (?) RETURNING *').get(name);
  res.status(201).json({ department });
});

router.get('/staff', (req, res) => {
  const params = [];
  let where = `WHERE u.role = 'staff'`;
  if (req.query.department_id) {
    where += ' AND u.department_id = ?';
    params.push(req.query.department_id);
  }
  const items = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.phone, u.department_id, d.name AS department_name,
              (SELECT COUNT(*) FROM service_requests r
                WHERE r.assigned_staff_id = u.id AND r.status IN ('Assigned', 'In Progress'))
                AS active_requests
         FROM users u LEFT JOIN departments d ON d.id = u.department_id
         ${where} ORDER BY u.name`
    )
    .all(...params);
  res.json({ items });
});

router.post('/staff', (req, res) => {
  const name = req.body.name?.trim();
  const email = req.body.email?.trim().toLowerCase() || null;
  const phone = req.body.phone?.trim() || null;
  const password = req.body.password;
  const departmentId = Number(req.body.department_id);

  if (!name || (!email && !phone) || typeof password !== 'string' || password.length < 6) {
    throw new HttpError(422, 'Name, email or phone, and a password (min 6 chars) are required');
  }
  if (!db.prepare('SELECT 1 FROM departments WHERE id = ?').get(departmentId)) {
    throw new HttpError(422, 'department_id must refer to an existing department');
  }
  if (db.prepare('SELECT 1 FROM users WHERE email = ? OR phone = ?').get(email, phone)) {
    throw new HttpError(409, 'Email or phone number is already registered');
  }

  const staff = db
    .prepare(
      `INSERT INTO users (name, email, phone, password_hash, role, department_id)
       VALUES (?, ?, ?, ?, 'staff', ?)
       RETURNING id, name, email, phone, role, department_id, created_at`
    )
    .get(name, email, phone, bcrypt.hashSync(password, 10), departmentId);
  res.status(201).json({ staff });
});

export default router;
