const cron = require('node-cron');
const { dbAll } = require('../db/database');
const { dbGet, dbRun } = require('../db/database');

let sendPushToUser;
function getPush() {
  if (!sendPushToUser) sendPushToUser = require('../routes/push').sendPushToUser;
  return sendPushToUser;
}

async function createNotification(userId, type, message) {
  await dbRun('INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)', [userId, type, message]);
}

async function notifyUser(userId, type, message, pushTitle, pushBody) {
  await createNotification(userId, type, message);
  try { await getPush()(userId, pushTitle, pushBody); } catch {}
}

function setupScheduler() {
  // Keep-alive: ping every 14 min to prevent Render free tier from sleeping
  const https = require('https');
  const APP_URL = process.env.APP_URL || 'https://kari-manager.onrender.com';
  cron.schedule('*/14 * * * *', () => {
    https.get(`${APP_URL}/api/health`).on('error', () => {});
  });

  console.log('Scheduler initialized');
}

module.exports = { setupScheduler };
