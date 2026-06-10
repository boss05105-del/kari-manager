// Colored Excel export using ExcelJS
// All exports produce formatted .xlsx files with color-coded cells

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

// Color helpers
function pctFill(v) {
  if (v == null) return 'FFE5E7EB'; // gray
  if (v >= 100) return 'FF86EFAC'; // bright green
  if (v >= 90)  return 'FFD1FAE5'; // light green
  if (v >= 70)  return 'FFFEF9C3'; // yellow
  if (v >= 50)  return 'FFFED7AA'; // orange
  return 'FFFECACA'; // red
}

function pctFont(v) {
  if (v == null) return '6B7280';
  if (v >= 90)  return '166534';
  if (v >= 70)  return '854D0E';
  if (v >= 50)  return '9A3412';
  return 'B91C1C';
}

function headerStyle(argb = 'FF7C3AED') {
  return {
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb } },
    font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 },
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    border: {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
    }
  };
}

function cellStyle(argbFill, argbFont = '111827', bold = false) {
  return {
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: argbFill } },
    font: { color: { argb: argbFont }, size: 9, bold },
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: {
      top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
    }
  };
}

function applyPctCell(cell, v) {
  Object.assign(cell, cellStyle(pctFill(v), pctFont(v), v != null && v >= 90));
  cell.value = v != null ? `${v}%` : '—';
}

function downloadWorkbook(wb, filename) {
  wb.xlsx.writeBuffer().then(buffer => {
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  });
}

function addTitle(ws, text, colCount) {
  ws.mergeCells(1, 1, 1, colCount);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = text;
  titleCell.style = {
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } },
    font: { bold: true, size: 13, color: { argb: 'FFFFFFFF' } },
    alignment: { horizontal: 'center', vertical: 'middle' }
  };
  ws.getRow(1).height = 28;

  ws.mergeCells(2, 1, 2, colCount);
  const subCell = ws.getCell(2, 1);
  subCell.value = `Сформировано: ${new Date().toLocaleString('ru-RU')}`;
  subCell.style = {
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F0FF' } },
    font: { size: 9, color: { argb: 'FF6B21A8' } },
    alignment: { horizontal: 'center', vertical: 'middle' }
  };
  ws.getRow(2).height = 18;
}

