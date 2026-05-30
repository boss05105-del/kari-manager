const express = require('express');
const { getDb } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const { calcEngagementIndex, getEngagementLabel, calcKpiCompletion } = require('../utils/engagementIndex');

const router = express.Router();

function getDateRange(period) {
  const end = new Date();
  const start = new Date();
  if (period === 'week') {
    // Current calendar week from Monday
    const dow = start.getDay();
    const diff = dow === 0 ? 6 : dow - 1;
    start.setDate(start.getDate() - diff);
  } else if (period === 'month') {
    // Current calendar month from the 1st
    start.setDate(1);
  } else if (period === 'quarter') {
    // Current calendar quarter from its 1st day
    const q = Math.floor(start.getMonth() / 3);
    start.setMonth(q * 3, 1);
  } else if (period === 'year') {
    start.setMonth(0, 1);
  } else {
    start.setDate(start.getDate() - 30);
  }
  start.setHours(0, 0, 0, 0);
  return {
    from: start.toISOString().split('T')[0],
    to: end.toISOString().split('T')[0]
  };
}

// Dashboard summary for today
router.get('/today', authMiddleware, (req, res) => {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];

  const total = db.prepare('SELECT COUNT(*) as n FROM stores').get().n;
  const plansCount = db.prepare('SELECT COUNT(*) as n FROM daily_plans WHERE plan_date = ?').get(today).n;
  const factsCount = db.prepare('SELECT COUNT(*) as n FROM daily_facts WHERE fact_date = ?').get(today).n;
  const latePlans = db.prepare('SELECT COUNT(*) as n FROM daily_plans WHERE plan_date = ? AND is_late = 1').get(today).n;
  const lateFacts = db.prepare('SELECT COUNT(*) as n FROM daily_facts WHERE fact_date = ? AND is_late = 1').get(today).n;

  res.json({
    total_stores: total,
    plans_submitted: plansCount,
    facts_submitted: factsCount,
    plans_missing: total - plansCount,
    facts_missing: total - factsCount,
    late_plans: latePlans,
    late_facts: lateFacts,
    plan_rate: Math.round((plansCount / total) * 100),
    fact_rate: Math.round((factsCount / total) * 100)
  });
});

// Rankings
router.get('/rankings', authMiddleware, (req, res) => {
  const db = getDb();
  const { period = 'month' } = req.query;
  const { from, to } = getDateRange(period);
  const days = Math.round((new Date(to) - new Date(from)) / 86400000);

  const stores = db.prepare(`
    SELECT s.id, s.store_number, u.full_name as director_name
    FROM stores s
    LEFT JOIN users u ON u.id = s.director_id
    ORDER BY s.store_number
  `).all();

  const rankings = stores.map(store => {
    const { index, stats } = calcEngagementIndex(store.id);
    const { label, color } = getEngagementLabel(index);

    const plans = db.prepare(`
      SELECT * FROM daily_plans WHERE store_id = ? AND plan_date >= ? AND plan_date <= ?
    `).all(store.id, from, to);
    const facts = db.prepare(`
      SELECT * FROM daily_facts WHERE store_id = ? AND fact_date >= ? AND fact_date <= ?
    `).all(store.id, from, to);

    const factsByDate = {};
    facts.forEach(f => { factsByDate[f.fact_date] = f; });

    let completionTotal = 0, completionCount = 0;
    for (const plan of plans) {
      const fact = factsByDate[plan.plan_date];
      if (fact) {
        const c = calcKpiCompletion(plan, fact);
        if (c !== null) { completionTotal += c; completionCount++; }
      }
    }
    const avgCompletion = completionCount > 0 ? Math.round((completionTotal / completionCount) * 100) : 0;

    return {
      store_id: store.id,
      store_number: store.store_number,
      director_name: store.director_name || '—',
      engagement_index: index,
      engagement_label: label,
      engagement_color: color,
      avg_completion: avgCompletion,
      fill_rate: stats?.fillRate || 0,
      plans_on_time: stats?.plansOnTime || 0,
      streak: stats?.currentStreak || 0
    };
  });

  rankings.sort((a, b) => b.engagement_index - a.engagement_index);
  rankings.forEach((r, i) => { r.rank = i + 1; });

  res.json(rankings);
});

// KPI trends for a store
router.get('/store/:storeId/trends', authMiddleware, (req, res) => {
  const db = getDb();
  const storeId = parseInt(req.params.storeId);
  const { period = 'month' } = req.query;
  const { from, to } = getDateRange(period);

  const rows = db.prepare(`
    SELECT p.plan_date as date,
      p.ui_percent as p_ui, p.gold_qty as p_gold, p.silver_qty as p_silver,
      p.finmoll_qty as p_finmoll, p.kari_qty as p_kari, p.yandex_qty as p_yandex,
      p.items_per_receipt as p_items, p.conversion_shoes as p_shoes,
      p.conversion_insoles as p_insoles, p.sbp_share as p_sbp,
      f.ui_percent as f_ui, f.gold_qty as f_gold, f.silver_qty as f_silver,
      f.finmoll_qty as f_finmoll, f.kari_qty as f_kari, f.yandex_qty as f_yandex,
      f.items_per_receipt as f_items, f.conversion_shoes as f_shoes,
      f.conversion_insoles as f_insoles, f.sbp_share as f_sbp
    FROM daily_plans p
    LEFT JOIN daily_facts f ON f.store_id = p.store_id AND f.fact_date = p.plan_date
    WHERE p.store_id = ? AND p.plan_date >= ? AND p.plan_date <= ?
    ORDER BY p.plan_date
  `).all(storeId, from, to);

  const trends = rows.map(row => ({
    date: row.date,
    completion: row.f_ui != null && row.p_ui != null
      ? Math.round(Math.min((row.f_ui / row.p_ui), 1.5) * 100)
      : null,
    plan: { ui: row.p_ui, gold: row.p_gold, silver: row.p_silver },
    fact: { ui: row.f_ui, gold: row.f_gold, silver: row.f_silver }
  }));

  res.json(trends);
});

