const express = require('express');
const webpush = require('web-push');
const { getDb } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const { getVapidKeys } = require('../utils/vapid');

const router = express.Router();

// Get public VAPID key for frontend
router.get('/vapid-public-key', (req, res) => {
  const keys = getVapidKeys();
  res.json({ publicKey: keys.publicKey });
});

// Subscribe to push notifications
router.post('/subscribe', authMiddleware, (req, res) => {
  const db = getDb();
  const { endpoint, keys } = req.body;

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: 'Неверные данные подписки' });
  }

  db.prepare(`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET endpoint=excluded.endpoint, p256dh=excluded.p256dh, auth=excluded.auth
  `).run(req.user.id, endpoint, keys.p256dh, keys.auth);

  res.json({ ok: true });
});

// Unsubscribe
router.delete('/subscribe', authMiddleware, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM push_subscriptions WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});

// Check subscription status
router.get('/status', authMiddleware, (req, res) => {
  const db = getDb();
  const sub = db.prepare('SELECT id FROM push_subscriptions WHERE user_id = ?').get(req.user.id);
  res.json({ subscribed: !!sub });
});

module.exports = router;

// Helper to send push to a user
async function sendPushToUser(userId, title, body, data = {}) {
  const db = getDb();
  const sub = db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').get(userId);
  if (!sub) return false;

  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify({ title, body, icon: '/favicon.svg', badge: '/favicon.svg', data })
    );
    return true;
  } catch (err) {
    // Remove invalid subscription
    if (err.statusCode === 410 || err.statusCode === 404) {
      db.prepare('DELETE FROM push_subscriptions WHERE user_id = ?').run(userId);
    }
    return false;
  }
}

module.exports.sendPushToUser = sendPushToUser;
