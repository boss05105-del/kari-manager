// Colored Excel export using xlsx-js-style
// Color coding: green ≥90%, yellow 70-89%, orange 50-69%, red <50%

import XLSXStyle from 'xlsx-js-style';

const KPI_SHORT = {
  ui_percent: 'ЮИ %', gold_qty: 'Золото', silver_qty: 'Серебро',
  finmoll_qty: 'Финмолл', kari_qty: 'Kari', yandex_qty: 'Яндекс',
  items_per_receipt: 'ЧР', conversion_shoes: 'Конв.Об',
  conversion_insoles: 'Конв.Ст', sbp_share: 'СБП %', mp_install_qty: 'МП'
};

const KPI_KEYS = [
  'ui_percent','gold_qty','silver_qty','finmoll_qty','kari_qty',
  'yandex_qty','items_per_receipt','conversion_shoes','conversion_insoles','sbp_share','mp_install_qty'
];

// Fill colors (ARGB hex without #)
function pctFillColor(v) {
  if (v == null) return 'FFE5E7EB';
  if (v >= 100) return 'FF86EFAC';
  if (v >= 90)  return 'FFD1FAE5';
  if (v >= 70)  return 'FFFEF9C3';
  if (v >= 50)  return 'FFFED7AA';
  return 'FFFECACA';
}

function pctFontColor(v) {
  if (v == null) return 'FF6B7280';
  if (v >= 90)  return 'FF166534';
  if (v >= 70)  return 'FF854D0E';
  if (v >= 50)  return 'FF9A3412';
  return 'FFB91C1C';
}

// Cell style builder
function cs(fgColor, fontColor = 'FF111827', bold = false, align = 'center') {
  return {
    fill: { patternType: 'solid', fgColor: { rgb: fgColor } },
    font: { color: { rgb: fontColor }, bold, sz: 9, name: 'Calibri' },
    alignment: { horizontal: align, vertical: 'center', wrapText: true },
    border: {
      top:    { style: 'thin', color: { rgb: 'FFE5E7EB' } },
      bottom: { style: 'thin', color: { rgb: 'FFE5E7EB' } },
      left:   { style: 'thin', color: { rgb: 'FFE5E7EB' } },
      right:  { style: 'thin', color: { rgb: 'FFE5E7EB' } }
    }
  };
}

function headerCs(bgColor = 'FF7C3AED') {
  return cs(bgColor, 'FFFFFFFF', true, 'center');
}

function pctCs(v) {
  return cs(pctFillColor(v), pctFontColor(v), v != null && v >= 90);
}

function titleCs() {
  return {
    fill: { patternType: 'solid', fgColor: { rgb: 'FF7C3AED' } },
    font: { color: { rgb: 'FFFFFFFF' }, bold: true, sz: 13, name: 'Calibri' },
    alignment: { horizontal: 'center', vertical: 'center' }
  };
}

function subCs() {
  return {
    fill: { patternType: 'solid', fgColor: { rgb: 'FFF3F0FF' } },
    font: { color: { rgb: 'FF6B21A8' }, sz: 9, name: 'Calibri' },
    alignment: { horizontal: 'center', vertical: 'center' }
  };
}

// Cell helpers
function cell(v, style) { return { v, s: style }; }
function pctCell(v) { return cell(v != null ? `${v}%` : '—', pctCs(v)); }
function hCell(v, bgColor) { return cell(v, headerCs(bgColor)); }

// Download helper
function saveWb(wb, filename) {
  XLSXStyle.writeFile(wb, filename);
}

// Add merged title rows to a sheet
function addTitleRows(ws, title, colCount) {
  const mergeRanges = ws['!merges'] || [];

  // Row 1: title
  for (let c = 0; c < colCount; c++) {
    const addr = XLSXStyle.utils.encode_cell({ r: 0, c });
    ws[addr] = c === 0 ? cell(title, titleCs()) : cell('', titleCs());
  }
  mergeRanges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } });

  // Row 2: subtitle
  const sub = `Сформировано: ${new Date().toLocaleString('ru-RU')}`;
  for (let c = 0; c < colCount; c++) {
    const addr = XLSXStyle.utils.encode_cell({ r: 1, c });
    ws[addr] = c === 0 ? cell(sub, subCs()) : cell('', subCs());
  }
  mergeRanges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } });

  ws['!merges'] = mergeRanges;
}

function setRowHeight(ws, rowIndex, height) {
  if (!ws['!rows']) ws['!rows'] = [];
  ws['!rows'][rowIndex] = { hpt: height };
}

