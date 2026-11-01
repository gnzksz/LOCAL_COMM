import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { ROLES } from '../config.js';
import { db } from '../db/index.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';

const router = Router();

const clean = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const normalizeEmail = (v) => clean(v)?.toLowerCase() ?? null;

function publicUser(u) {
  const { password_hash, ...rest } = u;
  return rest;
}

// Resident self-registration (mobile app) using email or phone number.
router.post('/register', (req, res) => {
  const name = clean(req.body.name);
  const email = normalizeEmail(req.body.email);
  const phone = clean(req.body.phone);
  const password = req.body.password;

  const errors = {};
  if (!name) errors.name = 'Name is required';
  if (!email && !phone) errors.contact = 'Email or phone number is required';
  if (email && !/^\S+@\S+\.\S+$/.test(email)) errors.email = 'Invalid email address';
  if (phone && !/^\+?\d{10,13}$/.test(phone)) errors.phone = 'Invalid phone number';
  if (typeof password !== 'string' || password.length < 6)
    errors.password = 'Password must be at least 6 characters';
  if (Object.keys(errors).length) throw new HttpError(422, 'Invalid registration details', errors);

  const taken = db
    .prepare('SELECT 1 FROM users WHERE email = ? OR phone = ?')
    .get(email, phone);
  if (taken) throw new HttpError(409, 'Email or phone number is already registered');

  const user = db
    .prepare(
      `INSERT INTO users (name, email, phone, password_hash, role)
       VALUES (?, ?, ?, ?, ?) RETURNING *`
    )
    .get(name, email, phone, bcrypt.hashSync(password, 10), ROLES.RESIDENT);

  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

// Shared login for all roles. `identifier` may be an email or a phone number.
router.post('/login', (req, res) => {
  const identifier = clean(req.body.identifier);
  const password = req.body.password;
  if (!identifier || typeof password !== 'string') {
    throw new HttpError(422, 'Email/phone and password are required');
  }

  const user = db
    .prepare('SELECT * FROM users WHERE email = ? OR phone = ?')
    .get(identifier.toLowerCase(), identifier);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    throw new HttpError(401, 'Incorrect email/phone or password');
  }

  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