// Network-wide KPI trends
router.get('/network/trends', authMiddleware, (req, res) => {
  const db = getDb();
  const { period = 'month' } = req.query;
  const { from, to } = getDateRange(period);

  const rows = db.prepare(`
    SELECT p.plan_date as date,
      AVG(CASE WHEN p.ui_percent > 0 THEN f.ui_percent / p.ui_percent ELSE NULL END) as ui_rate,
      AVG(CASE WHEN p.gold_qty > 0 THEN f.gold_qty / p.gold_qty ELSE NULL END) as gold_rate,
      AVG(CASE WHEN p.conversion_shoes > 0 THEN f.conversion_shoes / p.conversion_shoes ELSE NULL END) as shoes_rate,
      COUNT(p.id) as plan_count,
      COUNT(f.id) as fact_count
    FROM daily_plans p
    LEFT JOIN daily_facts f ON f.store_id = p.store_id AND f.fact_date = p.plan_date
    WHERE p.plan_date >= ? AND p.plan_date <= ?
    GROUP BY p.plan_date
    ORDER BY p.plan_date
  `).all(from, to);

  res.json(rows.map(r => ({
    date: r.date,
    ui_rate: r.ui_rate ? Math.round(r.ui_rate * 100) : null,
    gold_rate: r.gold_rate ? Math.round(r.gold_rate * 100) : null,
    shoes_rate: r.shoes_rate ? Math.round(r.shoes_rate * 100) : null,
    fill_rate: r.plan_count > 0 ? Math.round((r.fact_count / r.plan_count) * 100) : 0
  })));
});

// Overdue report
router.get('/overdue', authMiddleware, (req, res) => {
  const db = getDb();
  const { period = 'month' } = req.query;
  const { from, to } = getDateRange(period);

  const stores = db.prepare(`
    SELECT s.id, s.store_number, u.full_name as director_name
    FROM stores s LEFT JOIN users u ON u.id = s.director_id
  `).all();

  const result = stores.map(store => {
    const latePlans = db.prepare(`
      SELECT COUNT(*) as n FROM daily_plans
      WHERE store_id = ? AND plan_date >= ? AND plan_date <= ? AND is_late = 1
    `).get(store.id, from, to).n;

    const lateFacts = db.prepare(`
      SELECT COUNT(*) as n FROM daily_facts
      WHERE store_id = ? AND fact_date >= ? AND fact_date <= ? AND is_late = 1
    `).get(store.id, from, to).n;

    const totalDays = Math.round((new Date(to) - new Date(from)) / 86400000);

    const missingPlans = db.prepare(`
      SELECT COUNT(*) as n FROM daily_plans
      WHERE store_id = ? AND plan_date >= ? AND plan_date <= ?
    `).get(store.id, from, to).n;

    return {
      store_number: store.store_number,
      director_name: store.director_name || '—',
      late_plans: latePlans,
      late_facts: lateFacts,
      missing_plans: Math.max(0, totalDays - missingPlans),
      total_violations: latePlans + lateFacts
    };
  }).filter(s => s.total_violations > 0 || s.missing_plans > 0);

  result.sort((a, b) => (b.total_violations + b.missing_plans) - (a.total_violations + a.missing_plans));
  res.json(result);
});

// Export data
router.get('/export', authMiddleware, (req, res) => {
  const db = getDb();
  const { period = 'month', format = 'json' } = req.query;
  const { from, to } = getDateRange(period);

  const rows = db.prepare(`
    SELECT s.store_number, u.full_name as director,
      p.plan_date as date,
      p.ui_percent as plan_ui, f.ui_percent as fact_ui,
      p.gold_qty as plan_gold, f.gold_qty as fact_gold,
      p.silver_qty as plan_silver, f.silver_qty as fact_silver,
      p.finmoll_qty as plan_finmoll, f.finmoll_qty as fact_finmoll,
      p.kari_qty as plan_kari, f.kari_qty as fact_kari,
      p.yandex_qty as plan_yandex, f.yandex_qty as fact_yandex,
      p.items_per_receipt as plan_items, f.items_per_receipt as fact_items,
      p.conversion_shoes as plan_shoes, f.conversion_shoes as fact_shoes,
      p.conversion_insoles as plan_insoles, f.conversion_insoles as fact_insoles,
      p.sbp_share as plan_sbp, f.sbp_share as fact_sbp,
      p.comment, f.what_helped, f.obstacles, f.tomorrow_actions,
      p.submitted_at as plan_time, p.is_late as plan_late,
      f.submitted_at as fact_time, f.is_late as fact_late
    FROM stores s
    LEFT JOIN users u ON u.id = s.director_id
    LEFT JOIN daily_plans p ON p.store_id = s.id AND p.plan_date >= ? AND p.plan_date <= ?
    LEFT JOIN daily_facts f ON f.store_id = s.id AND f.fact_date = p.plan_date
    WHERE p.id IS NOT NULL
    ORDER BY s.store_number, p.plan_date
  `).all(from, to);

  res.json({ from, to, rows, count: rows.length });
});

module.exports = router;