function buildSheet(title, headers, rows, colWidths, headerColor = 'FF7C3AED') {
  const ws = {};
  const colCount = headers.length;

  addTitleRows(ws, title, colCount);
  setRowHeight(ws, 0, 28);
  setRowHeight(ws, 1, 16);

  // Header row (row index 2)
  headers.forEach((h, c) => {
    ws[XLSXStyle.utils.encode_cell({ r: 2, c })] = hCell(h, headerColor);
  });
  setRowHeight(ws, 2, 30);

  // Data rows
  rows.forEach((row, ri) => {
    row.forEach((cellData, c) => {
      const addr = XLSXStyle.utils.encode_cell({ r: ri + 3, c });
      if (cellData && typeof cellData === 'object' && 'v' in cellData) {
        ws[addr] = cellData;
      } else {
        ws[addr] = cell(cellData ?? '', cs('FFFFFFFF'));
      }
    });
    setRowHeight(ws, ri + 3, 18);
  });

  ws['!ref'] = XLSXStyle.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length + 2, c: colCount - 1 } });
  ws['!cols'] = colWidths.map(w => ({ wch: w }));

  return ws;
}

// ─────────────────────────────────────────────
// 1. KPI HEATMAP
// ─────────────────────────────────────────────
export function exportHeatmapToExcel(data, period) {
  const wb = XLSXStyle.utils.book_new();
  const periodLabel = period === 'week' ? 'Неделя' : period === 'month' ? 'Месяц' : 'Квартал';

  const KPI_FULL = {
    ui_percent: 'Уровень сервиса', gold_qty: 'Золото (шт)', silver_qty: 'Серебро (шт)',
    finmoll_qty: 'Рассрочка Финмолл', kari_qty: 'Kari Частями', yandex_qty: 'Яндекс Сплит',
    items_per_receipt: 'Штук в чеке', conversion_shoes: 'Конверсия обувь',
    conversion_insoles: 'Конверсия стельки', sbp_share: 'Доля СБП', mp_install_qty: 'Установка МП'
  };
  const headers = ['Магазин', 'Директор', 'Планы сданы %', 'Ср. выполнение', ...KPI_KEYS.map(k => KPI_FULL[k]), 'Вовремя % (из сданных)', 'Тренд'];
  const colWidths = [10, 22, 14, 15, ...KPI_KEYS.map(() => 14), 22, 14];

  const sorted = [...data].sort((a, b) => (a.avg_completion ?? -1) - (b.avg_completion ?? -1));

  const rows = sorted.map((s, idx) => {
    const zebra = idx % 2 === 0 ? 'FFF9FAFB' : 'FFFFFFFF';
    const trendMap = { up: '↑ Растёт', down: '↓ Падает', stable: '→ Стабильно' };
    const trendFill = s.trend === 'up' ? 'FFD1FAE5' : s.trend === 'down' ? 'FFFECACA' : 'FFF3F4F6';
    const trendFont = s.trend === 'up' ? 'FF166534' : s.trend === 'down' ? 'FFB91C1C' : 'FF6B7280';
    return [
      cell(s.store_number, cs(zebra, 'FF111827', true)),
      cell(s.director_name || '—', cs(zebra, 'FF374151', false, 'left')),
      pctCell(s.plan_fill_rate),
      pctCell(s.avg_completion),
      ...KPI_KEYS.map(k => pctCell(s.kpi_avgs?.[k] ?? null)),
      pctCell(s.plan_punctuality),
      cell(trendMap[s.trend] || '—', cs(trendFill, trendFont, false))
    ];
  });

  const ws1 = buildSheet(`KPI Хитмап · ${periodLabel}`, headers, rows, colWidths, 'FF6D28D9');
  XLSXStyle.utils.book_append_sheet(wb, ws1, 'KPI Хитмап');

  // Risk zone sheet
  const riskHeaders = ['Магазин', 'Директор', 'Проблема', 'Ср. выполнение', 'Слабые KPI'];
  const riskRows = [];
  data.forEach(s => {
    const problems = [];
    if (!s.today_has_plan) problems.push('Нет плана сегодня');
    if (s.consecutive_no_plan >= 3) problems.push(`${s.consecutive_no_plan} дня подряд без плана`);
    if (s.weak_kpis?.length >= 5) problems.push(`${s.weak_kpis.length} KPI ниже 70%`);
    if (s.trend === 'down' && (s.avg_completion ?? 100) < 70) problems.push('Падающий тренд');
    if (!problems.length) return;
    const sev = !s.today_has_plan || s.consecutive_no_plan >= 3 ? 'FFFECACA' : 'FFFEF9C3';
    const sevFont = !s.today_has_plan || s.consecutive_no_plan >= 3 ? 'FFB91C1C' : 'FF854D0E';
    riskRows.push([
      cell(s.store_number, cs(sev, sevFont, true)),
      cell(s.director_name || '—', cs(sev, 'FF374151', false, 'left')),
      cell(problems.join('; '), cs(sev, 'FF111827', false, 'left')),
      pctCell(s.avg_completion),
      cell((s.weak_kpis || []).map(k => `${KPI_SHORT[k]} ${s.kpi_avgs?.[k] ?? ''}%`).join(', ') || '—', cs('FFFEF9C3', 'FF92400E', false, 'left'))
    ]);
  });
  if (!riskRows.length) riskRows.push([cell('✅ Критических рисков нет', cs('FFD1FAE5', 'FF166534', true, 'center'))]);

  const ws2 = buildSheet('Зона риска', riskHeaders, riskRows, [10, 22, 35, 14, 40], 'FFDC2626');
  XLSXStyle.utils.book_append_sheet(wb, ws2, 'Зона риска');

  saveWb(wb, `kari-heatmap-${period}-${new Date().toLocaleDateString('ru-RU').replace(/\./g,'-')}.xlsx`);
}

