import React, { useState, useEffect } from 'react';
import api from '../api/client';
import KPIGrid from '../components/KPIGrid';
import { formatDate, formatDateTime } from '../utils/dateUtils';
import { calcAvgCompletion } from '../utils/calculations';

const PERIODS = [
  { key: 'week', label: 'Неделя' },
  { key: 'month', label: 'Тек. месяц' },
  { key: 'quarter', label: 'Квартал' }
];

export default function DirectorHistory() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [history, setHistory] = useState([]);
  const [period, setPeriod] = useState('month');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/stores/${user.store_id}/history?period=${period}`)
      .then(setHistory).catch(() => {}).finally(() => setLoading(false));
  }, [period]);

  return (
    <div className="space-y-4 pb-20 lg:pb-0">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">История</h1>
        <div className="flex gap-2">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium ${period === p.key ? 'bg-red-600 text-white' : 'btn-secondary'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="text-center py-8 text-gray-400">Загрузка...</div>}

      {!loading && history.length === 0 && (
        <div className="card p-10 text-center text-gray-400">История пуста</div>
      )}

      <div className="space-y-2">
        {history.map(day => {
          const fact = {
            ui_percent: day.f_ui, gold_qty: day.f_gold, silver_qty: day.f_silver,
            finmoll_qty: day.f_finmoll, kari_qty: day.f_kari, yandex_qty: day.f_yandex,
            items_per_receipt: day.f_items, conversion_shoes: day.f_conv_shoes,
            conversion_insoles: day.f_conv_insoles, sbp_share: day.f_sbp
          };
          const planProxy = {
            ui_percent: day.p_ui, gold_qty: day.p_gold, silver_qty: day.p_silver,
            finmoll_qty: day.p_finmoll, kari_qty: day.p_kari, yandex_qty: day.p_yandex,
            items_per_receipt: day.p_items, conversion_shoes: day.p_conv_shoes,
            conversion_insoles: day.p_conv_insoles, sbp_share: day.p_sbp
          };
          const avg = calcAvgCompletion(planProxy, fact);
          const open = selected === day.date;

          return (
            <div key={day.date} className="card overflow-hidden">
              <button
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
                onClick={() => setSelected(open ? null : day.date)}
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-800 text-sm">{formatDate(day.date)}</span>
                  <div className="flex gap-1">
                    {day.plan_late ? <span className="badge-yellow text-xs">⏰ Пл.</span> : day.p_ui != null ? <span className="badge-green text-xs">✓ Пл.</span> : <span className="badge-red text-xs">✗ Пл.</span>}
                    {day.fact_late ? <span className="badge-yellow text-xs">⏰ Фк.</span> : day.f_ui != null ? <span className="badge-green text-xs">✓ Фк.</span> : <span className="badge-gray text-xs">— Фк.</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {avg != null && (
                    <span className={`text-sm font-bold ${avg >= 90 ? 'text-green-600' : avg >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {avg}%
                    </span>
                  )}
                  <span className="text-gray-400 text-sm">{open ? '▲' : '▼'}</span>
                </div>
              </button>
              {open && (
                <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
                  <KPIGrid plan={planProxy} fact={fact} storeNumber={user.store_number} hasGold={user.has_gold} />
                  {day.comment && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-1">Комментарий к плану</p>
                      <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">{day.comment}</p>
                      <p className="text-xs text-gray-400 mt-1">{formatDateTime(day.plan_submitted_at)}</p>
                    </div>
                  )}
                  {day.what_helped && (
                    <div className="space-y-2">
                      {[
                        { label: 'Что помогло?', key: 'what_helped' },
                        { label: 'Препятствия', key: 'obstacles' },
                        { label: 'Действия на завтра', key: 'tomorrow_actions' }
                      ].map(f => (
                        <div key={f.key}>
                          <p className="text-xs font-semibold text-gray-500 mb-1">{f.label}</p>
                          <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">{day[f.key]}</p>
                        </div>
                      ))}
                      <p className="text-xs text-gray-400">{formatDateTime(day.fact_submitted_at)}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
