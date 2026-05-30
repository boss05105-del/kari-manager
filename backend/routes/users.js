const express = require('express');
const bcrypt = require('bcryptjs');
const { dbGet, dbAll, dbRun } = require('../db/database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const users = await dbAll(`
      SELECT u.id, u.username, u.full_name, u.role, u.profile_completed, u.created_at,
             s.store_number, s.id as store_id
      FROM users u
      LEFT JOIN stores s ON s.director_id = u.id
      ORDER BY u.role, s.store_number
    `);
    res.json(users);
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    if (user.role === 'admin') return res.status(403).json({ error: 'Нельзя удалить администратора' });

    await dbRun('UPDATE stores SET director_id = NULL WHERE director_id = ?', [userId]);
    await dbRun('DELETE FROM push_subscriptions WHERE user_id = ?', [userId]);
    await dbRun('DELETE FROM users WHERE id = ?', [userId]);
    await dbRun('INSERT INTO action_log (user_id, action, details) VALUES (?, ?, ?)', [
      req.user.id, 'director_deleted', `Deleted user ${user.username} (${user.full_name})`
    ]);

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/reset-director/:storeId', authMiddleware, adminOnly, async (req, res) => {
  try {
    const storeId = parseInt(req.params.storeId);
    const store = await dbGet('SELECT * FROM stores WHERE id = ?', [storeId]);
    if (!store) return res.status(404).json({ error: 'Магазин не найден' });

    if (store.director_id) {
      await dbRun('UPDATE stores SET director_id = NULL WHERE id = ?', [storeId]);
      await dbRun('DELETE FROM push_subscriptions WHERE user_id = ?', [store.director_id]);
      await dbRun('DELETE FROM users WHERE id = ?', [store.director_id]);
    }

    const username = `dir${store.store_number}`;
    const tempPassword = `store${store.store_number}`;
    const hashed = await bcrypt.hash(tempPassword, 10);

    await dbRun(`
      INSERT INTO users (username, password, role, full_name, store_id, profile_completed)
      VALUES (?, ?, 'director', ?, ?, 0)
    `, [username, hashed, `Директор ${store.store_number}`, storeId]);

    const newUser = await dbGet('SELECT id FROM users WHERE username = ?', [username]);
    await dbRun('UPDATE stores SET director_id = ? WHERE id = ?', [newUser.id, storeId]);

    res.json({ ok: true, username, temp_password: tempPassword });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/setup-profile', authMiddleware, async (req, res) => {
  try {
    const { full_name, new_password } = req.body;
    if (!full_name || full_name.trim().length < 5) {
      return res.status(400).json({ error: 'Введите полное ФИО (минимум 5 символов)' });
    }
    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
    }

    const hashed = await bcrypt.hash(new_password, 10);
    await dbRun('UPDATE users SET full_name = ?, password = ?, profile_completed = 1 WHERE id = ?', [
      full_name.trim(), hashed, req.user.id
    ]);
    await dbRun('INSERT INTO action_log (user_id, action) VALUES (?, ?)', [req.user.id, 'profile_setup']);

    res.json({ ok: true, full_name: full_name.trim() });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
