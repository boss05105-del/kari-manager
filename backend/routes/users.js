const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../db/database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

// Admin: list all directors
router.get('/', authMiddleware, adminOnly, (req, res) => {
  const db = getDb();
  const users = db.prepare(`
    SELECT u.id, u.username, u.full_name, u.role, u.profile_completed, u.created_at,
           s.store_number, s.id as store_id
    FROM users u
    LEFT JOIN stores s ON s.director_id = u.id
    ORDER BY u.role, s.store_number
  `).all();
  res.json(users);
});

// Admin: delete director (unlinks from store, removes user)
router.delete('/:id', authMiddleware, adminOnly, (req, res) => {
  const db = getDb();
  const userId = parseInt(req.params.id);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  if (user.role === 'admin') return res.status(403).json({ error: 'Нельзя удалить администратора' });

  // Unlink from store
  db.prepare('UPDATE stores SET director_id = NULL WHERE director_id = ?').run(userId);
  // Remove push subscription
  db.prepare('DELETE FROM push_subscriptions WHERE user_id = ?').run(userId);
  // Remove user
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);

  db.prepare('INSERT INTO action_log (user_id, action, details) VALUES (?, ?, ?)').run(
    req.user.id, 'director_deleted', `Deleted user ${user.username} (${user.full_name})`
  );

  res.json({ ok: true });
});

// Admin: assign new director to store (reset, create fresh account)
router.post('/reset-director/:storeId', authMiddleware, adminOnly, async (req, res) => {
  const db = getDb();
  const storeId = parseInt(req.params.storeId);

  const store = db.prepare('SELECT * FROM stores WHERE id = ?').get(storeId);
  if (!store) return res.status(404).json({ error: 'Магазин не найден' });

  // Remove old director if exists
  if (store.director_id) {
    db.prepare('UPDATE stores SET director_id = NULL WHERE id = ?').run(storeId);
    db.prepare('DELETE FROM push_subscriptions WHERE user_id = ?').run(store.director_id);
    db.prepare('DELETE FROM users WHERE id = ?').run(store.director_id);
  }

  // Create new director account
  const username = `dir${store.store_number}`;
  const tempPassword = `store${store.store_number}`;
  const hashed = await bcrypt.hash(tempPassword, 10);

  db.prepare(`
    INSERT INTO users (username, password, role, full_name, store_id, profile_completed)
    VALUES (?, ?, 'director', ?, ?, 0)
  `).run(username, hashed, `Директор ${store.store_number}`, storeId);

  const newUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  db.prepare('UPDATE stores SET director_id = ? WHERE id = ?').run(newUser.id, storeId);

  res.json({ ok: true, username, temp_password: tempPassword });
});

// Director: complete profile setup (first login)
router.post('/setup-profile', authMiddleware, async (req, res) => {
  const db = getDb();
  const { full_name, new_password } = req.body;

  if (!full_name || full_name.trim().length < 5) {
    return res.status(400).json({ error: 'Введите полное ФИО (минимум 5 символов)' });
  }
  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
  }

  const hashed = await bcrypt.hash(new_password, 10);
  db.prepare(`
    UPDATE users SET full_name = ?, password = ?, profile_completed = 1 WHERE id = ?
  `).run(full_name.trim(), hashed, req.user.id);

  // Update store director name reference is via join — no separate column needed

  db.prepare('INSERT INTO action_log (user_id, action) VALUES (?, ?)').run(
    req.user.id, 'profile_setup'
  );

  res.json({ ok: true, full_name: full_name.trim() });
});

module.exports = router;
