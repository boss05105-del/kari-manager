const cron = require('node-cron');
const { getDb } = require('../db/database');

let sendPushToUser;
// Lazy import to avoid circular dependency
function getPush() {
  if (!sendPushToUser) {
    sendPushToUser = require('../routes/push').sendPushToUser;
  }
  return sendPushToUser;
}

function createNotification(db, userId, type, message) {
  db.prepare(`INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)`).run(userId, type, message);
}

async function notifyUser(db, userId, type, message, pushTitle, pushBody) {
  createNotification(db, userId, type, message);
  try { await getPush()(userId, pushTitle, pushBody); } catch {}
}

function setupScheduler() {
  // 09:00 — напоминание директорам поставить план
  cron.schedule('0 9 * * 1-6', async () => {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];
    const directors = db.prepare(`
      SELECT u.id, s.id as store_id, s.store_number
      FROM users u JOIN stores s ON s.director_id = u.id
      WHERE u.role = 'director'
    `).all();

    for (const d of directors) {
      const hasPlan = db.prepare(
        'SELECT 1 FROM daily_plans WHERE store_id = ? AND plan_date = ?'
      ).get(d.store_id, today);
      if (!hasPlan) {
        await notifyUser(db, d.id, 'plan_reminder',
          'Напоминание: поставьте план до 10:00',
          '📝 Поставьте план на день',
          `Магазин ${d.store_number}: внесите план KPI до 10:00`
        );
      }
    }
  }, { timezone: 'Europe/Moscow' });

  // 10:00 — просрочка плана
  cron.schedule('0 10 * * 1-6', async () => {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];
    const directors = db.prepare(`
      SELECT u.id, u.full_name, s.id as store_id, s.store_number
      FROM users u JOIN stores s ON s.director_id = u.id
      WHERE u.role = 'director'
    `).all();
    const admins = db.prepare("SELECT id FROM users WHERE role = 'admin'").all();

    for (const d of directors) {
      const hasPlan = db.prepare(
        'SELECT 1 FROM daily_plans WHERE store_id = ? AND plan_date = ?'
      ).get(d.store_id, today);
      if (!hasPlan) {
        await notifyUser(db, d.id, 'plan_overdue',
          `⚠️ Просрочка: план на ${today} не внесён`,
          '🔴 Просрочка плана',
          `Магазин ${d.store_number}: план не внесён в срок`
        );
        for (const admin of admins) {
          await notifyUser(db, admin.id, 'director_plan_overdue',
            `⚠️ Магазин ${d.store_number} — план не внесён (${d.full_name})`,
            '🔴 Просрочка плана',
            `Магазин ${d.store_number}: ${d.full_name} не внёс план`
          );
        }
      }
    }
  }, { timezone: 'Europe/Moscow' });

  // 21:00 — напоминание внести факт
  cron.schedule('0 21 * * 1-6', async () => {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];
    const directors = db.prepare(`
      SELECT u.id, s.id as store_id, s.store_number
      FROM users u JOIN stores s ON s.director_id = u.id
      WHERE u.role = 'director'
    `).all();

    for (const d of directors) {
      const hasFact = db.prepare(
        'SELECT 1 FROM daily_facts WHERE store_id = ? AND fact_date = ?'
      ).get(d.store_id, today);
      if (!hasFact) {
        await notifyUser(db, d.id, 'fact_reminder',
          'Напоминание: внесите факт до 22:00',
          '✅ Внесите результаты дня',
          `Магазин ${d.store_number}: внесите фактические KPI до 22:00`
        );
      }
    }
  }, { timezone: 'Europe/Moscow' });

  // 22:00 — просрочка факта
  cron.schedule('0 22 * * 1-6', async () => {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];
    const directors = db.prepare(`
      SELECT u.id, u.full_name, s.id as store_id, s.store_number
      FROM users u JOIN stores s ON s.director_id = u.id
      WHERE u.role = 'director'
    `).all();
    const admins = db.prepare("SELECT id FROM users WHERE role = 'admin'").all();

    for (const d of directors) {
      const hasFact = db.prepare(
        'SELECT 1 FROM daily_facts WHERE store_id = ? AND fact_date = ?'
      ).get(d.store_id, today);
      if (!hasFact) {
        await notifyUser(db, d.id, 'fact_overdue',
          `⚠️ Просрочка: факт за ${today} не внесён`,
          '🔴 Просрочка факта',
          `Магазин ${d.store_number}: факт не внесён в срок`
        );
        for (const admin of admins) {
          await notifyUser(db, admin.id, 'director_fact_overdue',
            `⚠️ Магазин ${d.store_number} — факт не внесён (${d.full_name})`,
            '🔴 Просрочка факта',
            `Магазин ${d.store_number}: ${d.full_name} не внёс факт`
          );
        }
      }
    }
  }, { timezone: 'Europe/Moscow' });

  console.log('Scheduler initialized');
}

module.exports = { setupScheduler };