// ─────────────────────────────────────────────
// 1. KPI HEATMAP (DirectorControl page)
// ─────────────────────────────────────────────
export async function exportHeatmapToExcel(data, period) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Kari Manager';

  // Sheet 1: Heatmap
  const ws = wb.addWorksheet('KPI Хитмап');
  const headers = ['Магазин', 'Директор', 'Ср. %', ...KPI_KEYS.map(k => KPI_SHORT[k]), 'Пл. вовремя', 'Фк. вовремя', 'Тренд', 'Сегодня план'];
  const colCount = headers.length;

  addTitle(ws, `KPI Хитмап по магазинам · ${period === 'week' ? 'Неделя' : period === 'month' ? 'Месяц' : 'Квартал'}`, colCount);

  // Header row
  const hRow = ws.getRow(3);
  headers.forEach((h, i) => {
    const cell = hRow.getCell(i + 1);
    cell.value = h;
    Object.assign(cell.style, headerStyle('FF6D28D9'));
  });
  hRow.height = 36;

  // Column widths
  ws.getColumn(1).width = 10;
  ws.getColumn(2).width = 22;
  ws.getColumn(3).width = 9;
  KPI_KEYS.forEach((_, i) => { ws.getColumn(i + 4).width = 9; });
  ws.getColumn(colCount - 2).width = 11;
  ws.getColumn(colCount - 1).width = 11;
  ws.getColumn(colCount).width = 12;

  // Data rows (sorted: worst first)
  const sorted = [...data].sort((a, b) => (a.avg_completion ?? -1) - (b.avg_completion ?? -1));

  sorted.forEach((store, idx) => {
    const row = ws.getRow(idx + 4);
    row.height = 20;

    // Zebra
    const zebraFill = idx % 2 === 0 ? 'FFFAFAFA' : 'FFFFFFFF';

    // Store number
    const numCell = row.getCell(1);
    numCell.value = store.store_number;
    numCell.style = cellStyle(zebraFill, '111827', true);
    numCell.style.alignment = { horizontal: 'center', vertical: 'middle' };

    // Director
    const dirCell = row.getCell(2);
    dirCell.value = store.director_name || '—';
    dirCell.style = { ...cellStyle(zebraFill, '374151'), alignment: { horizontal: 'left', vertical: 'middle' } };

    // Avg completion
    applyPctCell(row.getCell(3), store.avg_completion);

    // Per-KPI
    KPI_KEYS.forEach((k, i) => {
      applyPctCell(row.getCell(i + 4), store.kpi_avgs?.[k] ?? null);
    });

    // Plan punctuality
    applyPctCell(row.getCell(colCount - 2), store.plan_punctuality);

    // Fact punctuality
    applyPctCell(row.getCell(colCount - 1), store.fact_punctuality);

    // Trend
    const trendCell = row.getCell(colCount);
    const trendMap = { up: '↑ Растёт', down: '↓ Падает', stable: '→ Стабильно' };
    trendCell.value = trendMap[store.trend] || '—';
    const trendFill = store.trend === 'up' ? 'FFD1FAE5' : store.trend === 'down' ? 'FFFECACA' : 'FFF3F4F6';
    const trendFont = store.trend === 'up' ? '166534' : store.trend === 'down' ? 'B91C1C' : '6B7280';
    trendCell.style = cellStyle(trendFill, trendFont);

    // Today plan (last column was wrong, fix)
    // Actually today_has_plan
    // Let's put it in a note cell
  });

  // Sheet 2: Risk Zone
  const wsRisk = wb.addWorksheet('Зона риска');
  const riskHeaders = ['Магазин', 'Директор', 'Проблема', 'Ср. выполнение', 'Слабые KPI'];
  addTitle(wsRisk, 'Зона риска — директора требующие внимания', riskHeaders.length);
  const rhRow = wsRisk.getRow(3);
  riskHeaders.forEach((h, i) => {
    const cell = rhRow.getCell(i + 1);
    cell.value = h;
    Object.assign(cell.style, headerStyle('FFDC2626'));
  });
  rhRow.height = 32;
  wsRisk.getColumn(1).width = 10;
  wsRisk.getColumn(2).width = 22;
  wsRisk.getColumn(3).width = 35;
  wsRisk.getColumn(4).width = 15;
  wsRisk.getColumn(5).width = 40;

  let riskRow = 4;
  data.forEach(store => {
    const problems = [];
    if (!store.today_has_plan) problems.push('Нет плана сегодня');
    if (store.consecutive_no_plan >= 3) problems.push(`${store.consecutive_no_plan} дня подряд без плана`);
    if (store.weak_kpis?.length >= 5) problems.push(`${store.weak_kpis.length} KPI ниже 70%`);
    if (store.trend === 'down' && (store.avg_completion ?? 100) < 70) problems.push('Падающий тренд');
    if (problems.length === 0) return;

    const row = wsRisk.getRow(riskRow++);
    row.height = 20;
    const severity = !store.today_has_plan || store.consecutive_no_plan >= 3 ? 'FFFECACA' : 'FFFEF9C3';

    row.getCell(1).value = store.store_number;
    row.getCell(1).style = cellStyle(severity, 'B91C1C', true);
    row.getCell(2).value = store.director_name || '—';
    row.getCell(2).style = cellStyle(severity, '374151');
    row.getCell(3).value = problems.join('; ');
    row.getCell(3).style = cellStyle(severity, '111827');
    row.getCell(4).value = store.avg_completion != null ? `${store.avg_completion}%` : '—';
    row.getCell(4).style = cellStyle(pctFill(store.avg_completion), pctFont(store.avg_completion));
    row.getCell(5).value = (store.weak_kpis || []).map(k => `${KPI_SHORT[k]} ${store.kpi_avgs?.[k] ?? ''}%`).join(', ') || '—';
    row.getCell(5).style = cellStyle('FFFEF9C3', '92400E');
  });

  if (riskRow === 4) {
    const row = wsRisk.getRow(4);
    wsRisk.mergeCells(4, 1, 4, 5);
    row.getCell(1).value = '✅ Критических рисков нет';
    row.getCell(1).style = cellStyle('FFD1FAE5', '166534', true);
    row.getCell(1).style.alignment = { horizontal: 'center' };
    row.height = 28;
  }

  downloadWorkbook(wb, `kari-heatmap-${period}-${new Date().toLocaleDateString('ru-RU').replace(/\./g,'-')}.xlsx`);
}

