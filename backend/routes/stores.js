const express = require('express');
const { getDb } = require('../db/database');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { calcEngagementIndex, getEngagementLabel, calcKpiCompletion, KPI_FIELDS } = require('../utils/engagementIndex');

const router = express.Router();

function getDayStatus(plan, fact) {
  if (!plan && !fact) return 'missing';
  if (!plan) return 'no_plan';
  if (!fact) return 'no_fact';
  return 'complete';
}

function calcDayCompletion(plan, fact) {
  if (!plan || !fact) return null;
  const completion = calcKpiCompletion(plan, fact);
  return completion ? Math.round(completion * 100) : null;
}

router.get('/', authMiddleware, (req, res) => {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];

  const stores = db.prepare(`
    SELECT s.*, u.full_name as director_name, u.id as director_user_id
    FROM stores s
    LEFT JOIN users u ON u.id = s.director_id
    ORDER BY s.store_number
  `).all();

  const result = stores.map((store, idx) => {
    const plan = db.prepare(
      'SELECT * FROM daily_plans WHERE store_id = ? AND plan_date = ?'
    ).get(store.id, today);
    const fact = db.prepare(
      'SELECT * FROM daily_facts WHERE store_id = ? AND fact_date = ?'
    ).get(store.id, today);

    const lastActivity = db.prepare(`
      SELECT MAX(dt) as dt FROM (
        SELECT submitted_at as dt FROM daily_plans WHERE store_id = ?
        UNION ALL
        SELECT submitted_at as dt FROM daily_facts WHERE store_id = ?
      )
    `).get(store.id, store.id);

    const { index, stats } = calcEngagementIndex(store.id);
    const { label: engLabel, color: engColor } = getEngagementLabel(index);
    const dayCompletion = calcDayCompletion(plan, fact);

    let statusColor = 'red';
    if (plan && fact && dayCompletion >= 90) statusColor = 'green';
    else if (plan && fact && dayCompletion >= 70) statusColor = 'yellow';

    return {
      id: store.id,
      store_number: store.store_number,
      director_name: store.director_name || '—',
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
  });

  // Sort and assign ranks by engagement index
  result.sort((a, b) => b.engagement_index - a.engagement_index);
  result.forEach((s, i) => { s.rank = i + 1; });

  res.json(result);
});

router.get('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const storeId = parseInt(req.params.id);

  if (req.user.role === 'director') {
    const dirStore = db.prepare('SELECT id FROM stores WHERE director_id = ?').get(req.user.id);
    if (!dirStore || dirStore.id !== storeId) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }
  }

  const store = db.prepare(`
    SELECT s.*, u.full_name as director_name, u.username as director_username
    FROM stores s
    LEFT JOIN users u ON u.id = s.director_id
    WHERE s.id = ?
  `).get(storeId);

  if (!store) return res.status(404).json({ error: 'Магазин не найден' });

  const { index, breakdown, stats } = calcEngagementIndex(storeId);
  const { label, color } = getEngagementLabel(index);

  const recentDays = db.prepare(`
    SELECT p.plan_date as date, p.*, f.fact_date,
      f.ui_percent as f_ui, f.gold_qty as f_gold, f.silver_qty as f_silver,
      f.finmoll_qty as f_finmoll, f.kari_qty as f_kari, f.yandex_qty as f_yandex,
      f.items_per_receipt as f_items, f.conversion_shoes as f_conv_shoes,
      f.conversion_insoles as f_conv_insoles, f.sbp_share as f_sbp,
      f.what_helped, f.obstacles, f.tomorrow_actions,
      f.submitted_at as fact_submitted_at, f.is_late as fact_is_late
    FROM daily_plans p
    LEFT JOIN daily_facts f ON f.store_id = p.store_id AND f.fact_date = p.plan_date
    WHERE p.store_id = ?
    ORDER BY p.plan_date DESC
    LIMIT 90
  `).all(storeId);

  res.json({
    ...store,
    engagement: { index, label, color, breakdown, stats },
    history: recentDays
  });
});

router.get('/:id/history', authMiddleware, (req, res) => {
  const db = getDb();
  const storeId = parseInt(req.params.id);
  const { from, to, period } = req.query;

  let startDate, endDate;
  endDate = new Date();

  if (period === 'week') {
    startDate = new Date();
    const dow = startDate.getDay();
    startDate.setDate(startDate.getDate() - (dow === 0 ? 6 : dow - 1));
  } else if (period === 'month') {
    startDate = new Date(); startDate.setDate(1);
  } else if (period === 'quarter') {
    startDate = new Date();
    const q = Math.floor(startDate.getMonth() / 3);
    startDate.setMonth(q * 3, 1);
  } else if (from && to) {
    startDate = new Date(from);
    endDate = new Date(to);
  } else {
    startDate = new Date(); startDate.setDate(startDate.getDate() - 30);
  }

  const rows = db.prepare(`
    SELECT
      p.plan_date as date,
      p.ui_percent as p_ui, p.gold_qty as p_gold, p.silver_qty as p_silver,
      p.finmoll_qty as p_finmoll, p.kari_qty as p_kari, p.yandex_qty as p_yandex,
      p.items_per_receipt as p_items, p.conversion_shoes as p_conv_shoes,
      p.conversion_insoles as p_conv_insoles, p.sbp_share as p_sbp,
      p.comment, p.submitted_at as plan_submitted_at, p.is_late as plan_late,
      f.ui_percent as f_ui, f.gold_qty as f_gold, f.silver_qty as f_silver,
      f.finmoll_qty as f_finmoll, f.kari_qty as f_kari, f.yandex_qty as f_yandex,
      f.items_per_receipt as f_items, f.conversion_shoes as f_conv_shoes,
      f.conversion_insoles as f_conv_insoles, f.sbp_share as f_sbp,
      f.what_helped, f.obstacles, f.tomorrow_actions,
      f.submitted_at as fact_submitted_at, f.is_late as fact_late
    FROM daily_plans p
    LEFT JOIN daily_facts f ON f.store_id = p.store_id AND f.fact_date = p.plan_date
    WHERE p.store_id = ?
      AND p.plan_date >= ?
      AND p.plan_date <= ?
    ORDER BY date DESC
  `).all(storeId, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]);

  res.json(rows);
});

module.exports = router;
