const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { dbGet, dbRun } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

const NO_GOLD_STORES = new Set([
  '10804','11284','10912','13074','10211','13121','10718','11631','11737','13149',
  '11543','10953','11486','11403','10781','13005','11092','11121','11370','10980','11145'
]);

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Введите логин и пароль' });
    }

    const user = await dbGet(`
      SELECT u.*, s.store_number, s.id as store_id
      FROM users u
      LEFT JOIN stores s ON s.director_id = u.id
      WHERE u.username = $1
    `, [username.trim()]);

    if (!user) return res.status(401).json({ error: 'Неверный логин или пароль' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Неверный логин или пароль' });

    await dbRun('INSERT INTO action_log (user_id, action) VALUES (?, ?)', [user.id, 'login']);

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, store_id: user.store_id },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        full_name: user.full_name,
        store_id: user.store_id,
        store_number: user.store_number,
        has_gold: !NO_GOLD_STORES.has(String(user.store_number)),
        profile_completed: user.profile_completed
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/login-store', async (req, res) => {
  try {
    const { store_number } = req.body;
    if (!store_number) return res.status(400).json({ error: 'Введите номер магазина' });

    const user = await dbGet(`
      SELECT u.*, s.store_number, s.id as store_id
      FROM users u
      JOIN stores s ON s.director_id = u.id
      WHERE s.store_number = $1 AND u.role = 'director'
    `, [String(store_number).trim()]);

    if (!user) return res.status(404).json({ error: 'Магазин не найден' });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, store_id: user.store_id },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        full_name: user.full_name,
        store_id: user.store_id,
        store_number: user.store_number,
        has_gold: !NO_GOLD_STORES.has(String(user.store_number)),
        profile_completed: user.profile_completed
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await dbGet(`
      SELECT u.id, u.username, u.role, u.full_name, u.profile_completed,
             s.store_number, s.id as store_id
      FROM users u
      LEFT JOIN stores s ON s.director_id = u.id
      WHERE u.id = ?
    `, [req.user.id]);
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
