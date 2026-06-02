import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import api from '../api/client';
import { formatDate } from '../utils/dateUtils';

const KPI_LABELS = {
  ui_percent: 'ЮИ %',
  gold_qty: 'Золото',
  silver_qty: 'Серебро',
  finmoll_qty: 'Финмолл',
  kari_qty: 'Kari Частями',
  yandex_qty: 'Яндекс',
  items_per_receipt: 'Штук/чек',
  conversion_shoes: 'Конв.обувь',
  conversion_insoles: 'Конв.стельки',
  sbp_share: 'Доля СБП',
  mp_install_qty: 'Установка МП'
};

const DAY_NAMES = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];

function cellColor(day) {
  if (!day || day.plan_missing) return 'bg-red-100 text-red-400';
  if (day.completion == null) return 'bg-yellow-50 text-yellow-600';
  if (day.plan_late && day.completion >= 90) return 'bg-yellow-100 text-yellow-800';
  if (day.plan_late) return 'bg-orange-100 text-orange-700';
  if (day.completion >= 90) return 'bg-green-100 text-green-700';
  if (day.completion >= 70) return 'bg-lime-100 text-lime-700';
  return 'bg-red-50 text-red-600';
}

function CellTooltip({ day, date }) {
  if (!day || day.plan_missing) return (
    <div className="text-xs text-center text-red-500 font-medium">Нет плана</div>
  );
  return (
    <div className="space-y-0.5 text-xs">
      <div className={`font-semibold ${day.plan_late ? 'text-orange-600' : 'text-green-600'}`}>
        План: {day.plan_time || '—'} {day.plan_late ? '⏰' : '✓'}
      </div>
      {day.fact_time && (
        <div className={day.fact_late ? 'text-orange-600' : 'text-gray-600'}>
          Факт: {day.fact_time} {day.fact_late ? '⏰' : '✓'}
        </div>
      )}
      {day.completion != null && (
        <div className="font-bold">{day.completion}% выполн.</div>
      )}
      {Object.entries(day.kpis || {}).slice(0,5).map(([k, v]) => (
        v.pct != null && <div key={k} className="text-gray-500">{KPI_LABELS[k]}: {v.pct}%</div>
      ))}
    </div>
  );
}

