const express = require('express');
const { getDb } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, (req, res) => {
  const db = getDb();
  const notifications = db.prepare(`
    SELECT * FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(req.user.id);
  res.json(notifications);
});

router.get('/unread-count', authMiddleware, (req, res) => {
  const db = getDb();
  const { n } = db.prepare(
    'SELECT COUNT(*) as n FROM notifications WHERE user_id = ? AND is_read = 0'
  ).get(req.user.id);
  res.json({ count: n });
});

router.put('/:id/read', authMiddleware, (req, res) => {
  const db = getDb();
  db.prepare(
    'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?'
  ).run(parseInt(req.params.id), req.user.id);
  res.json({ ok: true });
});

router.put('/read-all', authMiddleware, (req, res) => {
  const db = getDb();
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});

module.exports = router;
