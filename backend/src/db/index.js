import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

export const db = new DatabaseSync(config.dbPath);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS departments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT NOT NULL,
    email          TEXT UNIQUE,
    phone          TEXT UNIQUE,
    password_hash  TEXT NOT NULL,
    role           TEXT NOT NULL CHECK (role IN ('resident', 'admin', 'staff')),
    department_id  INTEGER REFERENCES departments(id),
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    CHECK (email IS NOT NULL OR phone IS NOT NULL)
  );

  CREATE TABLE IF NOT EXISTS service_requests (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    resident_id             INTEGER NOT NULL REFERENCES users(id),
    issue_type              TEXT NOT NULL,
    description             TEXT NOT NULL,
    photo_path              TEXT NOT NULL,
    latitude                REAL NOT NULL,
    longitude               REAL NOT NULL,
    address                 TEXT,
    category                TEXT,
    status                  TEXT NOT NULL DEFAULT 'Pending',
    assigned_department_id  INTEGER REFERENCES departments(id),
    assigned_staff_id       INTEGER REFERENCES users(id),
    rejection_reason        TEXT,
    rating                  INTEGER CHECK (rating BETWEEN 1 AND 5),
    feedback                TEXT,
    created_at              TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at              TEXT NOT NULL DEFAULT (datetime('now')),
    assigned_at             TEXT,
    resolved_at             TEXT,
    archived_at             TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_requests_status   ON service_requests(status);
  CREATE INDEX IF NOT EXISTS idx_requests_resident ON service_requests(resident_id);
  CREATE INDEX IF NOT EXISTS idx_requests_staff    ON service_requests(assigned_staff_id);

  -- Audit trail of every status change, shown as a timeline in the apps.
  CREATE TABLE IF NOT EXISTS request_history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id  INTEGER NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
    status      TEXT NOT NULL,
    note        TEXT,
    actor_id    INTEGER REFERENCES users(id),
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_id  INTEGER REFERENCES service_requests(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    message     TEXT NOT NULL,
    is_read     INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
`);

export function transaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
