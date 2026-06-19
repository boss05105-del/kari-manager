import React, { useState, useEffect, useMemo } from 'react';
import api from '../api/client';
import { exportReportToExcel } from '../utils/exportExcel';

const KPI_KEYS = [
  'ui_percent','gold_qty','silver_qty','finmoll_qty','kari_qty',
  'yandex_qty','items_per_receipt','conversion_shoes','conversion_insoles','sbp_share','mp_install_qty'
];
const KPI_LABEL = {
  ui_percent: 'Уровень сервиса', gold_qty: 'Золото (шт)', silver_qty: 'Серебро (шт)',
  finmoll_qty: 'Рассрочка Финмолл', kari_qty: 'Kari Частями', yandex_qty: 'Яндекс Сплит',
  items_per_receipt: 'Штук в чеке', conversion_shoes: 'Конверсия обувь',
  conversion_insoles: 'Конверсия стельки', sbp_share: 'Доля СБП', mp_install_qty: 'Установка МП'
};
const DAY_SHORT = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
const MONTH_NAMES = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

function pctCls(v) {
  if (v == null) return 'text-gray-400';
  if (v >= 100) return 'text-green-700 font-bold';
  if (v >= 90)  return 'text-green-600';
  if (v >= 70)  return 'text-yellow-600';
  if (v >= 50)  return 'text-orange-600';
  return 'text-red-600 font-semibold';
}
function pctBg(v) {
  if (v == null) return 'bg-gray-50';
  if (v >= 100) return 'bg-green-100';
  if (v >= 90)  return 'bg-green-50';
  if (v >= 70)  return 'bg-yellow-50';
  if (v >= 50)  return 'bg-orange-50';
  return 'bg-red-50';
}
function calColor(v, hasPlan) {
  if (!hasPlan) return 'bg-red-100 border-red-300 text-red-700';
  if (v == null) return 'bg-blue-50 border-blue-200 text-blue-600';
  if (v >= 90)   return 'bg-green-100 border-green-300 text-green-700';
  if (v >= 70)   return 'bg-yellow-100 border-yellow-300 text-yellow-700';
  if (v >= 50)   return 'bg-orange-100 border-orange-300 text-orange-700';
  return 'bg-red-100 border-red-300 text-red-700';
}