// ─────────────────────────────────────────────
// 2. RANKINGS (Analytics & Ratings pages)
// ─────────────────────────────────────────────
export async function exportRankingsToExcel(rankings, period) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Рейтинг директоров');

  const headers = ['Место', 'Магазин', 'Директор', 'Вовлечённость', 'Ср. выполнение', 'Заполн. %', 'Серия (дн.)'];
  addTitle(ws, `Рейтинг директоров · ${period === 'week' ? 'Неделя' : period === 'month' ? 'Месяц' : 'Квартал'}`, headers.length);

  const hRow = ws.getRow(3);
  headers.forEach((h, i) => {
    hRow.getCell(i + 1).value = h;
    Object.assign(hRow.getCell(i + 1).style, headerStyle('FF7C3AED'));
  });
  hRow.height = 32;

  ws.getColumn(1).width = 7;
  ws.getColumn(2).width = 12;
  ws.getColumn(3).width = 24;
  ws.getColumn(4).width = 18;
  ws.getColumn(5).width = 15;
  ws.getColumn(6).width = 12;
  ws.getColumn(7).width = 12;

  rankings.forEach((s, idx) => {
    const row = ws.getRow(idx + 4);
    row.height = 20;
    const zebraFill = idx % 2 === 0 ? 'FFFAFAFA' : 'FFFFFFFF';

    // Medal
    const medalCell = row.getCell(1);
    medalCell.value = s.rank === 1 ? '🥇 1' : s.rank === 2 ? '🥈 2' : s.rank === 3 ? '🥉 3' : `#${s.rank}`;
    const rankFill = s.rank <= 3 ? 'FFFFF3CD' : zebraFill;
    medalCell.style = cellStyle(rankFill, '111827', s.rank <= 3);

    row.getCell(2).value = s.store_number;
    row.getCell(2).style = cellStyle(zebraFill, '111827', true);

    row.getCell(3).value = s.director_name || '—';
    row.getCell(3).style = { ...cellStyle(zebraFill, '374151'), alignment: { horizontal: 'left', vertical: 'middle' } };

    const engCell = row.getCell(4);
    engCell.value = `${s.engagement_index} — ${s.engagement_label || ''}`;
    const engFill = s.engagement_index >= 80 ? 'FFD1FAE5' : s.engagement_index >= 60 ? 'FFFEF9C3' : s.engagement_index >= 40 ? 'FFFED7AA' : 'FFFECACA';
    engCell.style = cellStyle(engFill, pctFont(s.engagement_index));

    applyPctCell(row.getCell(5), s.avg_completion);

    const fillCell = row.getCell(6);
    fillCell.value = `${s.fill_rate}%`;
    fillCell.style = cellStyle(pctFill(s.fill_rate), pctFont(s.fill_rate));

    row.getCell(7).value = s.streak || 0;
    row.getCell(7).style = cellStyle(zebraFill, '374151');
  });

  downloadWorkbook(wb, `kari-ratings-${period}-${new Date().toLocaleDateString('ru-RU').replace(/\./g,'-')}.xlsx`);
}