// ─────────────────────────────────────────────
// 2. RANKINGS
// ─────────────────────────────────────────────
export function exportRankingsToExcel(rankings, period) {
  const wb = XLSXStyle.utils.book_new();
  const periodLabel = period === 'week' ? 'Неделя' : period === 'month' ? 'Месяц' : period === 'day' ? 'Сегодня' : 'Квартал';

  const headers = ['Место', 'Магазин', 'Директор', 'Вовлечённость', 'Ср. выполнение', 'Заполн.%', 'Серия дн.'];
  const rows = rankings.map((s, idx) => {
    const zebra = idx % 2 === 0 ? 'FFF9FAFB' : 'FFFFFFFF';
    const rankFill = s.rank === 1 ? 'FFFFF3CD' : s.rank === 2 ? 'FFF0F0F0' : s.rank === 3 ? 'FFFFF0E0' : zebra;
    const medal = s.rank === 1 ? '🥇 1' : s.rank === 2 ? '🥈 2' : s.rank === 3 ? '🥉 3' : `#${s.rank}`;
    const engFill = (s.engagement_index || 0) >= 80 ? 'FFD1FAE5' : (s.engagement_index || 0) >= 60 ? 'FFFEF9C3' : (s.engagement_index || 0) >= 40 ? 'FFFED7AA' : 'FFFECACA';
    const engFont = (s.engagement_index || 0) >= 80 ? 'FF166534' : (s.engagement_index || 0) >= 60 ? 'FF854D0E' : 'FFB91C1C';
    return [
      cell(medal, cs(rankFill, 'FF111827', s.rank <= 3)),
      cell(s.store_number, cs(zebra, 'FF111827', true)),
      cell(s.director_name || '—', cs(zebra, 'FF374151', false, 'left')),
      cell(`${s.engagement_index || 0} — ${s.engagement_label || ''}`, cs(engFill, engFont)),
      pctCell(s.avg_completion),
      cell(`${s.fill_rate || 0}%`, cs(pctFillColor(s.fill_rate), pctFontColor(s.fill_rate))),
      cell(s.streak || 0, cs(zebra, 'FF374151'))
    ];
  });

  const ws = buildSheet(`Рейтинг директоров · ${periodLabel}`, headers, rows, [8, 10, 24, 20, 14, 12, 10]);
  XLSXStyle.utils.book_append_sheet(wb, ws, 'Рейтинг');
  saveWb(wb, `kari-ratings-${period}-${new Date().toLocaleDateString('ru-RU').replace(/\./g,'-')}.xlsx`);
}

