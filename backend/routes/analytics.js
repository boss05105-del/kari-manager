const express = require('express');
const { dbGet, dbAll } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const { calcEngagementIndex, getEngagementLabel, calcKpiCompletion } = require('../utils/engagementIndex');

const router = express.Router();

function getDateRange(period) {
  const end = new Date();
  const start = new Date();
  if (period === 'week') {
    const dow = start.getDay();
    start.setDate(start.getDate() - (dow === 0 ? 6 : dow - 1));
  } else if (period === 'month') {
    start.setDate(1);
  } else if (period === 'quarter') {
    const q = Math.floor(start.getMonth() / 3);
    start.setMonth(q * 3, 1);
  } else if (period === 'year') {
    start.setMonth(0, 1);
  } else {
    start.setDate(start.getDate() - 30);
  }
  start.setHours(0, 0, 0, 0);
  return { from: start.toISOString().split('T')[0], to: end.toISOString().split('T')[0] };
}

router.get('/today', authMiddleware, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const [total, plansCount, factsCount, latePlans, lateFacts] = await Promise.all([
      dbGet('SELECT COUNT(*) as n FROM stores'),
      dbGet('SELECT COUNT(*) as n FROM daily_plans WHERE plan_date = ?', [today]),
      dbGet('SELECT COUNT(*) as n FROM daily_facts WHERE fact_date = ?', [today]),
      dbGet('SELECT COUNT(*) as n FROM daily_plans WHERE plan_date = ? AND is_late = 1', [today]),
      dbGet('SELECT COUNT(*) as n FROM daily_facts WHERE fact_date = ? AND is_late = 1', [today])
    ]);
    const t = parseInt(total.n), p = parseInt(plansCount.n), f = parseInt(factsCount.n);
    res.json({
      total_stores: t, plans_submitted: p, facts_submitted: f,
      plans_missing: t - p, facts_missing: t - f,
      late_plans: parseInt(latePlans.n), late_facts: parseInt(lateFacts.n),
      plan_rate: Math.round((p / t) * 100), fact_rate: Math.round((f / t) * 100)
    });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/rankings', authMiddleware, async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const { from, to } = getDateRange(period);

    const stores = await dbAll(`
      SELECT s.id, s.store_number, u.full_name as director_name
      FROM stores s LEFT JOIN users u ON u.id = s.director_id ORDER BY s.store_number
    `);

    const rankings = await Promise.all(stores.map(async store => {
      const [engData, plans, facts] = await Promise.all([
        calcEngagementIndex(store.id),
        dbAll('SELECT * FROM daily_plans WHERE store_id = ? AND plan_date >= ? AND plan_date <= ?', [store.id, from, to]),
        dbAll('SELECT * FROM daily_facts WHERE store_id = ? AND fact_date >= ? AND fact_date <= ?', [store.id, from, to])
      ]);
      const { index, stats } = engData;
      const { label, color } = getEngagementLabel(index);

      const factsByDate = {};
      facts.forEach(f => {
        const k = f.fact_date instanceof Date ? f.fact_date.toISOString().split('T')[0] : String(f.fact_date).split('T')[0];
        factsByDate[k] = f;
      });

      let completionTotal = 0, completionCount = 0;
      for (const plan of plans) {
        const k = plan.plan_date instanceof Date ? plan.plan_date.toISOString().split('T')[0] : String(plan.plan_date).split('T')[0];
        const fact = factsByDate[k];
        if (fact) {
          const c = calcKpiCompletion(plan, fact);
          if (c !== null) { completionTotal += c; completionCount++; }
        }
      }

      return {
        store_id: store.id, store_number: store.store_number,
        director_name: store.director_name || '—',
        engagement_index: index, engagement_label: label, engagement_color: color,
        avg_completion: completionCount > 0 ? Math.round((completionTotal / completionCount) * 100) : 0,
        fill_rate: stats?.fillRate || 0, plans_on_time: stats?.plansOnTime || 0, streak: stats?.currentStreak || 0
      };
    }));

    rankings.sort((a, b) => b.engagement_index - a.engagement_index);
    rankings.forEach((r, i) => { r.rank = i + 1; });
    res.json(rankings);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/store/:storeId/trends', authMiddleware, async (req, res) => {
  try {
    const storeId = parseInt(req.params.storeId);
    const { period = 'month' } = req.query;
    const { from, to } = getDateRange(period);

    const rows = await dbAll(`
      SELECT p.plan_date as date,
        p.ui_percent as p_ui, p.gold_qty as p_gold, p.silver_qty as p_silver,
        f.ui_percent as f_ui, f.gold_qty as f_gold, f.silver_qty as f_silver
      FROM daily_plans p
      LEFT JOIN daily_facts f ON f.store_id = p.store_id AND f.fact_date = p.plan_date
      WHERE p.store_id = ? AND p.plan_date >= ? AND p.plan_date <= ?
      ORDER BY p.plan_date
    `, [storeId, from, to]);

    res.json(rows.map(row => ({
      date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date).split('T')[0],
      completion: row.f_ui != null && row.p_ui != null
        ? Math.round(Math.min((row.f_ui / row.p_ui), 1.5) * 100) : null,
      plan: { ui: row.p_ui, gold: row.p_gold, silver: row.p_silver },
      fact: { ui: row.f_ui, gold: row.f_gold, silver: row.f_silver }
    })));
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/network/trends', authMiddleware, async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const { from, to } = getDateRange(period);

    const rows = await dbAll(`
      SELECT p.plan_date as date,
        AVG(CASE WHEN p.ui_percent > 0 THEN f.ui_percent / p.ui_percent ELSE NULL END) as ui_rate,
        AVG(CASE WHEN p.gold_qty > 0 THEN f.gold_qty / p.gold_qty ELSE NULL END) as gold_rate,
        AVG(CASE WHEN p.conversion_shoes > 0 THEN f.conversion_shoes / p.conversion_shoes ELSE NULL END) as shoes_rate,
        COUNT(p.id) as plan_count,
        COUNT(f.id) as fact_count
      FROM daily_plans p
      LEFT JOIN daily_facts f ON f.store_id = p.store_id AND f.fact_date = p.plan_date
      WHERE p.plan_date >= ? AND p.plan_date <= ?
      GROUP BY p.plan_date ORDER BY p.plan_date
    `, [from, to]);

    res.json(rows.map(r => ({
      date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date).split('T')[0],
      ui_rate: r.ui_rate ? Math.round(r.ui_rate * 100) : null,
      gold_rate: r.gold_rate ? Math.round(r.gold_rate * 100) : null,
      shoes_rate: r.shoes_rate ? Math.round(r.shoes_rate * 100) : null,
      fill_rate: r.plan_count > 0 ? Math.round((r.fact_count / r.plan_count) * 100) : 0
    })));
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/overdue', authMiddleware, async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const { from, to } = getDateRange(period);
    const totalDays = Math.round((new Date(to) - new Date(from)) / 86400000);

    const stores = await dbAll('SELECT s.id, s.store_number, u.full_name as director_name FROM stores s LEFT JOIN users u ON u.id = s.director_id');

    const result = await Promise.all(stores.map(async store => {
      const [latePlansRow, lateFactsRow, missingPlansRow] = await Promise.all([
        dbGet('SELECT COUNT(*) as n FROM daily_plans WHERE store_id = ? AND plan_date >= ? AND plan_date <= ? AND is_late = 1', [store.id, from, to]),
        dbGet('SELECT COUNT(*) as n FROM daily_facts WHERE store_id = ? AND fact_date >= ? AND fact_date <= ? AND is_late = 1', [store.id, from, to]),
        dbGet('SELECT COUNT(*) as n FROM daily_plans WHERE store_id = ? AND plan_date >= ? AND plan_date <= ?', [store.id, from, to])
      ]);
      const latePlans = parseInt(latePlansRow.n), lateFacts = parseInt(lateFactsRow.n);
      const missingPlans = Math.max(0, totalDays - parseInt(missingPlansRow.n));
      return { store_number: store.store_number, director_name: store.director_name || '—', late_plans: latePlans, late_facts: lateFacts, missing_plans: missingPlans, total_violations: latePlans + lateFacts };
    }));

    res.json(result.filter(s => s.total_violations > 0 || s.missing_plans > 0)
      .sort((a, b) => (b.total_violations + b.missing_plans) - (a.total_violations + a.missing_plans)));
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/monthly-report', authMiddleware, async (req, res) => {
  try {
    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthStr = req.query.month || defaultMonth;
    const [year, mon] = monthStr.split('-').map(Number);

    const from = `${monthStr}-01`;
    const lastDay = new Date(year, mon, 0).getDate();
    const to = `${monthStr}-${String(lastDay).padStart(2, '0')}`;

    function toDateKey(val) {
      if (!val) return null;
      if (val instanceof Date) return val.toISOString().split('T')[0];
      return String(val).split('T')[0];
    }
    function toTimeStr(dt) {
      if (!dt) return null;
      const d = new Date(dt);
      return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' });
    }

    // Working days up to today
    const workingDays = [];
    const cursor = new Date(from + 'T00:00:00');
    const endDate = new Date(Math.min(new Date(to + 'T23:59:59'), now));
    while (cursor <= endDate) {
      if (cursor.getDay() !== 0) workingDays.push(cursor.toISOString().split('T')[0]);
      cursor.setDate(cursor.getDate() + 1);
    }

    const KPI_KEYS = ['ui_percent','gold_qty','silver_qty','finmoll_qty','kari_qty',
      'yandex_qty','items_per_receipt','conversion_shoes','conversion_insoles','sbp_share','mp_install_qty'];

    const stores = await dbAll(`
      SELECT s.id, s.store_number, u.full_name as director_name
      FROM stores s LEFT JOIN users u ON u.id = s.director_id ORDER BY s.store_number
    `);

    const result = await Promise.all(stores.map(async store => {
      const [plans, facts] = await Promise.all([
        dbAll('SELECT * FROM daily_plans WHERE store_id = ? AND plan_date >= ? AND plan_date <= ?', [store.id, from, to]),
        dbAll('SELECT * FROM daily_facts WHERE store_id = ? AND fact_date >= ? AND fact_date <= ?', [store.id, from, to])
      ]);

      const plansByDate = {}, factsByDate = {};
      plans.forEach(p => { plansByDate[toDateKey(p.plan_date)] = p; });
      facts.forEach(f => { factsByDate[toDateKey(f.fact_date)] = f; });

      let latePlans = 0, missingPlans = 0, completionTotal = 0, completionCount = 0;
      const days = {};

      for (const d of workingDays) {
        const plan = plansByDate[d];
        const fact = factsByDate[d];
        if (!plan) missingPlans++;
        else if (plan.is_late) latePlans++;

        let completion = null;
        const kpis = {};
        if (plan && fact) {
          let total = 0, cnt = 0;
          for (const k of KPI_KEYS) {
            if (plan[k] != null && fact[k] != null && plan[k] > 0) {
              const pct = Math.round(Math.min(fact[k] / plan[k], 1.5) * 100);
              kpis[k] = { plan: plan[k], fact: fact[k], pct };
              total += Math.min(fact[k] / plan[k], 1.5);
              cnt++;
            } else if (plan[k] != null) {
              kpis[k] = { plan: plan[k], fact: fact[k] ?? null, pct: null };
            }
          }
          if (cnt > 0) {
            completion = Math.round((total / cnt) * 100);
            completionTotal += completion;
            completionCount++;
          }
        }

        days[d] = {
          plan_time: toTimeStr(plan?.submitted_at),
          plan_late: plan?.is_late || false,
          plan_missing: !plan,
          fact_time: toTimeStr(fact?.submitted_at),
          fact_late: fact?.is_late || false,
          fact_missing: !fact,
          completion,
          kpis
        };
      }

      return {
        store_id: store.id,
        store_number: store.store_number,
        director_name: store.director_name || '—',
        days,
        summary: {
          late_plans: latePlans,
          missing_plans: missingPlans,
          avg_completion: completionCount > 0 ? Math.round(completionTotal / completionCount) : null,
          fill_rate: workingDays.length > 0 ? Math.round(((workingDays.length - missingPlans) / workingDays.length) * 100) : 0
        }
      };
    }));

    res.json({ month: monthStr, working_days: workingDays, stores: result });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/export', authMiddleware, async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const { from, to } = getDateRange(period);

    const rows = await dbAll(`
      SELECT s.store_number, u.full_name as director, p.plan_date as date,
        p.ui_percent as plan_ui, f.ui_percent as fact_ui,
        p.gold_qty as plan_gold, f.gold_qty as fact_gold,
        p.comment, f.what_helped, f.obstacles, f.tomorrow_actions,
        p.submitted_at as plan_time, p.is_late as plan_late,
        f.submitted_at as fact_time, f.is_late as fact_late
      FROM stores s
      LEFT JOIN users u ON u.id = s.director_id
      LEFT JOIN daily_plans p ON p.store_id = s.id AND p.plan_date >= ? AND p.plan_date <= ?
      LEFT JOIN daily_facts f ON f.store_id = s.id AND f.fact_date = p.plan_date
      WHERE p.id IS NOT NULL
      ORDER BY s.store_number, p.plan_date
    `, [from, to]);

    res.json({ from, to, rows, count: rows.length });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
