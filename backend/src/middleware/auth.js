import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { HttpError } from './errors.js';

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

export function verifyToken(token) {
  const payload = jwt.verify(token, config.jwtSecret);
  const user = db
    .prepare('SELECT id, name, email, phone, role, department_id FROM users WHERE id = ?')
    .get(payload.sub);
  if (!user) throw new Error('User no longer exists');
  return user;
}

export function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Authentication required'));
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    next(new HttpError(401, 'Invalid or expired token'));
  }
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!roles.includes(req.user?.role)) {
      return next(new HttpError(403, 'You do not have access to this resource'));
    }
    next();
  };
}
