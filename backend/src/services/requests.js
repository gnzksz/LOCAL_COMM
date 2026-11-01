import { db } from '../db/index.js';
import { HttpError } from '../middleware/errors.js';

const SELECT_REQUEST = `
  SELECT r.*,
         res.name  AS resident_name,
         res.email AS resident_email,
         res.phone AS resident_phone,
         st.name   AS assigned_staff_name,
         d.name    AS assigned_department_name
    FROM service_requests r
    JOIN users res            ON res.id = r.resident_id
    LEFT JOIN users st        ON st.id  = r.assigned_staff_id
    LEFT JOIN departments d   ON d.id   = r.assigned_department_id`;

export function serialize(row) {
  if (!row) return row;
  return { ...row, photo_url: `/uploads/${row.photo_path}` };
}

export function findRequest(id) {
  return serialize(db.prepare(`${SELECT_REQUEST} WHERE r.id = ?`).get(id));
}

export function getRequestOr404(id) {
  const request = findRequest(Number(id));
  if (!request) throw new HttpError(404, 'Service request not found');
  return request;
}

export function listRequests(whereSql = '', params = [], orderSql = 'r.created_at DESC', limit = 50, offset = 0) {
  const rows = db
    .prepare(`${SELECT_REQUEST} ${whereSql} ORDER BY ${orderSql} LIMIT ? OFFSET ?`)
    .all(...params, limit, offset);
  const { total } = db
    .prepare(`SELECT COUNT(*) AS total FROM service_requests r ${whereSql}`)
    .get(...params);
  return { items: rows.map(serialize), total, limit, offset };
}

export function getHistory(requestId) {
  return db
    .prepare(
      `SELECT h.id, h.status, h.note, h.created_at, u.name AS actor_name, u.role AS actor_role
         FROM request_history h LEFT JOIN users u ON u.id = h.actor_id
        WHERE h.request_id = ? ORDER BY h.id`
    )
    .all(requestId);
}

const insertHistory = db.prepare(
  'INSERT INTO request_history (request_id, status, note, actor_id) VALUES (?, ?, ?, ?)'
);

export function recordHistory(requestId, status, actorId, note = null) {
  insertHistory.run(requestId, status, note, actorId);
}

/** Throw 409 unless the request is currently in one of the allowed statuses. */
export function assertStatus(request, ...allowed) {
  if (!allowed.includes(request.status)) {
    throw new HttpError(
      409,
      `Action not allowed while request is "${request.status}" (expected: ${allowed.join(' or ')})`
    );
  }
}

export function parsePaging(query) {
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);
  const offset = Math.max(Number(query.offset) || 0, 0);
  return { limit, offset };
}
