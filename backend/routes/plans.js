const express = require('express');
const { dbGet, dbRun } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/:storeId/:date', authMiddleware, async (req, res) => {
  try {
    const { storeId, date } = req.params;
    const plan = await dbGet(
      'SELECT * FROM daily_plans WHERE store_id = ? AND plan_date = ?',
      [parseInt(storeId), date]
    );
    res.json(plan || null);
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { store_id, plan_date, comment, ...kpis } = req.body;

    if (!store_id || !plan_date) return res.status(400).json({ error: 'Укажите магазин и дату' });

    if (req.user.role === 'director') {
      const dirStore = await dbGet('SELECT id FROM stores WHERE director_id = ?', [req.user.id]);
      if (!dirStore || dirStore.id !== parseInt(store_id)) {
        return res.status(403).json({ error: 'Нет доступа к этому магазину' });
      }
    }

    const existing = await dbGet(
      'SELECT id FROM daily_plans WHERE store_id = ? AND plan_date = ?',
      [parseInt(store_id), plan_date]
    );
    if (existing) {
      await dbRun('INSERT INTO action_log (user_id, action, details) VALUES (?, ?, ?)', [
        req.user.id, 'plan_edit_attempt',
        `Store ${store_id}, date ${plan_date} — attempt to edit locked plan`
      ]);
      return res.status(409).json({ error: 'План на эту дату уже зафиксирован и не может быть изменён' });
    }

    const now = new Date();
    const moscowNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
    const moscowHour = moscowNow.getHours();
    const moscowToday = `${moscowNow.getFullYear()}-${String(moscowNow.getMonth()+1).padStart(2,'0')}-${String(moscowNow.getDate()).padStart(2,'0')}`;
    const isToday = plan_date === moscowToday;
    const isLate = isToday && moscowHour >= 11;

    const director = await dbGet(
      "SELECT id FROM users WHERE role = 'director' AND id = (SELECT director_id FROM stores WHERE id = ?)",
      [parseInt(store_id)]
    );

    await dbRun(`
      INSERT INTO daily_plans
      (store_id, director_id, plan_date, ui_percent, gold_qty, silver_qty,
       finmoll_qty, kari_qty, yandex_qty, items_per_receipt,
       conversion_shoes, conversion_insoles, sbp_share, mp_install_qty, comment, is_late)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      parseInt(store_id), director?.id || req.user.id, plan_date,
      kpis.ui_percent || null, kpis.gold_qty || null, kpis.silver_qty || null,
      kpis.finmoll_qty || null, kpis.kari_qty || null, kpis.yandex_qty || null,
      kpis.items_per_receipt || null, kpis.conversion_shoes || null,
      kpis.conversion_insoles || null, kpis.sbp_share || null,
      kpis.mp_install_qty || null,
      (comment || '').trim(), isLate ? 1 : 0
    ]);

    await dbRun('INSERT INTO action_log (user_id, action, details) VALUES (?, ?, ?)', [
      req.user.id, 'plan_submitted', `Store ${store_id}, date ${plan_date}, late: ${isLate}`
    ]);

    const saved = await dbGet(
      'SELECT * FROM daily_plans WHERE store_id = ? AND plan_date = ?',
      [parseInt(store_id), plan_date]
    );
    res.status(201).json(saved);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Ошибка сервера', detail: e.message });
  }
});

module.exports = router;
