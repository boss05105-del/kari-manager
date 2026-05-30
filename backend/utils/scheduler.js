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
  cron.schedule('0 9 * * 1-6', async () => {
    const today = new Date().toISOString().split('T')[0];
    const directors = await dbAll(`
      SELECT u.id, s.id as store_id, s.store_number
      FROM users u JOIN stores s ON s.director_id = u.id WHERE u.role = 'director'
    `);
    for (const d of directors) {
      const hasPlan = await dbGet('SELECT 1 FROM daily_plans WHERE store_id = ? AND plan_date = ?', [d.store_id, today]);
      if (!hasPlan) await notifyUser(d.id, 'plan_reminder',
        'Напоминание: поставьте план до 10:00', '📝 Поставьте план на день',
        `Магазин ${d.store_number}: внесите план KPI до 10:00`);
    }
  }, { timezone: 'Europe/Moscow' });

  cron.schedule('0 10 * * 1-6', async () => {
    const today = new Date().toISOString().split('T')[0];
    const directors = await dbAll(`
      SELECT u.id, u.full_name, s.id as store_id, s.store_number
      FROM users u JOIN stores s ON s.director_id = u.id WHERE u.role = 'director'
    `);
    const admins = await dbAll("SELECT id FROM users WHERE role = 'admin'");
    for (const d of directors) {
      const hasPlan = await dbGet('SELECT 1 FROM daily_plans WHERE store_id = ? AND plan_date = ?', [d.store_id, today]);
      if (!hasPlan) {
        await notifyUser(d.id, 'plan_overdue', `⚠️ Просрочка: план на ${today} не внесён`,
          '🔴 Просрочка плана', `Магазин ${d.store_number}: план не внесён в срок`);
        for (const admin of admins) {
          await notifyUser(admin.id, 'director_plan_overdue',
            `⚠️ Магазин ${d.store_number} — план не внесён (${d.full_name})`,
            '🔴 Просрочка плана', `Магазин ${d.store_number}: ${d.full_name} не внёс план`);
        }
      }
    }
  }, { timezone: 'Europe/Moscow' });

  cron.schedule('0 21 * * 1-6', async () => {
    const today = new Date().toISOString().split('T')[0];
    const directors = await dbAll(`
      SELECT u.id, s.id as store_id, s.store_number
      FROM users u JOIN stores s ON s.director_id = u.id WHERE u.role = 'director'
    `);
    for (const d of directors) {
      const hasFact = await dbGet('SELECT 1 FROM daily_facts WHERE store_id = ? AND fact_date = ?', [d.store_id, today]);
      if (!hasFact) await notifyUser(d.id, 'fact_reminder',
        'Напоминание: внесите факт до 22:00', '✅ Внесите результаты дня',
        `Магазин ${d.store_number}: внесите фактические KPI до 22:00`);
    }
  }, { timezone: 'Europe/Moscow' });

  cron.schedule('0 22 * * 1-6', async () => {
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
