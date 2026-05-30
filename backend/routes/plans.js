const express = require('express');
const { getDb } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const KPI_FIELDS = [
  'ui_percent','gold_qty','silver_qty','finmoll_qty','kari_qty',
  'yandex_qty','items_per_receipt','conversion_shoes','conversion_insoles','sbp_share'
];

// Get plan for a specific store and date
router.get('/:storeId/:date', authMiddleware, (req, res) => {
  const db = getDb();
  const { storeId, date } = req.params;

  const plan = db.prepare(
    'SELECT * FROM daily_plans WHERE store_id = ? AND plan_date = ?'
  ).get(parseInt(storeId), date);

  res.json(plan || null);
});

// Submit plan
router.post('/', authMiddleware, (req, res) => {
  const db = getDb();
  const { store_id, plan_date, comment, ...kpis } = req.body;

  if (!store_id || !plan_date) {
    return res.status(400).json({ error: 'Укажите магазин и дату' });
  }
  if (!comment || comment.trim().length < 20) {
    return res.status(400).json({ error: 'Комментарий должен содержать минимум 20 символов' });
  }

  // Director can only submit for own store
  if (req.user.role === 'director') {
    const dirStore = db.prepare('SELECT id FROM stores WHERE director_id = ?').get(req.user.id);
    if (!dirStore || dirStore.id !== parseInt(store_id)) {
      return res.status(403).json({ error: 'Нет доступа к этому магазину' });
    }
  }

  const existing = db.prepare(
    'SELECT id FROM daily_plans WHERE store_id = ? AND plan_date = ?'
  ).get(parseInt(store_id), plan_date);

  if (existing) {
    db.prepare('INSERT INTO action_log (user_id, action, details) VALUES (?, ?, ?)').run(
      req.user.id, 'plan_edit_attempt',
      `Store ${store_id}, date ${plan_date} — attempt to edit locked plan`
    );
    return res.status(409).json({ error: 'План на эту дату уже зафиксирован и не может быть изменён' });
  }

  // Determine if late (after 10:00 Moscow time)
  const now = new Date();
  const moscowHour = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' })).getHours();
  const isToday = plan_date === now.toISOString().split('T')[0];
  const isLate = isToday && moscowHour >= 10;

  const director = db.prepare("SELECT id FROM users WHERE role = 'director' AND id = (SELECT director_id FROM stores WHERE id = ?)").get(parseInt(store_id));

  db.prepare(`
    INSERT INTO daily_plans
    (store_id, director_id, plan_date, ui_percent, gold_qty, silver_qty,
     finmoll_qty, kari_qty, yandex_qty, items_per_receipt,
     conversion_shoes, conversion_insoles, sbp_share, comment, is_late)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    parseInt(store_id),
    director?.id || req.user.id,
    plan_date,
    kpis.ui_percent || null,
    kpis.gold_qty || null,
    kpis.silver_qty || null,
    kpis.finmoll_qty || null,
    kpis.kari_qty || null,
    kpis.yandex_qty || null,
    kpis.items_per_receipt || null,
    kpis.conversion_shoes || null,
    kpis.conversion_insoles || null,
    kpis.sbp_share || null,
    comment.trim(),
    isLate ? 1 : 0
  );

  db.prepare('INSERT INTO action_log (user_id, action, details) VALUES (?, ?, ?)').run(
    req.user.id, 'plan_submitted', `Store ${store_id}, date ${plan_date}, late: ${isLate}`
  );

  const saved = db.prepare(
    'SELECT * FROM daily_plans WHERE store_id = ? AND plan_date = ?'
  ).get(parseInt(store_id), plan_date);

  res.status(201).json(saved);
});

module.exports = router;
