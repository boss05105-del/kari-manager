const express = require('express');
const bcrypt = require('bcryptjs');
const { dbAll, dbGet, dbRun } = require('../db/database');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { calcEngagementIndex, getEngagementLabel, calcKpiCompletion } = require('../utils/engagementIndex');

const router = express.Router();

function parseExclusions(val) {
  try { return JSON.parse(val || '[]'); } catch { return []; }
}

function calcDayCompletion(plan, fact) {
  if (!plan || !fact) return null;
  const completion = calcKpiCompletion(plan, fact);
  return completion ? Math.round(completion * 100) : null;
}

function toDateStr(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().split('T')[0];
  return String(val).split('T')[0];
}

router.get('/', authMiddleware, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const stores = await dbAll(`
      SELECT s.*, u.full_name as director_name, u.id as director_user_id
      FROM stores s LEFT JOIN users u ON u.id = s.director_id ORDER BY s.store_number::integer
    `);

    const result = await Promise.all(stores.map(async (store) => {
      const [plan, fact, lastActivity, engData] = await Promise.all([
        dbGet('SELECT * FROM daily_plans WHERE store_id = ? AND plan_date = ?', [store.id, today]),
        dbGet('SELECT * FROM daily_facts WHERE store_id = ? AND fact_date = ?', [store.id, today]),
        dbGet(`SELECT MAX(dt) as dt FROM (
          SELECT submitted_at as dt FROM daily_plans WHERE store_id = $1
          UNION ALL SELECT submitted_at as dt FROM daily_facts WHERE store_id = $1
        ) sub`, [store.id]),
        calcEngagementIndex(store.id)
      ]);

      const { index, stats } = engData;
      const { label: engLabel, color: engColor } = getEngagementLabel(index);
      const dayCompletion = calcDayCompletion(plan, fact);

      let statusColor = 'red';
      if (plan && fact && dayCompletion >= 90) statusColor = 'green';
      else if (plan && fact && dayCompletion >= 70) statusColor = 'yellow';

      return {
        id: store.id,
        store_number: store.store_number,
        name: store.name || null,
        director_name: store.director_name || '—',
        kpi_exclusions: parseExclusions(store.kpi_exclusions),
        plan_submitted: !!plan,
        plan_late: plan?.is_late || false,
        plan_time: plan?.submitted_at || null,
        fact_submitted: !!fact,
        fact_late: fact?.is_late || false,
        fact_time: fact?.submitted_at || null,
        day_completion: dayCompletion,
        engagement_index: index,
        engagement_label: engLabel,
        engagement_color: engColor,
        status_color: statusColor,
        last_activity: lastActivity?.dt || null,
        rank: 0,
        fill_rate: stats?.fillRate || 0
      };
    }));

    result.sort((a, b) => parseInt(a.store_number) - parseInt(b.store_number));
    result.forEach((s, i) => { s.rank = i + 1; });
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const storeId = parseInt(req.params.id);
    if (req.user.role === 'director') {
      const dirStore = await dbGet('SELECT id FROM stores WHERE director_id = ?', [req.user.id]);
      if (!dirStore || dirStore.id !== storeId) return res.status(403).json({ error: 'Доступ запрещён' });
    }

    const store = await dbGet(`
      SELECT s.*, u.full_name as director_name, u.username as director_username
      FROM stores s LEFT JOIN users u ON u.id = s.director_id WHERE s.id = ?
    `, [storeId]);
    if (!store) return res.status(404).json({ error: 'Магазин не найден' });

    const { index, breakdown, stats } = await calcEngagementIndex(storeId);
    const { label, color } = getEngagementLabel(index);

    const recentDays = await dbAll(`
      SELECT p.plan_date as date, p.*,
        f.fact_date, f.ui_percent as f_ui, f.gold_qty as f_gold, f.silver_qty as f_silver,
        f.finmoll_qty as f_finmoll, f.kari_qty as f_kari, f.yandex_qty as f_yandex,
        f.items_per_receipt as f_items, f.conversion_shoes as f_conv_shoes,
        f.conversion_insoles as f_conv_insoles, f.sbp_share as f_sbp,
        f.mp_install_qty as f_mp,
        f.what_helped, f.obstacles, f.tomorrow_actions,
        f.submitted_at as fact_submitted_at, f.is_late as fact_is_late
      FROM daily_plans p
      LEFT JOIN daily_facts f ON f.store_id = p.store_id AND f.fact_date = p.plan_date
      WHERE p.store_id = ?
      ORDER BY p.plan_date DESC LIMIT 90
    `, [storeId]);

    res.json({
      ...store,
      kpi_exclusions: parseExclusions(store.kpi_exclusions),
      engagement: { index, label, color, breakdown, stats },
      history: recentDays.map(r => ({ ...r, date: toDateStr(r.date) }))
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/:id/history', authMiddleware, async (req, res) => {
  try {
    const storeId = parseInt(req.params.id);
    const { from, to, period } = req.query;
    let startDate, endDate = new Date();

    if (period === 'week') {
      startDate = new Date(); const dow = startDate.getDay();
      startDate.setDate(startDate.getDate() - (dow === 0 ? 6 : dow - 1));
    } else if (period === 'month') {
      startDate = new Date(); startDate.setDate(1);
    } else if (period === 'quarter') {
      startDate = new Date(); const q = Math.floor(startDate.getMonth() / 3);
      startDate.setMonth(q * 3, 1);
    } else if (from && to) {
      startDate = new Date(from); endDate = new Date(to);
    } else {
      startDate = new Date(); startDate.setDate(startDate.getDate() - 30);
    }

    const rows = await dbAll(`
      SELECT p.plan_date as date,
        p.ui_percent as p_ui, p.gold_qty as p_gold, p.silver_qty as p_silver,
        p.finmoll_qty as p_finmoll, p.kari_qty as p_kari, p.yandex_qty as p_yandex,
        p.items_per_receipt as p_items, p.conversion_shoes as p_conv_shoes,
        p.conversion_insoles as p_conv_insoles, p.sbp_share as p_sbp,
        p.comment, p.submitted_at as plan_submitted_at, p.is_late as plan_late,
        f.ui_percent as f_ui, f.gold_qty as f_gold, f.silver_qty as f_silver,
        f.finmoll_qty as f_finmoll, f.kari_qty as f_kari, f.yandex_qty as f_yandex,
        f.items_per_receipt as f_items, f.conversion_shoes as f_conv_shoes,
        f.conversion_insoles as f_conv_insoles, f.sbp_share as f_sbp,
        f.mp_install_qty as f_mp,
        f.what_helped, f.obstacles, f.tomorrow_actions,
        f.submitted_at as fact_submitted_at, f.is_late as fact_late
      FROM daily_plans p
      LEFT JOIN daily_facts f ON f.store_id = p.store_id AND f.fact_date = p.plan_date
      WHERE p.store_id = ? AND p.plan_date >= ? AND p.plan_date <= ?
      ORDER BY date DESC
    `, [storeId, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]);

    res.json(rows.map(r => ({ ...r, date: toDateStr(r.date) })));
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { store_number, name, kpi_exclusions = [] } = req.body;
    if (!store_number) return res.status(400).json({ error: 'Укажите номер магазина' });
    const existing = await dbGet('SELECT id FROM stores WHERE store_number = ?', [String(store_number)]);
    if (existing) return res.status(409).json({ error: 'Магазин с таким номером уже существует' });

    // Create store
    await dbRun('INSERT INTO stores (store_number, name, kpi_exclusions) VALUES (?, ?, ?)',
      [String(store_number), name || null, JSON.stringify(kpi_exclusions)]);
    const store = await dbGet('SELECT * FROM stores WHERE store_number = ?', [String(store_number)]);

    // Auto-create director user (login by store number requires a user record)
    const username = `dir${store_number}`;
    const tempPassword = `store${store_number}`;
    const hashed = await bcrypt.hash(tempPassword, 10);
    await dbRun(`INSERT INTO users (username, password, role, full_name, store_id, profile_completed) VALUES (?, ?, 'director', ?, ?, 0)`,
      [username, hashed, `Директор ${store_number}`, store.id]);
    const newUser = await dbGet('SELECT id FROM users WHERE username = ?', [username]);
    await dbRun('UPDATE stores SET director_id = ? WHERE id = ?', [newUser.id, store.id]);

    res.status(201).json({ ...store, kpi_exclusions: parseExclusions(store.kpi_exclusions) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Ошибка сервера', detail: e.message });
  }
});

router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const storeId = parseInt(req.params.id);
    const { name, kpi_exclusions } = req.body;
    if (name !== undefined) await dbRun('UPDATE stores SET name = ? WHERE id = ?', [name, storeId]);
    if (kpi_exclusions !== undefined) await dbRun('UPDATE stores SET kpi_exclusions = ? WHERE id = ?', [JSON.stringify(kpi_exclusions), storeId]);
    const store = await dbGet('SELECT * FROM stores WHERE id = ?', [storeId]);
    res.json({ ...store, kpi_exclusions: parseExclusions(store.kpi_exclusions) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Ошибка сервера', detail: e.message });
  }
});

module.exports = router;
