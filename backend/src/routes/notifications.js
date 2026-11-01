import { Router } from 'express';
import { db } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { parsePaging } from '../services/requests.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const { limit, offset } = parsePaging(req.query);
  const unreadOnly = req.query.unread === 'true' ? 'AND is_read = 0' : '';
  const items = db
    .prepare(
      `SELECT * FROM notifications WHERE user_id = ? ${unreadOnly}
        ORDER BY id DESC LIMIT ? OFFSET ?`
    )
    .all(req.user.id, limit, offset);
  const { unread } = db
    .prepare('SELECT COUNT(*) AS unread FROM notifications WHERE user_id = ? AND is_read = 0')
    .get(req.user.id);
  res.json({ items, unread });
});

router.post('/read-all', (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});

router.post('/:id/read', (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(
    Number(req.params.id),
    req.user.id
  );
  res.json({ ok: true });
});

export default router;