function toMonthStr(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function parseTime(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}
function avgTime(times) {
  const valid = times.filter(t => t != null);
  if (!valid.length) return null;
  const avg = Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
  return `${String(Math.floor(avg / 60)).padStart(2,'0')}:${String(avg % 60).padStart(2,'0')}`;
}

export default function PlanControl() {
  const now = new Date();
  const [selectedStore, setSelectedStore] = useState(null);
  const [stores, setStores] = useState([]);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [data, setData] = useState(null);
  const [prevData, setPrevData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [tab, setTab] = useState('calendar'); // calendar | discipline | compare

  // Load store list
  useEffect(() => {
    api.get('/stores').then(list => {
      const sorted = [...list].sort((a, b) => parseInt(a.store_number) - parseInt(b.store_number));
      setStores(sorted);
      if (sorted.length > 0) setSelectedStore(sorted[0].id);
    }).catch(() => {});
  }, []);

  // Load report data when store/month changes
  useEffect(() => {
    if (!selectedStore) return;
    setLoading(true);
    setSelectedDate(null);
    const monthStr = toMonthStr(year, month);
    const prevDate = new Date(year, month - 1, 1);
    const prevMonthStr = toMonthStr(prevDate.getFullYear(), prevDate.getMonth());

    Promise.all([
      api.get(`/analytics/monthly-report?month=${monthStr}`),
      api.get(`/analytics/monthly-report?month=${prevMonthStr}`)
    ]).then(([curr, prev]) => {
      setData(curr);
      setPrevData(prev);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [selectedStore, year, month]);

  const storeData = useMemo(() => {
    if (!data || !selectedStore) return null;
    return data.stores.find(s => s.store_id === selectedStore) || null;
  }, [data, selectedStore]);

  const prevStoreData = useMemo(() => {
    if (!prevData || !selectedStore) return null;
    return prevData.stores.find(s => s.store_id === selectedStore) || null;
  }, [prevData, selectedStore]);

  const workingDays = data?.working_days || [];

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const grid = [];
    // fill leading blanks (Mon-based)
    const startOffset = (firstDay + 6) % 7; // Mon=0
    for (let i = 0; i < startOffset; i++) grid.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const day = storeData?.days?.[dateStr];
      grid.push({ date: dateStr, day, d });
    }
    return grid;
  }, [year, month, storeData]);

  // KPI averages for current month
  const kpiAvgs = useMemo(() => {
    if (!storeData) return {};
    const totals = {}, counts = {};
    KPI_KEYS.forEach(k => { totals[k] = 0; counts[k] = 0; });
    Object.values(storeData.days || {}).forEach(day => {
      KPI_KEYS.forEach(k => {
        if (day.kpis?.[k]?.pct != null) {
          totals[k] += day.kpis[k].pct;
          counts[k]++;
        }
      });
    });
    const result = {};
    KPI_KEYS.forEach(k => { result[k] = counts[k] > 0 ? Math.round(totals[k] / counts[k]) : null; });
    return result;
  }, [storeData]);

  const prevKpiAvgs = useMemo(() => {
    if (!prevStoreData) return {};
    const totals = {}, counts = {};
    KPI_KEYS.forEach(k => { totals[k] = 0; counts[k] = 0; });
    Object.values(prevStoreData.days || {}).forEach(day => {
      KPI_KEYS.forEach(k => {
        if (day.kpis?.[k]?.pct != null) {
          totals[k] += day.kpis[k].pct;
          counts[k]++;
        }
      });
    });
    const result = {};
    KPI_KEYS.forEach(k => { result[k] = counts[k] > 0 ? Math.round(totals[k] / counts[k]) : null; });
    return result;
  }, [prevStoreData]);

  // Avg plan/fact times
  const avgPlanTime = useMemo(() => {
    if (!storeData) return null;
    return avgTime(Object.values(storeData.days || {}).map(d => parseTime(d.plan_time)));
  }, [storeData]);
  const avgFactTime = useMemo(() => {
    if (!storeData) return null;
    return avgTime(Object.values(storeData.days || {}).map(d => parseTime(d.fact_time)));
  }, [storeData]);

  // Discipline violations
  const violations = useMemo(() => {
    if (!storeData) return [];
    return workingDays
      .map(d => ({ date: d, ...storeData.days?.[d] }))
      .filter(d => d.plan_late || d.plan_missing || d.fact_late || d.fact_missing);
  }, [storeData, workingDays]);

  // Day rating (sorted by completion)
  const dayRating = useMemo(() => {
    if (!storeData) return [];
    return workingDays
      .map(d => ({ date: d, ...storeData.days?.[d] }))
      .filter(d => d.completion != null)
      .sort((a, b) => b.completion - a.completion);
  }, [storeData, workingDays]);

  const selectedDay = selectedDate ? storeData?.days?.[selectedDate] : null;
  const currentStore = stores.find(s => s.id === selectedStore);

  function shiftMonth(delta) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  const prevMonthName = () => {
    const d = new Date(year, month - 1, 1);
    return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  };

  return (
    <div className="space-y-5 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Контроль плана директора</h1>
          <p className="text-sm text-gray-500 mt-0.5">Ежедневный контроль постановки плана и выполнения KPI</p>
        </div>
        <button
          onClick={() => data && storeData && exportReportToExcel(
            { working_days: workingDays, stores: [storeData] },
            `${currentStore?.store_number}-${MONTH_NAMES[month]}-${year}`
          )}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
        >
          📥 Выгрузить в Excel
        </button>
      </div>

      {/* Controls */}
      <div className="card p-4 flex flex-wrap gap-4 items-end">
        {/* Store selector */}
        <div className="flex-1 min-w-[200px]">
          <label className="label text-xs text-gray-500 mb-1">Магазин / Директор</label>
          <select
            className="input text-sm"
            value={selectedStore || ''}
            onChange={e => setSelectedStore(Number(e.target.value))}
          >
            {stores.map(s => (
              <option key={s.id} value={s.id}>
                {s.store_number} — {s.director_name || 'Нет директора'}
              </option>
            ))}
          </select>
        </div>
        {/* Month selector */}
        <div>
          <label className="label text-xs text-gray-500 mb-1">Месяц</label>
          <div className="flex items-center gap-2">
            <button onClick={() => shiftMonth(-1)} className="btn-secondary px-2 py-1.5 text-sm">◀</button>
            <span className="font-semibold text-gray-800 w-36 text-center">
              {MONTH_NAMES[month]} {year}
            </span>
            <button onClick={() => shiftMonth(1)} className="btn-secondary px-2 py-1.5 text-sm">▶</button>
          </div>
        </div>
      </div>

      {loading && <div className="text-center py-12 text-gray-400">Загрузка...</div>}

      {!loading && storeData && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="card p-3 text-center">
              <div className="text-xs text-gray-500 mb-1">Планы сданы</div>
              <div className={`text-xl font-bold ${pctCls(storeData.summary.fill_rate)}`}>
                {storeData.summary.fill_rate}%
              </div>
              <div className="text-xs text-gray-400">{storeData.summary.fill_rate != null ? Math.round((workingDays.length * storeData.summary.fill_rate)/100) : 0} из {workingDays.length} дн.</div>
            </div>
            <div className="card p-3 text-center">
              <div className="text-xs text-gray-500 mb-1">Ср. выполнение</div>
              <div className={`text-xl font-bold ${pctCls(storeData.summary.avg_completion)}`}>
                {storeData.summary.avg_completion ?? '—'}{storeData.summary.avg_completion != null ? '%' : ''}
              </div>
            </div>
            <div className="card p-3 text-center">
              <div className="text-xs text-gray-500 mb-1">Ср. время плана</div>
              <div className={`text-xl font-bold ${avgPlanTime && avgPlanTime < '11:00' ? 'text-green-600' : 'text-orange-600'}`}>
                {avgPlanTime || '—'}
              </div>
            </div>
            <div className="card p-3 text-center">
              <div className="text-xs text-gray-500 mb-1">Ср. время факта</div>
              <div className={`text-xl font-bold ${avgFactTime && avgFactTime < '23:30' ? 'text-green-600' : 'text-orange-600'}`}>
                {avgFactTime || '—'}
              </div>
            </div>
            <div className="card p-3 text-center">
              <div className="text-xs text-gray-500 mb-1">Нарушений</div>
              <div className={`text-xl font-bold ${violations.length === 0 ? 'text-green-600' : violations.length <= 3 ? 'text-yellow-600' : 'text-red-600'}`}>
                {violations.length}
              </div>
              <div className="text-xs text-gray-400">{storeData.summary.late_plans} поздних</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-gray-200">
            {[
              { key: 'calendar', label: '📅 Календарь' },
              { key: 'kpi', label: '📊 KPI за месяц' },
              { key: 'discipline', label: `⚠️ Дисциплина${violations.length > 0 ? ` (${violations.length})` : ''}` },
              { key: 'compare', label: '📈 Сравнение' },
              { key: 'rating', label: '🏆 Рейтинг дней' }
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.key ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── CALENDAR TAB ── */}
          {tab === 'calendar' && (
            <div className="space-y-4">
              {/* Calendar grid */}
              <div className="card p-4">
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d => (
                    <div key={d} className="text-center text-xs font-semibold text-gray-500 py-1">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((cell, i) => {
                    if (!cell) return <div key={i} />;
                    const { date, day, d } = cell;
                    const isSelected = selectedDate === date;
                    const isFuture = new Date(date) > new Date();
                    if (isFuture) return (
                      <div key={date} className="aspect-square rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-sm text-gray-300">
                        {d}
                      </div>
                    );
                    const hasPlan = day && !day.plan_missing;
                    return (
                      <button key={date}
                        onClick={() => setSelectedDate(isSelected ? null : date)}
                        className={`aspect-square rounded-lg border text-xs font-medium transition-all hover:opacity-80 flex flex-col items-center justify-center gap-0.5
                          ${calColor(day?.completion, hasPlan)}
                          ${isSelected ? 'ring-2 ring-purple-500 ring-offset-1' : ''}`}
                      >
                        <span className="text-sm font-bold">{d}</span>
                        {day?.completion != null && <span className="text-xs">{day.completion}%</span>}
                        {day?.plan_missing && <span className="text-xs">✗</span>}
                        {hasPlan && day?.completion == null && <span className="text-xs opacity-60">—</span>}
                      </button>
                    );
                  })}
                </div>
                {/* Legend */}
                <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 border border-green-300 inline-block"/> ≥90%</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300 inline-block"/> 70–89%</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-100 border border-orange-300 inline-block"/> 50–69%</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-300 inline-block"/> &lt;50% / нет плана</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-50 border border-blue-200 inline-block"/> план без факта</span>
                </div>
              </div>

              {/* Selected day detail */}
              {selectedDate && (
                <div className="card overflow-hidden">
                  <div className="px-4 py-3 bg-purple-50 border-b border-purple-100 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-purple-900">
                        {new Date(selectedDate + 'T12:00:00').toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </h3>
                      <div className="flex gap-4 text-sm text-purple-700 mt-0.5">
                        <span>📝 План: <strong>{selectedDay?.plan_time || '—'}</strong>{selectedDay?.plan_late ? ' ⏰ опоздание' : selectedDay?.plan_time ? ' ✓' : ''}</span>
                        <span>✅ Факт: <strong>{selectedDay?.fact_time || '—'}</strong>{selectedDay?.fact_late ? ' ⏰ опоздание' : selectedDay?.fact_time ? ' ✓' : ''}</span>
                        {selectedDay?.completion != null && <span>Итого: <strong className={pctCls(selectedDay.completion)}>{selectedDay.completion}%</strong></span>}
                      </div>
                    </div>
                    <button onClick={() => setSelectedDate(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
                  </div>

                  {selectedDay?.plan_missing ? (
                    <div className="p-6 text-center text-red-500 font-medium">
                      ✗ План на эту дату не был поставлен
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="table-header text-left">Показатель</th>
                            <th className="table-header">План</th>
                            <th className="table-header">Факт</th>
                            <th className="table-header">Выполнение</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {KPI_KEYS.map(k => {
                            const kpi = selectedDay?.kpis?.[k];
                            if (!kpi && !selectedDay?.kpis) return null;
                            return (
                              <tr key={k} className={`${pctBg(kpi?.pct)}`}>
                                <td className="table-cell text-left font-medium text-gray-700">{KPI_LABEL[k]}</td>
                                <td className="table-cell text-center">{kpi?.plan ?? '—'}</td>
                                <td className="table-cell text-center">{kpi?.fact ?? '—'}</td>
                                <td className={`table-cell text-center font-bold ${pctCls(kpi?.pct)}`}>
                                  {kpi?.pct != null ? `${kpi.pct}%` : '—'}
                                </td>
                              </tr>
                            );
                          })}
                          {selectedDay?.completion != null && (
                            <tr className="bg-purple-50 border-t-2 border-purple-200">
                              <td className="table-cell font-bold text-purple-800">Общий итог</td>
                              <td className="table-cell"/>
                              <td className="table-cell"/>
                              <td className={`table-cell text-center text-lg font-bold ${pctCls(selectedDay.completion)}`}>
                                {selectedDay.completion}%
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── KPI TAB ── */}
          {tab === 'kpi' && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800">Средний % выполнения по KPI за {MONTH_NAMES[month]}</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {KPI_KEYS.map(k => {
                  const v = kpiAvgs[k];
                  return (
                    <div key={k} className={`flex items-center gap-4 px-4 py-3 ${pctBg(v)}`}>
                      <div className="w-40 text-sm font-medium text-gray-700 shrink-0">{KPI_LABEL[k]}</div>
                      <div className="flex-1 bg-gray-200 rounded-full h-6 relative overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${v == null ? 'bg-gray-300' : v >= 90 ? 'bg-green-500' : v >= 70 ? 'bg-yellow-400' : v >= 50 ? 'bg-orange-400' : 'bg-red-500'}`}
                          style={{ width: `${Math.min(v ?? 0, 100)}%` }} />
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-800">
                          {v != null ? `${v}%` : 'нет данных'}
                        </span>
                      </div>
                      <div className={`w-14 text-right font-bold text-sm ${pctCls(v)}`}>
                        {v != null ? `${v}%` : '—'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── DISCIPLINE TAB ── */}
          {tab === 'discipline' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="card p-3 text-center">
                  <div className="text-xs text-gray-500 mb-1">Опоздания план</div>
                  <div className={`text-2xl font-bold ${storeData.summary.late_plans > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {storeData.summary.late_plans}
                  </div>
                </div>
                <div className="card p-3 text-center">
                  <div className="text-xs text-gray-500 mb-1">Пропуски план</div>
                  <div className={`text-2xl font-bold ${storeData.summary.missing_plans > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {storeData.summary.missing_plans}
                  </div>
                </div>
                <div className="card p-3 text-center">
                  <div className="text-xs text-gray-500 mb-1">Ср. время плана</div>
                  <div className={`text-2xl font-bold ${avgPlanTime && avgPlanTime <= '11:00' ? 'text-green-600' : 'text-orange-600'}`}>
                    {avgPlanTime || '—'}
                  </div>
                </div>
                <div className="card p-3 text-center">
                  <div className="text-xs text-gray-500 mb-1">Ср. время факта</div>
                  <div className={`text-2xl font-bold ${avgFactTime && avgFactTime <= '23:30' ? 'text-green-600' : 'text-orange-600'}`}>
                    {avgFactTime || '—'}
                  </div>
                </div>
              </div>

              {violations.length === 0 ? (
                <div className="card p-8 text-center">
                  <div className="text-3xl mb-2">✅</div>
                  <p className="font-medium text-green-700">Нарушений нет</p>
                  <p className="text-sm text-gray-400">Все планы и факты сданы вовремя</p>
                </div>
              ) : (
                <div className="card overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 bg-red-50">
                    <h3 className="font-semibold text-red-800">Дни с нарушениями ({violations.length})</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="table-header text-left">Дата</th>
                          <th className="table-header">Время плана</th>
                          <th className="table-header">Время факта</th>
                          <th className="table-header">Нарушение</th>
                          <th className="table-header">Выполнение</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {violations.map(v => {
                          const issues = [];
                          if (v.plan_missing) issues.push('❌ Нет плана');
                          else if (v.plan_late) issues.push('⏰ Опоздание плана');
                          if (v.fact_missing) issues.push('❌ Нет факта');
                          else if (v.fact_late) issues.push('⏰ Опоздание факта');
                          return (
                            <tr key={v.date} className="bg-red-50 hover:bg-red-100 cursor-pointer"
                              onClick={() => { setSelectedDate(v.date); setTab('calendar'); }}>
                              <td className="table-cell font-medium">
                                {new Date(v.date + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', weekday: 'short' })}
                              </td>
                              <td className="table-cell text-center">{v.plan_time || '—'}</td>
                              <td className="table-cell text-center">{v.fact_time || '—'}</td>
                              <td className="table-cell text-center text-red-700 font-medium">{issues.join(', ')}</td>
                              <td className={`table-cell text-center font-bold ${pctCls(v.completion)}`}>
                                {v.completion != null ? `${v.completion}%` : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── COMPARE TAB ── */}
          {tab === 'compare' && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800">
                  Сравнение: {MONTH_NAMES[month]} vs {prevMonthName()}
                </h3>
              </div>
              <div className="divide-y divide-gray-100">
                {/* Summary comparison */}
                <div className="grid grid-cols-3 gap-0 divide-x divide-gray-100 bg-gray-50">
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500">Показатель</div>
                  <div className="px-4 py-2 text-xs font-semibold text-purple-700">{MONTH_NAMES[month]}</div>
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500">{prevMonthName()}</div>
                </div>
                <div className="grid grid-cols-3 gap-0 divide-x divide-gray-100">
                  <div className="px-4 py-3 text-sm text-gray-700">Среднее выполнение</div>
                  <div className={`px-4 py-3 text-sm font-bold ${pctCls(storeData.summary.avg_completion)}`}>{storeData.summary.avg_completion ?? '—'}{storeData.summary.avg_completion != null ? '%' : ''}</div>
                  <div className={`px-4 py-3 text-sm font-bold ${pctCls(prevStoreData?.summary?.avg_completion)}`}>{prevStoreData?.summary?.avg_completion ?? '—'}{prevStoreData?.summary?.avg_completion != null ? '%' : ''}</div>
                </div>
                <div className="grid grid-cols-3 gap-0 divide-x divide-gray-100">
                  <div className="px-4 py-3 text-sm text-gray-700">Ср. время плана</div>
                  <div className="px-4 py-3 text-sm font-bold text-gray-800">{avgPlanTime || '—'}</div>
                  <div className="px-4 py-3 text-sm font-bold text-gray-500">{avgTime(Object.values(prevStoreData?.days || {}).map(d => parseTime(d.plan_time))) || '—'}</div>
                </div>
                <div className="grid grid-cols-3 gap-0 divide-x divide-gray-100">
                  <div className="px-4 py-3 text-sm text-gray-700">Нарушений</div>
                  <div className={`px-4 py-3 text-sm font-bold ${violations.length > 0 ? 'text-red-600' : 'text-green-600'}`}>{violations.length}</div>
                  <div className="px-4 py-3 text-sm font-bold text-gray-500">
                    {prevStoreData ? (prevStoreData.summary.late_plans + prevStoreData.summary.missing_plans) : '—'}
                  </div>
                </div>

                {/* KPI comparison */}
                <div className="grid grid-cols-3 gap-0 divide-x divide-gray-100 bg-purple-50">
                  <div className="px-4 py-2 text-xs font-semibold text-purple-700 col-span-3">Выполнение по KPI</div>
                </div>
                {KPI_KEYS.map(k => {
                  const curr = kpiAvgs[k];
                  const prev = prevKpiAvgs[k];
                  const delta = curr != null && prev != null ? curr - prev : null;
                  return (
                    <div key={k} className="grid grid-cols-3 gap-0 divide-x divide-gray-100 hover:bg-gray-50">
                      <div className="px-4 py-2.5 text-sm text-gray-700">{KPI_LABEL[k]}</div>
                      <div className={`px-4 py-2.5 text-sm font-bold flex items-center gap-2 ${pctCls(curr)}`}>
                        {curr != null ? `${curr}%` : '—'}
                        {delta != null && (
                          <span className={`text-xs font-normal ${delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                            {delta > 0 ? `↑ +${delta}%` : delta < 0 ? `↓ ${delta}%` : '→ 0%'}
                          </span>
                        )}
                      </div>
                      <div className={`px-4 py-2.5 text-sm font-bold ${pctCls(prev)}`}>
                        {prev != null ? `${prev}%` : '—'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── RATING TAB ── */}
          {tab === 'rating' && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800">Рейтинг дней по уровню выполнения</h3>
              </div>
              {dayRating.length === 0 ? (
                <div className="p-8 text-center text-gray-400">Нет данных</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {dayRating.map((d, i) => (
                    <div key={d.date}
                      className={`flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-purple-50 ${pctBg(d.completion)}`}
                      onClick={() => { setSelectedDate(d.date); setTab('calendar'); }}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${i === 0 ? 'bg-yellow-400 text-yellow-900' : i === 1 ? 'bg-gray-300 text-gray-700' : i === 2 ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm text-gray-800">
                          {new Date(d.date + 'T12:00:00').toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </div>
                        <div className="text-xs text-gray-500">
                          Пл: {d.plan_time || '—'} · Фк: {d.fact_time || '—'}
                          {d.plan_late && ' · ⏰ опоздание'}
                        </div>
                      </div>
                      <div className={`text-xl font-bold ${pctCls(d.completion)}`}>{d.completion}%</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {!loading && !storeData && selectedStore && (
        <div className="card p-8 text-center text-gray-400">
          <div className="text-3xl mb-2">📭</div>
          <p>Нет данных за {MONTH_NAMES[month]} {year}</p>
        </div>
      )}
    </div>
  );
}
