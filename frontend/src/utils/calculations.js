export const NO_GOLD_STORES = new Set([
  '10804','11284','10912','13074','10211','13121','10718','11631','11737','13149',
  '11543','10953','11486','11403','10781','13005','11092','11121','11370','10980','11145'
]);

export function getKpiConfig(storeNumber) {
  if (storeNumber && NO_GOLD_STORES.has(String(storeNumber))) {
    return KPI_CONFIG.filter(k => k.key !== 'gold_qty');
  }
  return KPI_CONFIG;
}

export const KPI_CONFIG = [
  { key: 'ui_percent',         label: 'ЮИ',                    unit: '%',  type: 'percent' },
  { key: 'gold_qty',           label: 'Золото',                unit: 'шт', type: 'count' },
  { key: 'silver_qty',         label: 'Серебро',               unit: 'шт', type: 'count' },
  { key: 'finmoll_qty',        label: 'Рассрочка Финмолл',     unit: 'шт', type: 'count' },
  { key: 'kari_qty',           label: 'Kari Частями',          unit: 'шт', type: 'count' },
  { key: 'yandex_qty',         label: 'Яндекс Сплит',          unit: 'шт', type: 'count' },
  { key: 'items_per_receipt',  label: 'Штук в чеке',           unit: 'шт', type: 'decimal' },
  { key: 'conversion_shoes',   label: 'Конверсия обувь+косм.', unit: '%',  type: 'percent' },
  { key: 'conversion_insoles', label: 'Конверсия стельки',     unit: '%',  type: 'percent' },
  { key: 'sbp_share',          label: 'Доля СБП',              unit: '%',  type: 'percent' }
];

export function calcCompletion(plan, fact) {
  if (plan == null || fact == null || plan === 0) return null;
  return Math.round((fact / plan) * 100);
}

export function calcDeviation(plan, fact) {
  if (plan == null || fact == null) return null;
  return +(fact - plan).toFixed(2);
}

export function calcAvgCompletion(plan, fact) {
  if (!plan || !fact) return null;
  let total = 0, count = 0;
  for (const kpi of KPI_CONFIG) {
    const p = plan[kpi.key];
    const f = fact[kpi.key];
    if (p != null && f != null && p > 0) {
      total += Math.min(f / p, 1.5);
      count++;
    }
  }
  return count > 0 ? Math.round((total / count) * 100) : null;
}

export function getStatusColor(completion) {
  if (completion === null || completion === undefined) return 'gray';
  if (completion >= 90) return 'green';
  if (completion >= 70) return 'yellow';
  return 'red';
}

export function getEngagementColor(index) {
  if (index >= 90) return 'green';
  if (index >= 70) return 'blue';
  if (index >= 50) return 'yellow';
  return 'red';
}

export function getEngagementLabel(index) {
  if (index >= 90) return 'Высокая';
  if (index >= 70) return 'Хорошая';
  if (index >= 50) return 'Средняя';
  return 'Низкая';
}

export function formatKpiValue(value, kpi) {
  if (value == null) return '—';
  if (kpi.type === 'percent') return `${(+value).toFixed(1)}%`;
  if (kpi.type === 'decimal') return (+value).toFixed(2);
  return Math.round(value).toString();
}