// ─────────────────────────────────────────────
// 3. OVERDUE
// ─────────────────────────────────────────────
export function exportOverdueToExcel(data, period) {
  const wb = XLSXStyle.utils.book_new();
  const periodLabel = period === 'week' ? 'Неделя' : period === 'month' ? 'Месяц' : 'Квартал';

  const headers = ['Магазин', 'Директор', 'Опозд. планов', 'Опозд. фактов', 'Пропущ. планов', 'Всего нарушений'];
  const sorted = [...data].sort((a, b) => (b.total_violations + b.missing_plans) - (a.total_violations + a.missing_plans));

  const rows = sorted.map(s => {
    const total = (s.total_violations || 0) + (s.missing_plans || 0);
    const rowFill = total >= 10 ? 'FFFECACA' : total >= 5 ? 'FFFED7AA' : total >= 1 ? 'FFFEF9C3' : 'FFD1FAE5';
    const numFill = (n) => n > 0 ? 'FFFECACA' : 'FFD1FAE5';
    const numFont = (n) => n > 0 ? 'FFB91C1C' : 'FF166534';
    return [
      cell(s.store_number, cs(rowFill, 'FF111827', true)),
      cell(s.director_name || '—', cs(rowFill, 'FF374151', false, 'left')),
      cell(s.late_plans || 0, cs(numFill(s.late_plans), numFont(s.late_plans), (s.late_plans || 0) > 0)),
      cell(s.late_facts || 0, cs(numFill(s.late_facts), numFont(s.late_facts), (s.late_facts || 0) > 0)),
      cell(s.missing_plans || 0, cs(numFill(s.missing_plans), numFont(s.missing_plans), (s.missing_plans || 0) > 0)),
      cell(total, cs(total >= 5 ? 'FFFECACA' : total >= 1 ? 'FFFEF9C3' : 'FFD1FAE5', total >= 5 ? 'FFB91C1C' : 'FF111827', total > 0))
    ];
  });

  const ws = buildSheet(`Просрочки · ${periodLabel}`, headers, rows, [12, 24, 14, 14, 16, 16], 'FFDC2626');
  XLSXStyle.utils.book_append_sheet(wb, ws, 'Просрочки');
  saveWb(wb, `kari-overdue-${period}-${new Date().toLocaleDateString('ru-RU').replace(/\./g,'-')}.xlsx`);
}

// ─────────────────────────────────────────────
// 4. MONTHLY / WEEKLY REPORT
// ─────────────────────────────────────────────
export function exportReportToExcel(reportData, label) {
  const wb = XLSXStyle.utils.book_new();
  const { working_days, stores } = reportData;

  // Sheet 1: Summary
  const summaryHeaders = ['Магазин', 'Директор', 'Ср. выполнение', 'Заполн.%', 'Опозд. планов', 'Пропущ. планов'];
  const sortedStores = [...stores].sort((a, b) => (a.summary.avg_completion ?? -1) - (b.summary.avg_completion ?? -1));

  const summaryRows = sortedStores.map((store, idx) => {
    const s = store.summary;
    const zebra = idx % 2 === 0 ? 'FFF9FAFB' : 'FFFFFFFF';
    return [
      cell(store.store_number, cs(zebra, 'FF111827', true)),
      cell(store.director_name || '—', cs(zebra, 'FF374151', false, 'left')),
      pctCell(s.avg_completion),
      cell(`${s.fill_rate || 0}%`, cs(pctFillColor(s.fill_rate), pctFontColor(s.fill_rate))),
      cell(s.late_plans || 0, cs(s.late_plans > 0 ? 'FFFECACA' : 'FFD1FAE5', s.late_plans > 0 ? 'FFB91C1C' : 'FF166534', s.late_plans > 0)),
      cell(s.missing_plans || 0, cs(s.missing_plans > 0 ? 'FFFECACA' : 'FFD1FAE5', s.missing_plans > 0 ? 'FFB91C1C' : 'FF166534', s.missing_plans > 0))
    ];
  });

  const ws1 = buildSheet(`Сводный отчёт · ${label}`, summaryHeaders, summaryRows, [12, 24, 14, 12, 14, 14], 'FF7C3AED');
  XLSXStyle.utils.book_append_sheet(wb, ws1, 'Сводка');

  // Sheet 2: Daily completion matrix
  const dayLabels = working_days.map(d => {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  });
  const matrixHeaders = ['Магазин', 'Директор', ...dayLabels, 'Ср.%'];
  const matrixColWidths = [10, 20, ...working_days.map(() => 7), 8];

  const matrixRows = stores.map((store, idx) => {
    const zebra = idx % 2 === 0 ? 'FFF9FAFB' : 'FFFFFFFF';
    const dayCells = working_days.map(d => {
      const day = store.days?.[d];
      if (!day || day.plan_missing) return cell('✗', cs('FFFECACA', 'FFB91C1C', true));
      if (day.completion == null) return cell('—', cs('FFE5E7EB', 'FF6B7280'));
      return pctCell(day.completion);
    });
    return [
      cell(store.store_number, cs(zebra, 'FF111827', true)),
      cell(store.director_name || '—', cs(zebra, 'FF374151', false, 'left')),
      ...dayCells,
      pctCell(store.summary?.avg_completion ?? null)
    ];
  });

  const ws2 = buildSheet(`Выполнение по дням · ${label}`, matrixHeaders, matrixRows, matrixColWidths, 'FF6D28D9');
  XLSXStyle.utils.book_append_sheet(wb, ws2, 'По дням');

  // Sheet 3: KPI breakdown per store
  const KPI_FULL_NAMES = {
    ui_percent: 'Уровень сервиса', gold_qty: 'Золото (шт)', silver_qty: 'Серебро (шт)',
    finmoll_qty: 'Рассрочка Финмолл', kari_qty: 'Kari Частями', yandex_qty: 'Яндекс Сплит',
    items_per_receipt: 'Штук в чеке', conversion_shoes: 'Конверсия обувь',
    conversion_insoles: 'Конверсия стельки', sbp_share: 'Доля СБП', mp_install_qty: 'Установка МП'
  };
  const kpiHeaders = ['Магазин', 'Директор', ...KPI_KEYS.map(k => KPI_FULL_NAMES[k])];
  const kpiColWidths = [10, 22, ...KPI_KEYS.map(() => 16)];

  const kpiRows = stores.map((store, idx) => {
    const zebra = idx % 2 === 0 ? 'FFF9FAFB' : 'FFFFFFFF';
    const kpiCells = KPI_KEYS.map(k => {
      const values = Object.values(store.days || {})
        .filter(day => day.kpis?.[k]?.pct != null)
        .map(day => day.kpis[k].pct);
      const avg = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
      return pctCell(avg);
    });
    return [
      cell(store.store_number, cs(zebra, 'FF111827', true)),
      cell(store.director_name || '—', cs(zebra, 'FF374151', false, 'left')),
      ...kpiCells
    ];
  });

  const ws3 = buildSheet(`KPI по магазинам · ${label}`, kpiHeaders, kpiRows, kpiColWidths, 'FF059669');
  XLSXStyle.utils.book_append_sheet(wb, ws3, 'KPI по магазинам');

  saveWb(wb, `kari-report-${label}-${new Date().toLocaleDateString('ru-RU').replace(/\./g,'-')}.xlsx`);
}

