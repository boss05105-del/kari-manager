const express = require('express');
const { dbGet, dbRun } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/:storeId/:date', authMiddleware, async (req, res) => {
  try {
    const { storeId, date } = req.params;
    const fact = await dbGet(
      'SELECT * FROM daily_facts WHERE store_id = ? AND fact_date = ?',
      [parseInt(storeId), date]
    );
    res.json(fact || null);
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { store_id, fact_date, what_helped, obstacles, tomorrow_actions, ...kpis } = req.body;

    if (!store_id || !fact_date) return res.status(400).json({ error: 'Укажите магазин и дату' });
    if (!what_helped || what_helped.trim().length < 10)
      return res.status(400).json({ error: 'Заполните поле "Что помогло выполнить план?"' });
    if (!obstacles || obstacles.trim().length < 10)
      return res.status(400).json({ error: 'Заполните поле "Какие препятствия возникли?"' });
    if (!tomorrow_actions || tomorrow_actions.trim().length < 10)
      return res.status(400).json({ error: 'Заполните поле "Действия на завтра"' });

    if (req.user.role === 'director') {
      const dirStore = await dbGet('SELECT id FROM stores WHERE director_id = ?', [req.user.id]);
      if (!dirStore || dirStore.id !== parseInt(store_id)) {
        return res.status(403).json({ error: 'Нет доступа к этому магазину' });
      }
    }

    const existing = await dbGet(
      'SELECT id FROM daily_facts WHERE store_id = ? AND fact_date = ?',
      [parseInt(store_id), fact_date]
    );
    if (existing) return res.status(409).json({ error: 'Факт на эту дату уже зафиксирован' });

    const now = new Date();
    const moscowNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
    const moscowHour = moscowNow.getHours();
    const moscowMin = moscowNow.getMinutes();
    const isToday = fact_date === now.toISOString().split('T')[0];
    const isLate = isToday && (moscowHour > 23 || (moscowHour === 23 && moscowMin >= 30));

    const director = await dbGet('SELECT director_id FROM stores WHERE id = ?', [parseInt(store_id)]);

    await dbRun(`
      INSERT INTO daily_facts
      (store_id, director_id, fact_date, ui_percent, gold_qty, silver_qty,
       finmoll_qty, kari_qty, yandex_qty, items_per_receipt,
       conversion_shoes, conversion_insoles, sbp_share, mp_install_qty,
       what_helped, obstacles, tomorrow_actions, is_late)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      parseInt(store_id), director?.director_id || req.user.id, fact_date,
      kpis.ui_percent || null, kpis.gold_qty || null, kpis.silver_qty || null,
      kpis.finmoll_qty || null, kpis.kari_qty || null, kpis.yandex_qty || null,
      kpis.items_per_receipt || null, kpis.conversion_shoes || null,
      kpis.conversion_insoles || null, kpis.sbp_share || null,
      kpis.mp_install_qty || null,
      what_helped.trim(), obstacles.trim(), tomorrow_actions.trim(),
      isLate ? 1 : 0
    ]);

    await dbRun('INSERT INTO action_log (user_id, action, details) VALUES (?, ?, ?)', [
      req.user.id, 'fact_submitted', `Store ${store_id}, date ${fact_date}`
    ]);

    const saved = await dbGet(
      'SELECT * FROM daily_facts WHERE store_id = ? AND fact_date = ?',
      [parseInt(store_id), fact_date]
    );
    res.status(201).json(saved);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
