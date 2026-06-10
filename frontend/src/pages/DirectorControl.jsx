import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { exportHeatmapToExcel } from '../utils/exportExcel';

const KPI_KEYS = [
  'ui_percent','gold_qty','silver_qty','finmoll_qty','kari_qty',
  'yandex_qty','items_per_receipt','conversion_shoes','conversion_insoles','sbp_share','mp_install_qty'
];

const KPI_SHORT = {
  ui_percent: 'ЮИ', gold_qty: 'Золото', silver_qty: 'Серебро',
  finmoll_qty: 'Финмолл', kari_qty: 'Kari', yandex_qty: 'Яндекс',
  items_per_receipt: 'ЧР', conversion_shoes: 'Конв.Об',
  conversion_insoles: 'Конв.Ст', sbp_share: 'СБП', mp_install_qty: 'МП'
};

const KPI_FULL = {
  ui_percent: 'Уровень сервиса', gold_qty: 'Золотые карты', silver_qty: 'Серебряные карты',
  finmoll_qty: 'Рассрочка Финмолл', kari_qty: 'Kari Частями', yandex_qty: 'Яндекс Сплит',
  items_per_receipt: 'Штук в чеке', conversion_shoes: 'Конверсия обувь',
  conversion_insoles: 'Конверсия стельки', sbp_share: 'Доля СБП', mp_install_qty: 'Установка МП'
};

const PERIODS = [
  { key: 'week', label: 'Неделя' },
  { key: 'month', label: 'Месяц' },
  { key: 'quarter', label: 'Квартал' }
];

function pctColor(v) {
  if (v == null) return 'bg-gray-100 text-gray-400';
  if (v >= 100) return 'bg-green-100 text-green-700 font-bold';
  if (v >= 90) return 'bg-green-50 text-green-600';
  if (v >= 70) return 'bg-yellow-50 text-yellow-700';
  if (v >= 50) return 'bg-orange-50 text-orange-700';
  return 'bg-red-50 text-red-700';
}

function pctBar(v) {
  if (v == null) return 'bg-gray-200';
  if (v >= 90) return 'bg-green-500';
  if (v >= 70) return 'bg-yellow-400';
  if (v >= 50) return 'bg-orange-400';
  return 'bg-red-500';
}

function TrendIcon({ trend }) {
  if (trend === 'up') return <span className="text-green-500 font-bold">↑</span>;
  if (trend === 'down') return <span className="text-red-500 font-bold">↓</span>;
  return <span className="text-gray-400">→</span>;
}

