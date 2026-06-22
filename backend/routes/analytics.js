const express = require('express');
const { dbGet, dbAll } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const { calcEngagementIndex, getEngagementLabel, calcKpiCompletion } = require('../utils/engagementIndex');

const router = express.Router();

// ── Timezone helpers ──────────────────────────────────────────────────────────
// All date/time logic uses Moscow time (Europe/Moscow, UTC+3)
// Render servers run in UTC — never use toISOString() for "today" directly.

function getMoscowNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
}

function getMoscowDateStr(dt) {
  const d = dt ? new Date(new Date(dt).toLocaleString('en-US', { timeZone: 'Europe/Moscow' })) : getMoscowNow();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Recompute is_late from the actual submitted_at timestamp — do NOT trust the stored flag
// (stored flag was set with UTC bug before June 2026 fix)
function computePlanLate(plan) {
  if (!plan?.submitted_at) return false;
  const moscow = new Date(new Date(plan.submitted_at).toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
  const submittedDate = `${moscow.getFullYear()}-${String(moscow.getMonth()+1).padStart(2,'0')}-${String(moscow.getDate()).padStart(2,'0')}`;
  const planDate = plan.plan_date instanceof Date
    ? plan.plan_date.toISOString().split('T')[0]
    : String(plan.plan_date).split('T')[0];
  // Plan is late if submitted after 11:00 Moscow ON the plan day
  return submittedDate === planDate && moscow.getHours() >= 11;
}

function computeFactLate(fact) {
  if (!fact?.submitted_at) return false;
  const moscow = new Date(new Date(fact.submitted_at).toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
  const submittedDate = `${moscow.getFullYear()}-${String(moscow.getMonth()+1).padStart(2,'0')}-${String(moscow.getDate()).padStart(2,'0')}`;
  const factDate = fact.fact_date instanceof Date
    ? fact.fact_date.toISOString().split('T')[0]
    : String(fact.fact_date).split('T')[0];
  // Fact is late if submitted after 23:30 Moscow ON the fact day
  return submittedDate === factDate && (moscow.getHours() > 23 || (moscow.getHours() === 23 && moscow.getMinutes() >= 30));
}

// Build working days array (all 7 days Mon–Sun) from fromStr to min(toStr, moscowToday)
function buildWorkingDays(fromStr, toStr) {
  const moscowToday = getMoscowDateStr();
  const effectiveTo = toStr < moscowToday ? toStr : moscowToday;
  const days = [];
  const cursor = new Date(fromStr + 'T00:00:00Z');
  const end = new Date(effectiveTo + 'T00:00:00Z');
  while (cursor <= end) {
    days.push(cursor.toISOString().split('T')[0]); // все 7 дней включая воскресенье
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function toDateKey(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().split('T')[0];
  return String(val).split('T')[0];
}

function toTimeStr(dt) {
  if (!dt) return null;
  return new Date(dt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' });
}

// ── Period helpers ────────────────────────────────────────────────────────────
function getDateRange(period) {
  const now = getMoscowNow();
  const end = getMoscowDateStr(now);
  const start = new Date(now);
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
  const from = getMoscowDateStr(start);
  return { from, to: end };
}

router.get('/today', authMiddleware, async (req, res) => {
  try {
    const today = getMoscowDateStr(); // Moscow date, not UTC!
    const [total, plansToday, factsToday] = await Promise.all([
      dbGet('SELECT COUNT(*) as n FROM stores'),
      dbAll('SELECT submitted_at, plan_date FROM daily_plans WHERE plan_date = ?', [today]),
      dbAll('SELECT submitted_at, fact_date FROM daily_facts WHERE fact_date = ?', [today])
    ]);
    const t = parseInt(total.n);
    const p = plansToday.length;
    const f = factsToday.length;
    // Recompute late from submitted_at (not stored is_late flag)
    const latePlans = plansToday.filter(r => computePlanLate(r)).length;
    const lateFacts = factsToday.filter(r => computeFactLate(r)).length;
    res.json({
      total_stores: t, plans_submitted: p, facts_submitted: f,
      plans_missing: t - p, facts_missing: t - f,
      late_plans: latePlans, late_facts: lateFacts,
      plan_rate: t > 0 ? Math.round((p / t) * 100) : 0,
      fact_rate: t > 0 ? Math.round((f / t) * 100) : 0
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
    // Working days (Mon–Sat) up to Moscow today — NOT calendar days
    const workingDays = buildWorkingDays(from, to);

    const stores = await dbAll('SELECT s.id, s.store_number, u.full_name as director_name FROM stores s LEFT JOIN users u ON u.id = s.director_id');

    const result = await Promise.all(stores.map(async store => {
      const [plans, facts] = await Promise.all([
        dbAll('SELECT plan_date, submitted_at FROM daily_plans WHERE store_id = ? AND plan_date >= ? AND plan_date <= ?', [store.id, from, to]),
        dbAll('SELECT fact_date, submitted_at FROM daily_facts WHERE store_id = ? AND fact_date >= ? AND fact_date <= ?', [store.id, from, to])
      ]);

      const plansByDate = {}, factsByDate = {};
      plans.forEach(p => { plansByDate[toDateKey(p.plan_date)] = p; });
      facts.forEach(f => { factsByDate[toDateKey(f.fact_date)] = f; });

      let latePlans = 0, missingPlans = 0, lateFacts = 0;
      for (const d of workingDays) {
        const plan = plansByDate[d];
        const fact = factsByDate[d];
        if (!plan) missingPlans++;
        else if (computePlanLate(plan)) latePlans++;
        if (fact && computeFactLate(fact)) lateFacts++;
      }

      return {
        store_number: store.store_number, director_name: store.director_name || '—',
        late_plans: latePlans, late_facts: lateFacts, missing_plans: missingPlans,
        total_violations: latePlans + lateFacts
      };
    }));

    res.json(result
      .filter(s => s.total_violations > 0 || s.missing_plans > 0)
      .sort((a, b) => (b.total_violations + b.missing_plans) - (a.total_violations + a.missing_plans)));
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/top-ratings', authMiddleware, async (req, res) => {
  try {
    const { period = 'day' } = req.query;
    const today = getMoscowDateStr(); // Moscow date!
    const moscowNow = getMoscowNow();
    const monthStart = `${moscowNow.getFullYear()}-${String(moscowNow.getMonth() + 1).padStart(2, '0')}-01`;

    function toMoscowMinutes(dt) {
      if (!dt) return null;
      const moscow = new Date(new Date(dt).toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
      return moscow.getHours() * 60 + moscow.getMinutes();
    }
    function formatMinutes(mins) {
      if (mins == null) return '—';
      return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    }

    const KPI_FIELDS = ['ui_percent','gold_qty','silver_qty','finmoll_qty','kari_qty',
      'yandex_qty','items_per_receipt','conversion_shoes','conversion_insoles','sbp_share','mp_install_qty'];

    const stores = await dbAll(`
      SELECT s.id, s.store_number, u.full_name as director_name
      FROM stores s LEFT JOIN users u ON u.id = s.director_id ORDER BY s.store_number
    `);

    const storeStats = await Promise.all(stores.map(async store => {
      if (period === 'day') {
        const [plan, fact] = await Promise.all([
          dbGet('SELECT * FROM daily_plans WHERE store_id = ? AND plan_date = ?', [store.id, today]),
          dbGet('SELECT * FROM daily_facts WHERE store_id = ? AND fact_date = ?', [store.id, today])
        ]);
        const planMins = toMoscowMinutes(plan?.submitted_at);
        const factMins = toMoscowMinutes(fact?.submitted_at);

        let completion = null;
        if (plan && fact) {
          let total = 0, cnt = 0;
          for (const f of KPI_FIELDS) {
            if (plan[f] != null && fact[f] != null && plan[f] > 0) {
              total += Math.min(fact[f] / plan[f], 1.5);
              cnt++;
            }
          }
          completion = cnt > 0 ? Math.round((total / cnt) * 100) : null;
        }

        return {
          store_id: store.id, store_number: store.store_number,
          director_name: store.director_name || '—',
          plan_mins: planMins, plan_time: formatMinutes(planMins), plan_late: computePlanLate(plan),
          fact_mins: factMins, fact_time: formatMinutes(factMins), fact_late: computeFactLate(fact),
          completion, has_plan: !!plan, has_fact: !!fact
        };
      } else {
        // Monthly
        const [plans, facts] = await Promise.all([
          dbAll('SELECT * FROM daily_plans WHERE store_id = ? AND plan_date >= ? AND plan_date <= ?', [store.id, monthStart, today]),
          dbAll('SELECT * FROM daily_facts WHERE store_id = ? AND fact_date >= ? AND fact_date <= ?', [store.id, monthStart, today])
        ]);

        const factsByDate = {};
        facts.forEach(f => { factsByDate[toDateKey(f.fact_date)] = f; });

        let planMinsTotal = 0, planMinsCount = 0;
        let factMinsTotal = 0, factMinsCount = 0;
        let completionTotal = 0, completionCount = 0;

        for (const plan of plans) {
          const pm = toMoscowMinutes(plan.submitted_at);
          if (pm != null) { planMinsTotal += pm; planMinsCount++; }
          const fact = factsByDate[toDateKey(plan.plan_date)];
          if (fact) {
            const fm = toMoscowMinutes(fact.submitted_at);
            if (fm != null) { factMinsTotal += fm; factMinsCount++; }
            let total = 0, cnt = 0;
            for (const f of KPI_FIELDS) {
              if (plan[f] != null && fact[f] != null && plan[f] > 0) {
                total += Math.min(fact[f] / plan[f], 1.5);
                cnt++;
              }
            }
            if (cnt > 0) { completionTotal += total / cnt; completionCount++; }
          }
        }

        const avgPlanMins = planMinsCount > 0 ? Math.round(planMinsTotal / planMinsCount) : null;
        const avgFactMins = factMinsCount > 0 ? Math.round(factMinsTotal / factMinsCount) : null;
        const avgCompletion = completionCount > 0 ? Math.round((completionTotal / completionCount) * 100) : null;

        return {
          store_id: store.id, store_number: store.store_number,
          director_name: store.director_name || '—',
          plan_mins: avgPlanMins, plan_time: formatMinutes(avgPlanMins), plan_late: false,
          fact_mins: avgFactMins, fact_time: formatMinutes(avgFactMins), fact_late: false,
          completion: avgCompletion, has_plan: plans.length > 0, has_fact: factMinsCount > 0,
          plans_count: planMinsCount, facts_count: factMinsCount
        };
      }
    }));

    // Top 10 fastest plan (lowest minutes, has plan)
    const topPlanSpeed = [...storeStats]
      .filter(s => s.plan_mins != null)
      .sort((a, b) => a.plan_mins - b.plan_mins)
      .slice(0, 10)
      .map((s, i) => ({ ...s, rank: i + 1 }));

    // Top 10 fastest fact
    const topFactSpeed = [...storeStats]
      .filter(s => s.fact_mins != null)
      .sort((a, b) => a.fact_mins - b.fact_mins)
      .slice(0, 10)
      .map((s, i) => ({ ...s, rank: i + 1 }));

    // Top 10 by completion
    const topCompletion = [...storeStats]
      .filter(s => s.completion != null)
      .sort((a, b) => b.completion - a.completion)
      .slice(0, 10)
      .map((s, i) => ({ ...s, rank: i + 1 }));

    res.json({ period, topPlanSpeed, topFactSpeed, topCompletion });
  } catch (e) {
    console.error(e);
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

    // toDateKey and toTimeStr are defined globally above

    // Working days (Mon–Sat) up to Moscow today — using shared helper
    const workingDays = buildWorkingDays(from, to);

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
        // Recompute late from actual submitted_at — do NOT use stored is_late flag
        const planIsLate = computePlanLate(plan);
        const factIsLate = computeFactLate(fact);

        if (!plan) missingPlans++;
        else if (planIsLate) latePlans++;

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
          plan_late: planIsLate,
          plan_missing: !plan,
          fact_time: toTimeStr(fact?.submitted_at),
          fact_late: factIsLate,
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

router.get('/weekly-report', authMiddleware, async (req, res) => {
  try {
    const now = new Date();
    // Default: current week (Monday)
    let weekStr = req.query.week; // expects "YYYY-WNN"
    let monday;
    if (weekStr) {
      const [y, w] = weekStr.split('-W').map(Number);
      // ISO week to date
      const jan4 = new Date(y, 0, 4);
      const startOfWeek1 = new Date(jan4);
      startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
      monday = new Date(startOfWeek1);
      monday.setDate(startOfWeek1.getDate() + (w - 1) * 7);
    } else {
      monday = new Date(now);
      monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    }
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const from = getMoscowDateStr(monday);
    const to = getMoscowDateStr(sunday);
    // Mon–Sat of this week, up to Moscow today
    const workingDays = buildWorkingDays(from, to);

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
        const planIsLate = computePlanLate(plan);
        const factIsLate = computeFactLate(fact);
        if (!plan) missingPlans++;
        else if (planIsLate) latePlans++;

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
          plan_late: planIsLate,
          plan_missing: !plan,
          fact_time: toTimeStr(fact?.submitted_at),
          fact_late: factIsLate,
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

    res.json({ week: weekStr || null, working_days: workingDays, stores: result });
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

// KPI Heatmap: per-store, per-KPI avg completion + risk signals
router.get('/kpi-heatmap', authMiddleware, async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const { from, to } = getDateRange(period);
    const today = getMoscowDateStr(); // Moscow date!

    const KPI_KEYS = [
      'ui_percent','gold_qty','silver_qty','finmoll_qty','kari_qty',
      'yandex_qty','items_per_receipt','conversion_shoes','conversion_insoles','sbp_share','mp_install_qty'
    ];

    const stores = await dbAll(`
      SELECT s.id, s.store_number, u.full_name as director_name
      FROM stores s LEFT JOIN users u ON u.id = s.director_id
      ORDER BY s.store_number::integer
    `);

    // Count working days in period (Mon-Sat up to Moscow today)
    const workingDaysInPeriod = buildWorkingDays(from, to);
    const totalWorkingDays = workingDaysInPeriod.length;

    const result = await Promise.all(stores.map(async store => {
      const [plans, facts, todayPlan, todayFact] = await Promise.all([
        dbAll('SELECT * FROM daily_plans WHERE store_id = ? AND plan_date >= ? AND plan_date <= ?', [store.id, from, to]),
        dbAll('SELECT * FROM daily_facts WHERE store_id = ? AND fact_date >= ? AND fact_date <= ?', [store.id, from, to]),
        dbGet('SELECT id, is_late FROM daily_plans WHERE store_id = ? AND plan_date = ?', [store.id, today]),
        dbGet('SELECT id FROM daily_facts WHERE store_id = ? AND fact_date = ?', [store.id, today])
      ]);

      const factsByDate = {};
      facts.forEach(f => { factsByDate[toDateKey(f.fact_date)] = f; });

      // Per-KPI totals
      const kpiTotals = {}, kpiCounts = {};
      KPI_KEYS.forEach(k => { kpiTotals[k] = 0; kpiCounts[k] = 0; });

      let planOnTimeCount = 0, planTotalCount = 0;
      let factOnTimeCount = 0, factTotalCount = 0;
      let completionTotal = 0, completionCount = 0;

      // Last 7 days for trend
      const last7 = [], prev7 = [];

      for (const plan of plans) {
        const dateKey = toDateKey(plan.plan_date);
        planTotalCount++;
        if (!computePlanLate(plan)) planOnTimeCount++;

        const fact = factsByDate[dateKey];
        if (fact) {
          factTotalCount++;
          if (!computeFactLate(fact)) factOnTimeCount++;

          let dayTotal = 0, dayCnt = 0;
          for (const k of KPI_KEYS) {
            if (plan[k] != null && fact[k] != null && plan[k] > 0) {
              const pct = Math.min(fact[k] / plan[k], 1.5) * 100;
              kpiTotals[k] += pct;
              kpiCounts[k]++;
              dayTotal += pct;
              dayCnt++;
            }
          }
          if (dayCnt > 0) {
            const dayCompletion = dayTotal / dayCnt;
            completionTotal += dayCompletion;
            completionCount++;

            // Classify into last7 / prev7
            const daysAgo = Math.round((new Date(today) - new Date(dateKey)) / 86400000);
            if (daysAgo <= 7) last7.push(dayCompletion);
            else if (daysAgo <= 14) prev7.push(dayCompletion);
          }
        }
      }

      const kpi_avgs = {};
      for (const k of KPI_KEYS) {
        kpi_avgs[k] = kpiCounts[k] > 0 ? Math.round(kpiTotals[k] / kpiCounts[k]) : null;
      }

      const avg7 = last7.length ? last7.reduce((a, b) => a + b, 0) / last7.length : null;
      const avg_prev7 = prev7.length ? prev7.reduce((a, b) => a + b, 0) / prev7.length : null;
      let trend = 'stable';
      if (avg7 != null && avg_prev7 != null) {
        if (avg7 > avg_prev7 + 5) trend = 'up';
        else if (avg7 < avg_prev7 - 5) trend = 'down';
      }

      // Consecutive days without plan (risk signal)
      const recentDates = [];
      const cursor = new Date(today);
      for (let i = 0; i < 7; i++) {
        recentDates.push(cursor.toISOString().split('T')[0]);
        cursor.setDate(cursor.getDate() - 1);
      }
      let consecutive_no_plan = 0;
      for (const d of recentDates) {
        const hasPlan = plans.find(p => toDateKey(p.plan_date) === d);
        if (!hasPlan) consecutive_no_plan++;
        else break;
      }

      // Weak KPIs: avg < 70%
      const weak_kpis = KPI_KEYS.filter(k => kpi_avgs[k] != null && kpi_avgs[k] < 70);
      const strong_kpis = KPI_KEYS.filter(k => kpi_avgs[k] != null && kpi_avgs[k] >= 90);

      // Fill rate = % of working days that had a plan submitted
      const plan_fill_rate = totalWorkingDays > 0 ? Math.round((planTotalCount / totalWorkingDays) * 100) : null;
      const fact_fill_rate = totalWorkingDays > 0 ? Math.round((factTotalCount / totalWorkingDays) * 100) : null;
      // Punctuality = % of submitted plans that were on time (only shown if fill rate is meaningful)
      const plan_punctuality = planTotalCount > 0 ? Math.round((planOnTimeCount / planTotalCount) * 100) : null;
      const fact_punctuality = factTotalCount > 0 ? Math.round((factOnTimeCount / factTotalCount) * 100) : null;

      return {
        store_id: store.id,
        store_number: store.store_number,
        director_name: store.director_name || '—',
        kpi_avgs,
        avg_completion: completionCount > 0 ? Math.round(completionTotal / completionCount) : null,
        plan_fill_rate,   // % рабочих дней с планом (главный показатель дисциплины)
        fact_fill_rate,   // % рабочих дней с фактом
        plan_punctuality, // % сданных планов без опоздания
        fact_punctuality,
        fill_rate: planTotalCount,
        trend,
        today_has_plan: !!todayPlan,
        today_has_fact: !!todayFact,
        today_plan_late: todayPlan?.is_late || false,
        consecutive_no_plan,
        weak_kpis,
        strong_kpis,
        plans_count: planTotalCount,
        total_working_days: totalWorkingDays
      };
    }));

    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ── Audit endpoint: raw submissions for a store/month (admin only) ────────────
// GET /analytics/audit?store_id=X&month=YYYY-MM
// Returns every plan and fact with exact submitted_at timestamp so disputes can be resolved
router.get('/audit', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Только для администраторов' });
    const { store_id, month } = req.query;
    const now = getMoscowNow();
    const monthStr = month || `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const [y, m] = monthStr.split('-').map(Number);
    const from = `${monthStr}-01`;
    const to = `${monthStr}-${String(new Date(y, m, 0).getDate()).padStart(2,'0')}`;

    let whereClause = 'plan_date >= ? AND plan_date <= ?';
    let params = [from, to];
    if (store_id) { whereClause += ' AND store_id = ?'; params.push(parseInt(store_id)); }

    const [plans, facts, stores] = await Promise.all([
      dbAll(`SELECT p.*, s.store_number, u.full_name as director_name
             FROM daily_plans p
             JOIN stores s ON s.id = p.store_id
             LEFT JOIN users u ON u.id = p.director_id
             WHERE ${whereClause} ORDER BY plan_date, s.store_number`, params),
      dbAll(`SELECT f.*, s.store_number, u.full_name as director_name
             FROM daily_facts f
             JOIN stores s ON s.id = f.store_id
             LEFT JOIN users u ON u.id = f.director_id
             WHERE ${whereClause.replace(/plan_date/g, 'fact_date')} ORDER BY fact_date, s.store_number`, params),
      dbAll('SELECT id, store_number, (SELECT full_name FROM users WHERE id = director_id) as director_name FROM stores ORDER BY store_number')
    ]);

    // Enrich with recomputed is_late
    const enrichedPlans = plans.map(p => ({
      store_number: p.store_number, director_name: p.director_name,
      plan_date: toDateKey(p.plan_date),
      submitted_at_moscow: toTimeStr(p.submitted_at),
      submitted_at_utc: p.submitted_at,
      is_late_stored: !!p.is_late,
      is_late_recomputed: computePlanLate(p),
      comment: p.comment || ''
    }));
    const enrichedFacts = facts.map(f => ({
      store_number: f.store_number, director_name: f.director_name,
      fact_date: toDateKey(f.fact_date),
      submitted_at_moscow: toTimeStr(f.submitted_at),
      submitted_at_utc: f.submitted_at,
      is_late_stored: !!f.is_late,
      is_late_recomputed: computeFactLate(f)
    }));

    res.json({ month: monthStr, plans: enrichedPlans, facts: enrichedFacts, stores });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
