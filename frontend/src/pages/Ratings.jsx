import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

const MEDALS = ['🥇', '🥈', '🥉'];

function getCompletionColor(pct) {
  if (pct >= 100) return 'text-green-600';
  if (pct >= 90) return 'text-green-500';
  if (pct >= 70) return 'text-yellow-600';
  return 'text-red-500';
}

function TopCard({ title, emoji, items, valueKey, valueLabel, valueSuffix = '', lowerIsBetter = false }) {
  const navigate = useNavigate();
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <span className="text-xl">{emoji}</span>
        <h3 className="font-semibold text-gray-800">{title}</h3>
        <span className="ml-auto text-xs text-gray-400">Топ {items.length}</span>
      </div>
      <div className="divide-y divide-gray-50">
        {items.length === 0 && (
          <div className="px-4 py-6 text-center text-gray-400 text-sm">Нет данных</div>
        )}
        {items.map((s, i) => {
          const val = s[valueKey];
          const isTop3 = i < 3;
          return (
            <div
              key={s.store_id}
              onClick={() => navigate(`/admin/store/${s.store_id}`)}
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                i === 0 ? 'bg-yellow-50' : i === 1 ? 'bg-gray-50' : i === 2 ? 'bg-amber-50' : ''
              }`}
            >
              <span className={`text-lg font-bold w-8 text-center ${isTop3 ? '' : 'text-gray-400 text-sm'}`}>
                {isTop3 ? MEDALS[i] : `#${i + 1}`}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900 text-sm">{s.store_number}</span>
                  {(s.plan_late || s.fact_late) && <span className="text-xs text-orange-500">⏰</span>}
                </div>
                <p className="text-xs text-gray-500 truncate">{s.director_name}</p>
              </div>
              <div className="text-right">
                <div className={`text-base font-bold ${
                  lowerIsBetter
                    ? 'text-blue-600'
                    : getCompletionColor(val)
                }`}>
                  {val != null ? `${val}${valueSuffix}` : '—'}
                </div>
                {valueLabel && (
                  <div className="text-xs text-gray-400">{valueLabel}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Ratings() {
  const [period, setPeriod] = useState('day');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [period]);

  async function loadData() {
    setLoading(true);
    try {
      const d = await api.get(`/analytics/top-ratings?period=${period}`);
      setData(d);
    } catch {}
    finally { setLoading(false); }
  }

  const today = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long'
  });
  const monthLabel = new Date().toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🏆 Рейтинг директоров</h1>
          <p className="text-gray-500 text-sm mt-0.5 capitalize">
            {period === 'day' ? today : monthLabel}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPeriod('day')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              period === 'day' ? 'bg-purple-700 text-white' : 'btn-secondary'
            }`}
          >
            📅 Сегодня
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              period === 'month' ? 'bg-purple-700 text-white' : 'btn-secondary'
            }`}
          >
            📆 Месяц
          </button>
        </div>
      </div>

      {/* Description */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        {[
          { icon: '⚡', title: 'Скорость плана', desc: period === 'day' ? 'Кто раньше всех поставил план сегодня' : 'Среднее время постановки плана за месяц' },
          { icon: '✅', title: 'Скорость факта', desc: period === 'day' ? 'Кто раньше всех заполнил факт сегодня' : 'Среднее время заполнения факта за месяц' },
          { icon: '📈', title: 'Выполнение плана', desc: period === 'day' ? 'Кто ближе всего к выполнению плана сегодня' : 'Среднее выполнение плана за месяц' }
        ].map(c => (
          <div key={c.title} className="card p-3 flex gap-3 items-start">
            <span className="text-2xl">{c.icon}</span>
            <div>
              <div className="font-semibold text-gray-800 text-sm">{c.title}</div>
              <div className="text-xs text-gray-500 mt-0.5">{c.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-gray-400">
          <div className="text-center"><div className="text-3xl animate-spin mb-2">⟳</div><p>Загрузка...</p></div>
        </div>
      ) : data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <TopCard
            title="Быстрее всех поставили план"
            emoji="⚡"
            items={data.topPlanSpeed}
            valueKey="plan_time"
            valueLabel={period === 'month' ? 'ср. время' : 'время'}
            lowerIsBetter
          />
          <TopCard
            title="Быстрее всех заполнили факт"
            emoji="✅"
            items={data.topFactSpeed}
            valueKey="fact_time"
            valueLabel={period === 'month' ? 'ср. время' : 'время'}
            lowerIsBetter
          />
          <TopCard
            title="Лучшее выполнение плана"
            emoji="📈"
            items={data.topCompletion}
            valueKey="completion"
            valueSuffix="%"
            valueLabel={period === 'month' ? 'ср. за месяц' : 'сегодня'}
          />
        </div>
      )}
    </div>
  );
}