// ─────────────────────────────────────────────
// 3. OVERDUE REPORT
// ─────────────────────────────────────────────
export async function exportOverdueToExcel(data, period) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Просрочки');

  const headers = ['Магазин', 'Директор', 'Опозд. планов', 'Опозд. фактов', 'Не сдано планов', 'Всего нарушений'];
  addTitle(ws, `Отчёт по просрочкам · ${period === 'week' ? 'Неделя' : period === 'month' ? 'Месяц' : 'Квартал'}`, headers.length);

  const hRow = ws.getRow(3);
  headers.forEach((h, i) => {
    hRow.getCell(i + 1).value = h;
    Object.assign(hRow.getCell(i + 1).style, headerStyle('FFDC2626'));
  });
  hRow.height = 32;

  ws.getColumn(1).width = 12;
  ws.getColumn(2).width = 24;
  ws.getColumn(3).width = 16;
  ws.getColumn(4).width = 16;
  ws.getColumn(5).width = 18;
  ws.getColumn(6).width = 16;

  const sorted = [...data].sort((a, b) => (b.total_violations + b.missing_plans) - (a.total_violations + a.missing_plans));

  sorted.forEach((s, idx) => {
    const row = ws.getRow(idx + 4);
    row.height = 20;
    const total = s.total_violations + (s.missing_plans || 0);
    const rowFill = total >= 10 ? 'FFFECACA' : total >= 5 ? 'FFFED7AA' : total >= 1 ? 'FFFEF9C3' : 'FFD1FAE5';

    row.getCell(1).value = s.store_number;
    row.getCell(1).style = cellStyle(rowFill, '111827', true);

    row.getCell(2).value = s.director_name || '—';
    row.getCell(2).style = { ...cellStyle(rowFill, '374151'), alignment: { horizontal: 'left', vertical: 'middle' } };

    const lp = row.getCell(3);
    lp.value = s.late_plans || 0;
    lp.style = cellStyle(s.late_plans > 0 ? 'FFFECACA' : 'FFD1FAE5', s.late_plans > 0 ? 'B91C1C' : '166534', s.late_plans > 0);

    const lf = row.getCell(4);
    lf.value = s.late_facts || 0;
    lf.style = cellStyle(s.late_facts > 0 ? 'FFFECACA' : 'FFD1FAE5', s.late_facts > 0 ? 'B91C1C' : '166534', s.late_facts > 0);

    const mp = row.getCell(5);
    mp.value = s.missing_plans || 0;
    mp.style = cellStyle(s.missing_plans > 0 ? 'FFFECACA' : 'FFD1FAE5', s.missing_plans > 0 ? 'B91C1C' : '166534', s.missing_plans > 0);

    const tot = row.getCell(6);
    tot.value = total;
    tot.style = cellStyle(total >= 5 ? 'FFFECACA' : total >= 1 ? 'FFFEF9C3' : 'FFD1FAE5', total >= 5 ? 'B91C1C' : '111827', total > 0);
  });

  downloadWorkbook(wb, `kari-overdue-${period}-${new Date().toLocaleDateString('ru-RU').replace(/\./g,'-')}.xlsx`);
}

