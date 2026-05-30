const express = require('express');
const { dbAll, dbGet, dbRun } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const notifications = await dbAll(`
      SELECT * FROM notifications WHERE user_id = ?
      ORDER BY created_at DESC LIMIT 50
    `, [req.user.id]);
    res.json(notifications);
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/unread-count', authMiddleware, async (req, res) => {
  try {
    const row = await dbGet(
      'SELECT COUNT(*) as n FROM notifications WHERE user_id = ? AND is_read = 0',
      [req.user.id]
    );
    res.json({ count: parseInt(row.n) });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/:id/read', authMiddleware, async (req, res) => {
  try {
    await dbRun(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [parseInt(req.params.id), req.user.id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/read-all', authMiddleware, async (req, res) => {
  try {
    await dbRun('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
