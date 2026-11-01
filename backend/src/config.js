import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

if (!process.env.JWT_SECRET) {
  console.warn('[config] JWT_SECRET is not set; using an insecure development secret.');
}

export const config = {
  port: Number(process.env.PORT) || 4000,
  jwtSecret: process.env.JWT_SECRET || 'dev-only-insecure-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  dbPath: path.resolve(root, process.env.DB_PATH || './data/local_comm.db'),
  uploadDir: path.resolve(root, process.env.UPLOAD_DIR || './uploads'),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  maxPhotoBytes: 5 * 1024 * 1024,
};

export const ROLES = Object.freeze({
  RESIDENT: 'resident',
  ADMIN: 'admin',
  STAFF: 'staff',
});

// Lifecycle of a service request (see flow diagram):
// Pending -> Rejected (admin: invalid report)
// Pending -> Assigned -> In Progress -> Resolved -> Archived
export const STATUS = Object.freeze({
  PENDING: 'Pending',
  REJECTED: 'Rejected',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  ARCHIVED: 'Archived',
});

export const ISSUE_TYPES = Object.freeze([
  'Garbage / Waste Collection',
  'Road Damage / Potholes',
  'Streetlight',
  'Drainage / Flooding',
  'Water Supply',
  'Noise / Disturbance',
  'Stray Animals',
  'Other',
]);
