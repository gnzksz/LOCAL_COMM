import bcrypt from 'bcryptjs';
import { db } from './index.js';

const DEPARTMENTS = [
  'Sanitation',
  'Public Works / Engineering',
  'Electrical',
  'Water & Drainage',
  'Peace & Order',
];

const insertDept = db.prepare('INSERT OR IGNORE INTO departments (name) VALUES (?)');
for (const name of DEPARTMENTS) insertDept.run(name);

const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@localcomm.test';
const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'admin123';

if (!db.prepare('SELECT 1 FROM users WHERE email = ?').get(adminEmail)) {
  db.prepare(
    `INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')`
  ).run('System Administrator', adminEmail, bcrypt.hashSync(adminPassword, 10));
  console.log(`Created admin account: ${adminEmail} / ${adminPassword}`);
} else {
  console.log(`Admin account already exists: ${adminEmail}`);
}

console.log(`Departments: ${DEPARTMENTS.join(', ')}`);
