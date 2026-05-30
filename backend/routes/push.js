const express = require('express');
const webpush = require('web-push');
const { dbGet, dbRun } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const { getVapidKeys } = require('../utils/vapid');

const router = express.Router();

router.get('/vapid-public-key', (req, res) => {
  const keys = getVapidKeys();
  res.json({ publicKey: keys.publicKey });
});

router.post('/subscribe', authMiddleware, async (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'Неверные данные подписки' });
    }
    await dbRun(`
      INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET endpoint=EXCLUDED.endpoint, p256dh=EXCLUDED.p256dh, auth=EXCLUDED.auth
    `, [req.user.id, endpoint, keys.p256dh, keys.auth]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/subscribe', authMiddleware, async (req, res) => {
  try {
    await dbRun('DELETE FROM push_subscriptions WHERE user_id = ?', [req.user.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/status', authMiddleware, async (req, res) => {
  try {
    const sub = await dbGet('SELECT id FROM push_subscriptions WHERE user_id = ?', [req.user.id]);
    res.json({ subscribed: !!sub });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;

async function sendPushToUser(userId, title, body, data = {}) {
  const sub = await dbGet('SELECT * FROM push_subscriptions WHERE user_id = ?', [userId]);
  if (!sub) return false;
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify({ title, body, icon: '/favicon.svg', badge: '/favicon.svg', data })
    );
    return true;
  } catch (err) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      await dbRun('DELETE FROM push_subscriptions WHERE user_id = ?', [userId]);
    }
    return false;
  }
}

module.exports.sendPushToUser = sendPushToUser;