function dateToWeekStr(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const jan4 = new Date(year, 0, 4);
  const startOfW1 = new Date(jan4);
  startOfW1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const weekNum = Math.floor((d - startOfW1) / (7 * 86400000)) + 1;
  // Handle year boundary
  if (weekNum < 1) return dateToWeekStr(new Date(year - 1, 11, 28));
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

function getDefaultWeek() {
  return dateToWeekStr(new Date());
}

function shiftWeek(weekStr, delta) {
  // Parse week string, shift by delta weeks
  const [y, w] = weekStr.split('-W').map(Number);
  const jan4 = new Date(y, 0, 4);
  const startOfW1 = new Date(jan4);
  startOfW1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const monday = new Date(startOfW1);
  monday.setDate(startOfW1.getDate() + (w - 1) * 7 + delta * 7);
  return dateToWeekStr(monday);
}

export default function DirectorReport() {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [period, setPeriod] = useState('month'); // 'month' | 'week'
  const [month, setMonth] = useState(defaultMonth);
  const [week, setWeek] = useState(getDefaultWeek());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState(null);
  const [expandedStore, setExpandedStore] = useState(null);
  const tooltipRef = useRef(null);

  useEffect(() => { loadReport(); }, [period, month, week]);

  async function loadReport() {
    setLoading(true);
    try {
      const url = period === 'week'
        ? `/analytics/weekly-report?week=${week}`
        : `/analytics/monthly-report?month=${month}`;
      const d = await api.get(url);
      setData(d);
    } catch {}
    finally { setLoading(false); }
  }

  function exportExcel() {
    if (!data) return;
    const wb = XLSX.utils.book_new();

    // Sheet 1: Summary per director
    const summaryRows = [
      ['Магазин', 'Директор', 'Заполнено %', 'Ср. выполн. %', 'Просрочек план', 'Пропусков план']
    ];
    for (const s of data.stores) {
      summaryRows.push([
        s.store_number, s.director_name,
        s.summary.fill_rate, s.summary.avg_completion ?? '—',
        s.summary.late_plans, s.summary.missing_plans
      ]);
    }
    const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
    ws1['!cols'] = [12,30,14,16,16,16].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws1, 'Сводка');

    // Sheet 2: Daily detail
    const kpiKeys = Object.keys(KPI_LABELS);
    const header = [
      'Магазин', 'Директор', 'Дата', 'День недели',
      'Время плана', 'Просрочка плана',
      'Время факта', 'Просрочка факта',
      'Ср. выполн. %',
      ...kpiKeys.flatMap(k => [`${KPI_LABELS[k]} план`, `${KPI_LABELS[k]} факт`, `${KPI_LABELS[k]} %`])
    ];
    const detailRows = [header];
    for (const s of data.stores) {
      for (const d of data.working_days) {
        const day = s.days[d];
        if (!day) continue;
        const weekday = DAY_NAMES[new Date(d + 'T12:00:00').getDay()];
        const kpiCols = kpiKeys.flatMap(k => {
          const v = day.kpis?.[k];
          return [v?.plan ?? '', v?.fact ?? '', v?.pct ?? ''];
        });
        detailRows.push([
          s.store_number, s.director_name,
          d.split('-').reverse().join('.'), weekday,
          day.plan_time || '', day.plan_late ? 'Да' : day.plan_missing ? 'Нет плана' : 'Нет',
          day.fact_time || '', day.fact_late ? 'Да' : day.fact_missing ? 'Нет факта' : 'Нет',
          day.completion ?? '',
          ...kpiCols
        ]);
      }
    }
    const ws2 = XLSX.utils.aoa_to_sheet(detailRows);
    XLSX.utils.book_append_sheet(wb, ws2, 'По дням');

    // Sheet 3: Violations
    const violRows = [['Магазин', 'Директор', 'Дата', 'Тип', 'Время подачи']];
    for (const s of data.stores) {
      for (const d of data.working_days) {
        const day = s.days[d];
        if (!day) continue;
        if (day.plan_late) violRows.push([s.store_number, s.director_name, d.split('-').reverse().join('.'), 'План', day.plan_time]);
        if (day.fact_late) violRows.push([s.store_number, s.director_name, d.split('-').reverse().join('.'), 'Факт', day.fact_time]);
        if (day.plan_missing) violRows.push([s.store_number, s.director_name, d.split('-').reverse().join('.'), 'Нет плана', '']);
      }
    }
    const ws3 = XLSX.utils.aoa_to_sheet(violRows);
    XLSX.utils.book_append_sheet(wb, ws3, 'Нарушения');

    const filename = period === 'week' ? `kari-report-week-${week}.xlsx` : `kari-report-${month}.xlsx`;
    XLSX.writeFile(wb, filename);
  }

  function getPeriodLabel() {
    if (period === 'week') {
      if (!data?.working_days?.length) return `Неделя ${week}`;
      const first = data.working_days[0];
      const last = data.working_days[data.working_days.length - 1];
      const fmt = d => new Date(d + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
      return `${fmt(first)} — ${fmt(last)}`;
    }
    return new Date(month + '-15').toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  }

  const monthLabel = getPeriodLabel();

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <div className="text-center"><div className="text-3xl animate-spin mb-2">⟳</div><p>Загрузка отчёта...</p></div>
    </div>
  );

  if (!data) return null;

  const days = data.working_days;
  const totalStores = data.stores.length;
  const totalLate = data.stores.reduce((s, x) => s + x.summary.late_plans, 0);
  const totalMissing = data.stores.reduce((s, x) => s + x.summary.missing_plans, 0);
  const avgFill = Math.round(data.stores.reduce((s, x) => s + x.summary.fill_rate, 0) / totalStores);
  const avgCompl = Math.round(
    data.stores.filter(x => x.summary.avg_completion != null).reduce((s, x) => s + x.summary.avg_completion, 0) /
    Math.max(1, data.stores.filter(x => x.summary.avg_completion != null).length)
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📋 Отчёт по директорам</h1>
          <p className="text-gray-500 text-sm mt-0.5 capitalize">{monthLabel}</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <div className="flex rounded-lg overflow-hidden border border-gray-200">
            <button
              onClick={() => setPeriod('month')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${period === 'month' ? 'bg-red-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              Месяц
            </button>
            <button
              onClick={() => setPeriod('week')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${period === 'week' ? 'bg-red-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              Неделя
            </button>
          </div>
          {period === 'month' ? (
            <input
              type="month"
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="input text-sm"
            />
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setWeek(w => shiftWeek(w, -1))}
                className="btn-secondary px-2.5 py-1.5 text-base"
                title="Предыдущая неделя"
              >←</button>
              <input
                type="week"
                value={week}
                onChange={e => e.target.value && setWeek(e.target.value)}
                className="input text-sm"
              />
              <button
                onClick={() => setWeek(w => shiftWeek(w, 1))}
                className="btn-secondary px-2.5 py-1.5 text-base"
                title="Следующая неделя"
              >→</button>
            </div>
          )}
          <button onClick={exportExcel} className="btn-primary flex items-center gap-2">
            📥 Скачать Excel
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Заполнено в среднем', value: `${avgFill}%`, color: avgFill >= 80 ? 'text-green-600' : 'text-yellow-600' },
          { label: 'Среднее выполнение', value: `${avgCompl}%`, color: avgCompl >= 90 ? 'text-green-600' : avgCompl >= 70 ? 'text-yellow-600' : 'text-red-600' },
          { label: 'Просрочек плана', value: totalLate, color: totalLate === 0 ? 'text-green-600' : 'text-orange-600' },
          { label: 'Пропусков плана', value: totalMissing, color: totalMissing === 0 ? 'text-green-600' : 'text-red-600' }
        ].map(c => (
          <div key={c.label} className="card p-4 text-center">
            <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
            <div className="text-xs text-gray-500 mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {[
          { color: 'bg-green-100', label: '≥90% вовремя' },
          { color: 'bg-lime-100', label: '70–89% вовремя' },
          { color: 'bg-yellow-100', label: '≥90% с просрочкой' },
          { color: 'bg-orange-100', label: '<90% с просрочкой' },
          { color: 'bg-red-50', label: '<70%' },
          { color: 'bg-red-100', label: 'Нет плана' },
          { color: 'bg-gray-100', label: 'Только план' }
        ].map(l => (
          <span key={l.label} className="flex items-center gap-1">
            <span className={`w-4 h-4 rounded ${l.color} border border-gray-200 inline-block`} />
            {l.label}
          </span>
        ))}
      </div>

      {/* Matrix table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="text-xs border-collapse" style={{ minWidth: `${200 + days.length * 52}px` }}>
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="sticky left-0 z-10 bg-gray-50 text-left px-3 py-2 font-semibold text-gray-700 w-20 border-r border-gray-200">Магазин</th>
                <th className="sticky left-20 z-10 bg-gray-50 text-left px-3 py-2 font-semibold text-gray-700 w-36 border-r border-gray-200">Директор</th>
                <th className="px-2 py-2 font-semibold text-gray-700 border-r border-gray-100 w-14 text-center">Завол.<br/>%</th>
                <th className="px-2 py-2 font-semibold text-gray-700 border-r border-gray-200 w-14 text-center">Ср.вып.<br/>%</th>
                {days.map(d => {
                  const dt = new Date(d + 'T12:00:00');
                  const dn = DAY_NAMES[dt.getDay()];
                  const day = dt.getDate();
                  return (
                    <th key={d} className="px-1 py-1 text-center font-medium text-gray-500 w-12 border-l border-gray-100">
                      <div className="text-gray-400">{dn}</div>
                      <div className="font-semibold text-gray-700">{day}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {data.stores.map((store, si) => (
                <React.Fragment key={store.store_id}>
                  <tr
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                    onClick={() => setExpandedStore(expandedStore === store.store_id ? null : store.store_id)}
                  >
                    <td className="sticky left-0 z-10 bg-white px-3 py-1.5 font-bold text-gray-900 border-r border-gray-200 whitespace-nowrap">
                      {store.store_number}
                    </td>
                    <td className="sticky left-20 z-10 bg-white px-3 py-1.5 text-gray-600 border-r border-gray-200 max-w-[140px] truncate">
                      {store.director_name}
                    </td>
                    <td className={`px-1 py-1.5 text-center font-semibold border-r border-gray-100 ${store.summary.fill_rate >= 80 ? 'text-green-600' : 'text-yellow-600'}`}>
                      {store.summary.fill_rate}%
                    </td>
                    <td className={`px-1 py-1.5 text-center font-semibold border-r border-gray-200 ${
                      store.summary.avg_completion == null ? 'text-gray-300' :
                      store.summary.avg_completion >= 90 ? 'text-green-600' :
                      store.summary.avg_completion >= 70 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {store.summary.avg_completion != null ? `${store.summary.avg_completion}%` : '—'}
                    </td>
                    {days.map(d => {
                      const day = store.days[d];
                      return (
                        <td
                          key={d}
                          className={`relative px-0.5 py-0.5 text-center border-l border-gray-100 group`}
                          onMouseEnter={e => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setTooltip({ si, d, x: rect.left, y: rect.bottom });
                          }}
                          onMouseLeave={() => setTooltip(null)}
                        >
                          <div className={`rounded text-center py-1 px-0.5 ${cellColor(day)}`}>
                            {day?.plan_missing ? (
                              <span className="text-red-400 font-bold">✗</span>
                            ) : day?.completion != null ? (
                              <span className="font-bold">{day.completion}%</span>
                            ) : day?.plan_time ? (
                              <span className="text-gray-400">—</span>
                            ) : (
                              <span className="text-gray-200">·</span>
                            )}
                            {day && !day.plan_missing && (
                              <div className={`text-center leading-none mt-0.5 ${day.plan_late ? 'text-orange-500' : 'text-gray-400'}`}>
                                {day.plan_late ? '⏰' : day.plan_time ? '✓' : ''}
                              </div>
                            )}
                          </div>
                          {/* Tooltip */}
                          {tooltip?.si === si && tooltip?.d === d && (
                            <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 w-40 text-left pointer-events-none">
                              <div className="font-semibold text-gray-700 mb-1 text-xs">{d.split('-').reverse().join('.')}</div>
                              <CellTooltip day={day} date={d} />
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                  {/* Expanded KPI breakdown */}
                  {expandedStore === store.store_id && (
                    <tr className="bg-blue-50 border-b border-blue-100">
                      <td colSpan={4} className="sticky left-0 z-10 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 border-r border-blue-200">
                        Детализация KPI
                      </td>
                      {days.map(d => {
                        const day = store.days[d];
                        const kpis = day?.kpis || {};
                        return (
                          <td key={d} className="px-0.5 py-1 border-l border-blue-100 align-top">
                            <div className="space-y-0.5">
                              {Object.entries(kpis).map(([k, v]) => (
                                v.pct != null && (
                                  <div key={k} className={`text-center text-xs rounded px-0.5 ${v.pct >= 90 ? 'bg-green-100 text-green-700' : v.pct >= 70 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'}`}>
                                    {v.pct}%
                                  </div>
                                )
                              ))}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400">
          Нажмите на строку чтобы раскрыть детализацию KPI по дням · Наведите на ячейку для подробностей
        </div>
      </div>

      {/* Violations summary table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 font-semibold text-gray-800">
          ⚠️ Сводка нарушений · {monthLabel}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 border-b border-gray-100">
              <tr>
                <th className="table-header">Магазин</th>
                <th className="table-header">Директор</th>
                <th className="table-header text-center">Заполнено %</th>
                <th className="table-header text-center">Ср. выполн. %</th>
                <th className="table-header text-center">Просрочек плана</th>
                <th className="table-header text-center">Пропусков плана</th>
                <th className="table-header text-center">Итого нарушений</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[...data.stores]
                .sort((a, b) => (b.summary.late_plans + b.summary.missing_plans) - (a.summary.late_plans + a.summary.missing_plans))
                .map(s => {
                  const total = s.summary.late_plans + s.summary.missing_plans;
                  return (
                    <tr key={s.store_id} className={total > 5 ? 'bg-red-50' : total > 2 ? 'bg-yellow-50' : ''}>
                      <td className="table-cell font-semibold text-gray-900">{s.store_number}</td>
                      <td className="table-cell text-gray-600 text-xs max-w-[160px] truncate">{s.director_name}</td>
                      <td className={`table-cell text-center font-semibold ${s.summary.fill_rate >= 80 ? 'text-green-600' : 'text-yellow-600'}`}>
                        {s.summary.fill_rate}%
                      </td>
                      <td className={`table-cell text-center font-semibold ${
                        s.summary.avg_completion == null ? 'text-gray-300' :
                        s.summary.avg_completion >= 90 ? 'text-green-600' :
                        s.summary.avg_completion >= 70 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {s.summary.avg_completion != null ? `${s.summary.avg_completion}%` : '—'}
                      </td>
                      <td className={`table-cell text-center ${s.summary.late_plans > 0 ? 'text-orange-600 font-semibold' : 'text-gray-400'}`}>
                        {s.summary.late_plans}
                      </td>
                      <td className={`table-cell text-center ${s.summary.missing_plans > 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                        {s.summary.missing_plans}
                      </td>
                      <td className={`table-cell text-center font-bold ${total > 5 ? 'text-red-600' : total > 2 ? 'text-orange-600' : total > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                        {total === 0 ? '✓' : total}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