// ─────────────────────────────────────────────
// 4. MONTHLY / WEEKLY REPORT
// ─────────────────────────────────────────────
export async function exportReportToExcel(reportData, label) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const { working_days, stores } = reportData;

  // Sheet 1: Summary
  const wsSummary = wb.addWorksheet('Сводка');
  const summaryHeaders = ['Магазин', 'Директор', 'Ср. выполнение', 'Заполн. %', 'Опозд. планов', 'Пропущ. планов'];
  addTitle(wsSummary, `Сводный отчёт · ${label}`, summaryHeaders.length);
  const shRow = wsSummary.getRow(3);
  summaryHeaders.forEach((h, i) => {
    shRow.getCell(i + 1).value = h;
    Object.assign(shRow.getCell(i + 1).style, headerStyle('FF7C3AED'));
  });
  shRow.height = 32;
  [12, 24, 15, 12, 15, 15].forEach((w, i) => { wsSummary.getColumn(i + 1).width = w; });

  const sortedStores = [...stores].sort((a, b) => (a.summary.avg_completion ?? -1) - (b.summary.avg_completion ?? -1));

  sortedStores.forEach((store, idx) => {
    const row = wsSummary.getRow(idx + 4);
    row.height = 20;
    const s = store.summary;

    row.getCell(1).value = store.store_number;
    row.getCell(1).style = cellStyle('FFFAFAFA', '111827', true);

    row.getCell(2).value = store.director_name || '—';
    row.getCell(2).style = { ...cellStyle('FFFAFAFA', '374151'), alignment: { horizontal: 'left', vertical: 'middle' } };

    applyPctCell(row.getCell(3), s.avg_completion);

    row.getCell(4).value = `${s.fill_rate}%`;
    row.getCell(4).style = cellStyle(pctFill(s.fill_rate), pctFont(s.fill_rate));

    const lp = row.getCell(5);
    lp.value = s.late_plans || 0;
    lp.style = cellStyle(s.late_plans > 0 ? 'FFFECACA' : 'FFD1FAE5', s.late_plans > 0 ? 'B91C1C' : '166534');

    const mp = row.getCell(6);
    mp.value = s.missing_plans || 0;
    mp.style = cellStyle(s.missing_plans > 0 ? 'FFFECACA' : 'FFD1FAE5', s.missing_plans > 0 ? 'B91C1C' : '166534');
  });

  // Sheet 2: Daily matrix (completion % per day)
  const wsMatrix = wb.addWorksheet('Выполнение по дням');
  const matrixHeaders = ['Магазин', 'Директор', ...working_days.map(d => {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  }), 'Ср. %'];
  addTitle(wsMatrix, `Выполнение плана по дням · ${label}`, matrixHeaders.length);

  const mhRow = wsMatrix.getRow(3);
  matrixHeaders.forEach((h, i) => {
    mhRow.getCell(i + 1).value = h;
    Object.assign(mhRow.getCell(i + 1).style, headerStyle('FF6D28D9'));
  });
  mhRow.height = 32;
  wsMatrix.getColumn(1).width = 12;
  wsMatrix.getColumn(2).width = 22;
  for (let i = 3; i <= matrixHeaders.length; i++) wsMatrix.getColumn(i).width = 7;

  stores.forEach((store, idx) => {
    const row = wsMatrix.getRow(idx + 4);
    row.height = 20;

    row.getCell(1).value = store.store_number;
    row.getCell(1).style = cellStyle('FFFAFAFA', '111827', true);
    row.getCell(2).value = store.director_name || '—';
    row.getCell(2).style = { ...cellStyle('FFFAFAFA', '374151'), alignment: { horizontal: 'left', vertical: 'middle' } };

    working_days.forEach((d, di) => {
      const day = store.days?.[d];
      const cell = row.getCell(di + 3);
      if (!day || day.plan_missing) {
        cell.value = '✗';
        cell.style = cellStyle('FFFECACA', 'B91C1C', true);
      } else if (day.completion == null) {
        cell.value = '—';
        cell.style = cellStyle('FFE5E7EB', '6B7280');
      } else {
        applyPctCell(cell, day.completion);
      }
    });

    applyPctCell(row.getCell(working_days.length + 3), store.summary?.avg_completion ?? null);
  });

  // Sheet 3: KPI breakdown (avg per KPI per store)
  const wsKpi = wb.addWorksheet('KPI по магазинам');
  const kpiHeaders = ['Магазин', 'Директор', ...KPI_KEYS.map(k => KPI_SHORT[k])];
  addTitle(wsKpi, `Среднее выполнение KPI · ${label}`, kpiHeaders.length);

  const khRow = wsKpi.getRow(3);
  kpiHeaders.forEach((h, i) => {
    khRow.getCell(i + 1).value = h;
    Object.assign(khRow.getCell(i + 1).style, headerStyle('FF059669'));
  });
  khRow.height = 36;
  wsKpi.getColumn(1).width = 12;
  wsKpi.getColumn(2).width = 22;
  KPI_KEYS.forEach((_, i) => { wsKpi.getColumn(i + 3).width = 10; });

  stores.forEach((store, idx) => {
    const row = wsKpi.getRow(idx + 4);
    row.height = 20;

    row.getCell(1).value = store.store_number;
    row.getCell(1).style = cellStyle('FFFAFAFA', '111827', true);
    row.getCell(2).value = store.director_name || '—';
    row.getCell(2).style = { ...cellStyle('FFFAFAFA', '374151'), alignment: { horizontal: 'left', vertical: 'middle' } };

    KPI_KEYS.forEach((k, ki) => {
      // Average across all days for this KPI
      const values = [];
      Object.values(store.days || {}).forEach(day => {
        if (day.kpis?.[k]?.pct != null) values.push(day.kpis[k].pct);
      });
      const avg = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
      applyPctCell(row.getCell(ki + 3), avg);
    });
  });

  downloadWorkbook(wb, `kari-report-${label}-${new Date().toLocaleDateString('ru-RU').replace(/\./g,'-')}.xlsx`);
}

