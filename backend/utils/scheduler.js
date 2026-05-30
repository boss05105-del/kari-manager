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
  // Reminder at 10:00 - plan not yet submitted
  cron.schedule('0 10 * * 1-6', async () => {
    const today = new Date().toISOString().split('T')[0];
    const directors = await dbAll(`
      SELECT u.id, s.id as store_id, s.store_number
      FROM users u JOIN stores s ON s.director_id = u.id WHERE u.role = 'director'
    `);
    for (const d of directors) {
      const hasPlan = await dbGet('SELECT 1 FROM daily_plans WHERE store_id = ? AND plan_date = ?', [d.store_id, today]);
      if (!hasPlan) await notifyUser(d.id, 'plan_reminder',
        'Напоминание: поставьте план до 11:00', '📝 Поставьте план на день',
        `Магазин ${d.store_number}: внесите план KPI до 11:00`);
    }
  }, { timezone: 'Europe/Moscow' });

  // Overdue alert at 11:00 + every 3 minutes until plan is submitted
  cron.schedule('*/3 11-22 * * 1-6', async () => {
    const today = new Date().toISOString().split('T')[0];
    const directors = await dbAll(`
      SELECT u.id, u.full_name, s.id as store_id, s.store_number
      FROM users u JOIN stores s ON s.director_id = u.id WHERE u.role = 'director'
    `);
    const admins = await dbAll("SELECT id FROM users WHERE role = 'admin'");
    const now = new Date();
    const moscowNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
    const isExact11 = moscowNow.getHours() === 11 && moscowNow.getMinutes() < 3;

    for (const d of directors) {
      const hasPlan = await dbGet('SELECT 1 FROM daily_plans WHERE store_id = ? AND plan_date = ?', [d.store_id, today]);
      if (!hasPlan) {
        await notifyUser(d.id, 'plan_overdue',
          `⚠️ Просрочка: план на ${today} не внесён — заполните сейчас`,
          '🔴 План не внесён', `Магазин ${d.store_number}: срочно внесите план`);
        if (isExact11) {
          for (const admin of admins) {
            await notifyUser(admin.id, 'director_plan_overdue',
              `⚠️ Магазин ${d.store_number} — план не внесён (${d.full_name})`,
              '🔴 Просрочка плана', `Магазин ${d.store_number}: ${d.full_name} не внёс план`);
          }
        }
      }
    }
  }, { timezone: 'Europe/Moscow' });

  cron.schedule('0 23 * * 1-6', async () => {
    const today = new Date().toISOString().split('T')[0];
    const directors = await dbAll(`
      SELECT u.id, s.id as store_id, s.store_number
      FROM users u JOIN stores s ON s.director_id = u.id WHERE u.role = 'director'
    `);
    for (const d of directors) {
      const hasFact = await dbGet('SELECT 1 FROM daily_facts WHERE store_id = ? AND fact_date = ?', [d.store_id, today]);
      if (!hasFact) await notifyUser(d.id, 'fact_reminder',
        'Напоминание: внесите факт до 23:30', '✅ Внесите результаты дня',
        `Магазин ${d.store_number}: внесите фактические KPI до 23:30`);
    }
  }, { timezone: 'Europe/Moscow' });

  cron.schedule('30 23 * * 1-6', async () => {
    const today = new Date().toISOString().split('T')[0];
    const directors = await dbAll(`
      SELECT u.id, u.full_name, s.id as store_id, s.store_number
      FROM users u JOIN stores s ON s.director_id = u.id WHERE u.role = 'director'
    `);
    const admins = await dbAll("SELECT id FROM users WHERE role = 'admin'");
    for (const d of directors) {
      const hasFact = await dbGet('SELECT 1 FROM daily_facts WHERE store_id = ? AND fact_date = ?', [d.store_id, today]);
      if (!hasFact) {
        await notifyUser(d.id, 'fact_overdue', `⚠️ Просрочка: факт за ${today} не внесён`,
          '🔴 Просрочка факта', `Магазин ${d.store_number}: факт не внесён в срок`);
        for (const admin of admins) {
          await notifyUser(admin.id, 'director_fact_overdue',
            `⚠️ Магазин ${d.store_number} — факт не внесён (${d.full_name})`,
            '🔴 Просрочка факта', `Магазин ${d.store_number}: ${d.full_name} не внёс факт`);
        }
      }
    }
  }, { timezone: 'Europe/Moscow' });

  console.log('Scheduler initialized');
}

module.exports = { setupScheduler };
