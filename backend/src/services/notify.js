import { db } from '../db/index.js';

let io = null;

export function attachSocket(server) {
  io = server;
}

const insertNotification = db.prepare(
  `INSERT INTO notifications (user_id, request_id, title, message) VALUES (?, ?, ?, ?)
   RETURNING *`
);

/** Store a notification for a user and push it live if they are connected. */
export function notifyUser(userId, { requestId = null, title, message }) {
  const row = insertNotification.get(userId, requestId, title, message);
  io?.to(`user:${userId}`).emit('notification', row);
  return row;
}

/** Push a live event to every connected admin dashboard. */
export function emitToAdmins(event, payload) {
  io?.to('role:admin').emit(event, payload);
}

/** Push a live event to a specific user (e.g. staff dashboard refresh). */
export function emitToUser(userId, event, payload) {
  io?.to(`user:${userId}`).emit(event, payload);
}