function EngagementScore({ store }) {
  const score = store.avg_completion;
  if (score == null) return <span className="text-gray-400 text-xs">—</span>;
  const label = score >= 90 ? '🟢 Высокая' : score >= 70 ? '🟡 Средняя' : score >= 50 ? '🟠 Низкая' : '🔴 Критическая';
  return (
    <div className="text-center">
      <div className={`text-lg font-bold ${score >= 90 ? 'text-green-600' : score >= 70 ? 'text-yellow-600' : score >= 50 ? 'text-orange-600' : 'text-red-600'}`}>
        {score}%
      </div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

function DirectorDetail({ store }) {
  const keys = KPI_KEYS.filter(k => store.kpi_avgs[k] != null);
  const sorted = [...keys].sort((a, b) => (store.kpi_avgs[b] || 0) - (store.kpi_avgs[a] || 0));

  return (
    <div className="bg-gray-50 border-t border-gray-200 p-4 space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-3 text-center shadow-sm">
          <div className="text-xs text-gray-500 mb-1">Ср. выполнение</div>
          <div className={`text-xl font-bold ${store.avg_completion >= 90 ? 'text-green-600' : store.avg_completion >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
            {store.avg_completion ?? '—'}%
          </div>
        </div>
        <div className="bg-white rounded-xl p-3 text-center shadow-sm">
          <div className="text-xs text-gray-500 mb-1">Планы вовремя</div>
          <div className={`text-xl font-bold ${(store.plan_punctuality ?? 0) >= 80 ? 'text-green-600' : 'text-orange-600'}`}>
            {store.plan_punctuality ?? '—'}%
          </div>
        </div>
        <div className="bg-white rounded-xl p-3 text-center shadow-sm">
          <div className="text-xs text-gray-500 mb-1">Факты вовремя</div>
          <div className={`text-xl font-bold ${(store.fact_punctuality ?? 0) >= 80 ? 'text-green-600' : 'text-orange-600'}`}>
            {store.fact_punctuality ?? '—'}%
          </div>
        </div>
        <div className="bg-white rounded-xl p-3 text-center shadow-sm">
          <div className="text-xs text-gray-500 mb-1">Тренд</div>
          <div className="text-xl"><TrendIcon trend={store.trend} /></div>
          <div className="text-xs text-gray-400">{store.trend === 'up' ? 'Растёт' : store.trend === 'down' ? 'Падает' : 'Стабильно'}</div>
        </div>
      </div>

      {/* KPI bars */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Выполнение по KPI</h4>
        <div className="space-y-2">
          {sorted.map(k => {
            const v = store.kpi_avgs[k];
            return (
              <div key={k} className="flex items-center gap-2">
                <div className="w-24 text-xs text-gray-600 text-right shrink-0">{KPI_FULL[k]}</div>
                <div className="flex-1 bg-gray-200 rounded-full h-5 relative overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${pctBar(v)}`}
                    style={{ width: `${Math.min(v ?? 0, 150)}%` }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-800">
                    {v != null ? `${v}%` : '—'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Strong / weak */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {store.strong_kpis.length > 0 && (
          <div className="bg-green-50 rounded-xl p-3">
            <div className="text-xs font-semibold text-green-700 mb-2">✅ Сильные стороны (≥90%)</div>
            <div className="flex flex-wrap gap-1">
              {store.strong_kpis.map(k => (
                <span key={k} className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">
                  {KPI_SHORT[k]} {store.kpi_avgs[k]}%
                </span>
              ))}
            </div>
          </div>
        )}
        {store.weak_kpis.length > 0 && (
          <div className="bg-red-50 rounded-xl p-3">
            <div className="text-xs font-semibold text-red-700 mb-2">⚠️ Слабые места (&lt;70%)</div>
            <div className="flex flex-wrap gap-1">
              {store.weak_kpis.map(k => (
                <span key={k} className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-medium">
                  {KPI_SHORT[k]} {store.kpi_avgs[k]}%
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RiskZone({ stores }) {
  const risks = [];

  for (const s of stores) {
    if (!s.today_has_plan) {
      risks.push({ store: s, type: 'no_plan_today', severity: 'critical', msg: 'Нет плана сегодня' });
    } else if (s.today_plan_late) {
      risks.push({ store: s, type: 'late_plan', severity: 'warn', msg: 'План с опозданием' });
    }
    if (s.consecutive_no_plan >= 3) {
      risks.push({ store: s, type: 'streak_no_plan', severity: 'critical', msg: `${s.consecutive_no_plan} дня подряд без плана` });
    }
    if (s.weak_kpis.length >= 5) {
      risks.push({ store: s, type: 'many_weak', severity: 'warn', msg: `${s.weak_kpis.length} KPI ниже 70%: ${s.weak_kpis.map(k => KPI_SHORT[k]).join(', ')}` });
    }
    if (s.trend === 'down' && s.avg_completion != null && s.avg_completion < 70) {
      risks.push({ store: s, type: 'falling', severity: 'warn', msg: 'Падающий тренд + низкое выполнение' });
    }
  }

  if (risks.length === 0) {
    return (
      <div className="card p-6 text-center">
        <div className="text-3xl mb-2">✅</div>
        <p className="text-gray-600 font-medium">Критических рисков нет</p>
        <p className="text-gray-400 text-sm">Все директора работают в штатном режиме</p>
      </div>
    );
  }

  const critical = risks.filter(r => r.severity === 'critical');
  const warnings = risks.filter(r => r.severity === 'warn');

  return (
    <div className="space-y-3">
      {critical.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-1">
            🔴 Критические ({critical.length})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {critical.map((r, i) => (
              <div key={i} className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-3">
                <div className="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-lg shrink-0">
                  {r.store.store_number}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-red-700 text-sm">{r.msg}</div>
                  <div className="text-xs text-gray-500 truncate">{r.store.director_name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {warnings.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-orange-700 mb-2 flex items-center gap-1">
            🟡 Внимание ({warnings.length})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {warnings.map((r, i) => (
              <div key={i} className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-start gap-3">
                <div className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-lg shrink-0">
                  {r.store.store_number}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-orange-700 text-sm">{r.msg}</div>
                  <div className="text-xs text-gray-500 truncate">{r.store.director_name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DirectorControl() {
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [sortKey, setSortKey] = useState('avg_completion');
  const [sortDir, setSortDir] = useState('asc'); // worst first by default
  const [tab, setTab] = useState('heatmap'); // heatmap | risk
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    api.get(`/analytics/kpi-heatmap?period=${period}`)
      .then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [period]);

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  const filtered = data.filter(s =>
    s.store_number.includes(search) ||
    (s.director_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    let va = sortKey === 'store_number' ? parseInt(a.store_number) :
             sortKey === 'director_name' ? (a.director_name || '').localeCompare(b.director_name || '') :
             sortKey.startsWith('kpi_') ? (a.kpi_avgs[sortKey.slice(4)] ?? -1) :
             (a[sortKey] ?? -1);
    let vb = sortKey === 'store_number' ? parseInt(b.store_number) :
             sortKey === 'director_name' ? (b.director_name || '').localeCompare(a.director_name || '') :
             sortKey.startsWith('kpi_') ? (b.kpi_avgs[sortKey.slice(4)] ?? -1) :
             (b[sortKey] ?? -1);
    if (sortKey === 'director_name') return sortDir === 'asc' ? va : -va;
    return sortDir === 'asc' ? va - vb : vb - va;
  });

  const riskCount = data.filter(s =>
    !s.today_has_plan || s.consecutive_no_plan >= 3 || s.weak_kpis.length >= 5
  ).length;

  const SortTh = ({ col, children, className = '' }) => (
    <th
      className={`table-header cursor-pointer select-none hover:bg-gray-100 whitespace-nowrap ${className}`}
      onClick={() => handleSort(col)}
    >
      {children}
      {sortKey === col && <span className="ml-1 text-purple-600">{sortDir === 'asc' ? '↑' : '↓'}</span>}
    </th>
  );

  return (
    <div className="space-y-5 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Контроль директоров</h1>
          <p className="text-sm text-gray-500 mt-0.5">KPI-аналитика по каждому магазину и директору</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${period === p.key ? 'bg-red-600 text-white' : 'btn-secondary'}`}>
              {p.label}
            </button>
          ))}
          <button
            onClick={() => data.length && exportHeatmapToExcel(data, period)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center gap-1"
          >
            📥 Excel
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {!loading && data.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-gray-800">{data.length}</div>
            <div className="text-xs text-gray-500">Магазинов</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {data.filter(s => s.today_has_plan).length}
            </div>
            <div className="text-xs text-gray-500">Планов сегодня</div>
          </div>
          <div className="card p-4 text-center">
            <div className={`text-2xl font-bold ${riskCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {riskCount}
            </div>
            <div className="text-xs text-gray-500">Зон риска</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {data.filter(s => s.avg_completion != null).length > 0
                ? Math.round(data.filter(s => s.avg_completion != null).reduce((a, s) => a + s.avg_completion, 0) / data.filter(s => s.avg_completion != null).length)
                : '—'}%
            </div>
            <div className="text-xs text-gray-500">Ср. по сети</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button onClick={() => setTab('heatmap')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'heatmap' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          📊 KPI Хитмап
        </button>
        <button onClick={() => setTab('risk')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1 ${tab === 'risk' ? 'border-red-600 text-red-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          🚨 Зона риска
          {riskCount > 0 && (
            <span className="bg-red-600 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">{riskCount}</span>
          )}
        </button>
      </div>

      {loading && <div className="text-center py-12 text-gray-400">Загрузка...</div>}

      {/* RISK TAB */}
      {!loading && tab === 'risk' && <RiskZone stores={data} />}

      {/* HEATMAP TAB */}
      {!loading && tab === 'heatmap' && (
        <div className="space-y-3">
          {/* Search */}
          <input
            type="text"
            className="input max-w-xs text-sm"
            placeholder="🔍 Поиск по магазину или директору..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          {/* Legend */}
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="text-gray-500">Легенда:</span>
            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">≥90% Отлично</span>
            <span className="bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded">70–89% Норма</span>
            <span className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded">50–69% Слабо</span>
            <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded">&lt;50% Критично</span>
          </div>

          {/* Heatmap table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: '900px' }}>
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <SortTh col="store_number" className="sticky left-0 bg-gray-50 z-10">Магазин</SortTh>
                    <SortTh col="director_name">Директор</SortTh>
                    <SortTh col="avg_completion">Ср.%</SortTh>
                    {KPI_KEYS.map(k => (
                      <SortTh key={k} col={`kpi_${k}`}>{KPI_SHORT[k]}</SortTh>
                    ))}
                    <th className="table-header">Сегодня</th>
                    <th className="table-header">Тренд</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sorted.map(store => (
                    <React.Fragment key={store.store_id}>
                      <tr
                        className={`cursor-pointer transition-colors ${expanded === store.store_id ? 'bg-purple-50' : 'hover:bg-gray-50'}`}
                        onClick={() => setExpanded(expanded === store.store_id ? null : store.store_id)}
                      >
                        {/* Store number */}
                        <td className="table-cell font-bold sticky left-0 bg-white z-10">
                          <div className="flex items-center gap-1">
                            <span>{store.store_number}</span>
                            {!store.today_has_plan && <span className="text-red-500 text-xs">⚠️</span>}
                          </div>
                        </td>
                        {/* Director */}
                        <td className="table-cell text-xs text-gray-600 max-w-[120px] truncate">{store.director_name}</td>
                        {/* Avg completion */}
                        <td className="table-cell">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${pctColor(store.avg_completion)}`}>
                            {store.avg_completion != null ? `${store.avg_completion}%` : '—'}
                          </span>
                        </td>
                        {/* Per-KPI cells */}
                        {KPI_KEYS.map(k => {
                          const v = store.kpi_avgs[k];
                          return (
                            <td key={k} className="table-cell p-1">
                              <div className={`text-center text-xs px-1 py-0.5 rounded font-medium ${pctColor(v)}`}>
                                {v != null ? `${v}%` : '—'}
                              </div>
                            </td>
                          );
                        })}
                        {/* Today status */}
                        <td className="table-cell text-center">
                          {store.today_has_plan
                            ? <span className={store.today_plan_late ? 'text-yellow-500' : 'text-green-500'}>
                                {store.today_plan_late ? '⏰' : '✅'}
                              </span>
                            : <span className="text-red-500">✗</span>}
                        </td>
                        {/* Trend */}
                        <td className="table-cell text-center">
                          <TrendIcon trend={store.trend} />
                        </td>
                      </tr>
                      {expanded === store.store_id && (
                        <tr>
                          <td colSpan={16}>
                            <DirectorDetail store={store} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-gray-400 text-center">
            Нажмите на строку магазина, чтобы увидеть детальную аналитику директора
          </p>
        </div>
      )}
    </div>
  );
}