// ─────────────────────────────────────────────
// 5. DASHBOARD (today)
// ─────────────────────────────────────────────
export function exportDashboardToExcel(stores) {
  const wb = XLSXStyle.utils.book_new();
  const today = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

  const headers = ['Магазин', 'Директор', 'План', 'Время плана', 'Факт', 'Время факта', 'Выполнение'];
  const rows = stores.map((store, idx) => {
    const zebra = idx % 2 === 0 ? 'FFF9FAFB' : 'FFFFFFFF';
    const planFill = store.has_plan ? (store.plan_late ? 'FFFEF9C3' : 'FFD1FAE5') : 'FFFECACA';
    const planFont = store.has_plan ? (store.plan_late ? 'FF854D0E' : 'FF166534') : 'FFB91C1C';
    const planVal = store.has_plan ? (store.plan_late ? '⏰ Есть' : '✅ Есть') : '✗ Нет';
    const factFill = store.has_fact ? (store.fact_late ? 'FFFEF9C3' : 'FFD1FAE5') : 'FFF3F4F6';
    const factFont = store.has_fact ? (store.fact_late ? 'FF854D0E' : 'FF166534') : 'FF6B7280';
    const factVal = store.has_fact ? (store.fact_late ? '⏰ Есть' : '✅ Есть') : '— Нет';
    return [
      cell(store.store_number, cs(zebra, 'FF111827', true)),
      cell(store.director_name || '—', cs(zebra, 'FF374151', false, 'left')),
      cell(planVal, cs(planFill, planFont, true)),
      cell(store.plan_time || '—', cs(zebra, 'FF374151')),
      cell(factVal, cs(factFill, factFont)),
      cell(store.fact_time || '—', cs(zebra, 'FF374151')),
      pctCell(store.completion ?? store.today_completion ?? null)
    ];
  });

  const ws = buildSheet(`Дашборд · ${today}`, headers, rows, [10, 24, 12, 14, 12, 14, 12]);
  XLSXStyle.utils.book_append_sheet(wb, ws, 'Дашборд');
  saveWb(wb, `kari-dashboard-${new Date().toLocaleDateString('ru-RU').replace(/\./g,'-')}.xlsx`);
}