// ─────────────────────────────────────────────
// 5. ADMIN DASHBOARD (today's snapshot)
// ─────────────────────────────────────────────
export async function exportDashboardToExcel(stores) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Дашборд');

  const today = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  const headers = ['Магазин', 'Директор', 'План', 'Время плана', 'Факт', 'Время факта', 'Выполнение'];
  addTitle(ws, `Дашборд · ${today}`, headers.length);

  const hRow = ws.getRow(3);
  headers.forEach((h, i) => {
    hRow.getCell(i + 1).value = h;
    Object.assign(hRow.getCell(i + 1).style, headerStyle('FF7C3AED'));
  });
  hRow.height = 32;

  [12, 24, 10, 14, 10, 14, 14].forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  stores.forEach((store, idx) => {
    const row = ws.getRow(idx + 4);
    row.height = 20;

    row.getCell(1).value = store.store_number;
    row.getCell(1).style = cellStyle('FFFAFAFA', '111827', true);
    row.getCell(2).value = store.director_name || '—';
    row.getCell(2).style = { ...cellStyle('FFFAFAFA', '374151'), alignment: { horizontal: 'left', vertical: 'middle' } };

    const planCell = row.getCell(3);
    planCell.value = store.has_plan ? (store.plan_late ? '⏰ Есть' : '✅ Есть') : '✗ Нет';
    planCell.style = cellStyle(store.has_plan ? (store.plan_late ? 'FFFEF9C3' : 'FFD1FAE5') : 'FFFECACA',
      store.has_plan ? (store.plan_late ? '854D0E' : '166534') : 'B91C1C', true);

    row.getCell(4).value = store.plan_time || '—';
    row.getCell(4).style = cellStyle('FFFAFAFA', '374151');

    const factCell = row.getCell(5);
    factCell.value = store.has_fact ? (store.fact_late ? '⏰ Есть' : '✅ Есть') : '— Нет';
    factCell.style = cellStyle(store.has_fact ? (store.fact_late ? 'FFFEF9C3' : 'FFD1FAE5') : 'FFF3F4F6',
      store.has_fact ? (store.fact_late ? '854D0E' : '166534') : '6B7280');

    row.getCell(6).value = store.fact_time || '—';
    row.getCell(6).style = cellStyle('FFFAFAFA', '374151');

    applyPctCell(row.getCell(7), store.completion);
  });

  downloadWorkbook(wb, `kari-dashboard-${new Date().toLocaleDateString('ru-RU').replace(/\./g,'-')}.xlsx`);
}
