const { dbAll } = require('../db/database');

const KPI_FIELDS = [
  'ui_percent','gold_qty','silver_qty','finmoll_qty','kari_qty',
  'yandex_qty','items_per_receipt','conversion_shoes','conversion_insoles','sbp_share'
];

function calcKpiCompletion(plan, fact) {
  if (!plan || !fact) return null;
  let total = 0, count = 0;
  for (const f of KPI_FIELDS) {
    if (plan[f] != null && fact[f] != null && plan[f] > 0) {
      total += Math.min(fact[f] / plan[f], 1.5);
      count++;
    }
  }
  return count > 0 ? total / count : null;
}

async function calcEngagementIndex(storeId) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);

  const from = startDate.toISOString().split('T')[0];
  const to = endDate.toISOString().split('T')[0];

  const plans = await dbAll(
    'SELECT * FROM daily_plans WHERE store_id = ? AND plan_date >= ? AND plan_date <= ? ORDER BY plan_date',
    [storeId, from, to]
  );
  const facts = await dbAll(
    'SELECT * FROM daily_facts WHERE store_id = ? AND fact_date >= ? AND fact_date <= ? ORDER BY fact_date',
    [storeId, from, to]
  );

  const plansByDate = {};
  const factsByDate = {};
  plans.forEach(p => { plansByDate[p.plan_date instanceof Date ? p.plan_date.toISOString().split('T')[0] : p.plan_date] = p; });
  facts.forEach(f => { factsByDate[f.fact_date instanceof Date ? f.fact_date.toISOString().split('T')[0] : f.fact_date] = f; });

  let workingDays = 0;
  let plansOnTime = 0, plansLate = 0, plansMissed = 0;
  let factsOnTime = 0, factsLate = 0, factsMissed = 0;
  let kpiScoreTotal = 0, kpiScoreCount = 0;
  let commentLengthTotal = 0, commentCount = 0;
  let maxStreak = 0, currentStreak = 0;

  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    if (cursor.getDay() !== 0) {
      workingDays++;
      const dateStr = cursor.toISOString().split('T')[0];
      const plan = plansByDate[dateStr];
      const fact = factsByDate[dateStr];

      if (!plan) { plansMissed++; currentStreak = 0; }
      else if (plan.is_late) plansLate++;
      else plansOnTime++;

      if (!fact) { factsMissed++; currentStreak = 0; }
      else if (fact.is_late) factsLate++;
      else factsOnTime++;

      if (plan && fact) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
        const completion = calcKpiCompletion(plan, fact);
        if (completion !== null) { kpiScoreTotal += Math.min(completion, 1); kpiScoreCount++; }
        const commentLen = (plan.comment?.length || 0) +
          (fact.what_helped?.length || 0) + (fact.obstacles?.length || 0) +
          (fact.tomorrow_actions?.length || 0);
        commentLengthTotal += Math.min(commentLen / 400, 1);
        commentCount++;
      } else {
        currentStreak = 0;
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  if (workingDays === 0) return { index: 0, breakdown: {}, stats: {} };

  const planScore = (plansOnTime * 25 + plansLate * 12) / workingDays;
  const factScore = (factsOnTime * 25 + factsLate * 12) / workingDays;
  const filled = workingDays - Math.max(plansMissed, factsMissed);
  const regularityScore = (filled / workingDays) * 20;
  const kpiScore = kpiScoreCount > 0 ? (kpiScoreTotal / kpiScoreCount) * 20 : 0;
  const commentScore = commentCount > 0 ? (commentLengthTotal / commentCount) * 10 : 0;

  const index = Math.min(100, Math.max(0, Math.round(
    planScore + factScore + regularityScore + kpiScore + commentScore
  )));

  return {
    index,
    breakdown: {
      planScore: Math.round(planScore),
      factScore: Math.round(factScore),
      regularityScore: Math.round(regularityScore),
      kpiScore: Math.round(kpiScore),
      commentScore: Math.round(commentScore)
    },
    stats: {
      workingDays, plansOnTime, plansLate, plansMissed,
      factsOnTime, factsLate, factsMissed,
      fillRate: workingDays > 0 ? Math.round((filled / workingDays) * 100) : 0,
      avgKpiCompletion: kpiScoreCount > 0 ? Math.round((kpiScoreTotal / kpiScoreCount) * 100) : 0,
      maxStreak, currentStreak
    }
  };
}

function getEngagementLabel(index) {
  if (index >= 90) return { label: 'Высокая', color: 'green' };
  if (index >= 70) return { label: 'Хорошая', color: 'blue' };
  if (index >= 50) return { label: 'Средняя', color: 'yellow' };
  return { label: 'Низкая', color: 'red' };
}

module.exports = { calcEngagementIndex, getEngagementLabel, calcKpiCompletion, KPI_FIELDS };
