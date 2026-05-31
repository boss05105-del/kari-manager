import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { EngagementBar } from '../components/EngagementBadge';
import KPIGrid from '../components/KPIGrid';
import { CompletionLineChart } from '../components/Charts';
import { formatDateTime, shortDate } from '../utils/dateUtils';
import { calcAvgCompletion, NO_GOLD_STORES } from '../utils/calculations';
import PushToggle from '../components/PushToggle';

export default function DirectorDashboard() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const hasGold = !NO_GOLD_STORES.has(String(user.store_number));
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const moscowHour = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' })).getHours();

  const [store, setStore] = useState(null);
  const [todayPlan, setTodayPlan] = useState(null);
  const [todayFact, setTodayFact] = useState(null);
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [storeData, planData, factData, trendsData] = await Promise.all([
        api.get(`/stores/${user.store_id}`),
        api.get(`/plans/${user.store_id}/${today}`).catch(() => null),
        api.get(`/facts/${user.store_id}/${today}`).catch(() => null),
        api.get(`/analytics/store/${user.store_id}/trends?period=month`)
      ]);
      setStore(storeData);
      setTodayPlan(planData);
      setTodayFact(factData);
      setTrends(trendsData);
    } catch {}
    finally { setLoading(false); }
  }

  if (loading) return <div className="text-center py-12 text-gray-400">Загрузка...</div>;

  const planDeadline = moscowHour < 10;
  const factDeadline = moscowHour < 22;
  const todayStr = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  const avgCompletion = calcAvgCompletion(todayPlan, todayFact);

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Магазин {user.store_number}</h1>
        <p className="text-gray-500 text-sm capitalize">{todayStr}</p>
      </div>

      {/* Today status */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/director/plan"
          className={`card p-4 border-2 transition-all active:scale-95 ${
            todayPlan
              ? todayPlan.is_late ? 'border-yellow-400 bg-yellow-50' : 'border-green-400 bg-green-50'
              : planDeadline ? 'border-red-300 bg-red-50 animate-pulse' : 'border-red-400 bg-red-50'
          }`}
        >
          <div className="text-2xl mb-2">📝</div>
          <div className="font-semibold text-sm text-gray-800">
            {todayPlan ? (todayPlan.is_late ? '⏰ Просрочка' : '✓ Сдан') : '✗ Не сдан'}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {todayPlan ? formatDateTime(todayPlan.submitted_at) : (planDeadline ? 'до 10:00' : 'Просрочен')}
          </div>
          <div className="text-xs font-medium text-red-600 mt-2">
            {!todayPlan && 'Заполнить план →'}
          </div>
        </Link>

        <Link
          to="/director/fact"
          className={`card p-4 border-2 transition-all active:scale-95 ${
            todayFact
              ? todayFact.is_late ? 'border-yellow-400 bg-yellow-50' : 'border-green-400 bg-green-50'
              : 'border-gray-200 bg-gray-50'
          }`}
        >
          <div className="text-2xl mb-2">✅</div>
          <div className="font-semibold text-sm text-gray-800">
            {todayFact ? (todayFact.is_late ? '⏰ Просрочка' : '✓ Сдан') : '— Не внесён'}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {todayFact ? formatDateTime(todayFact.submitted_at) : `до 22:00`}
          </div>
          {!todayFact && todayPlan && (
            <div className="text-xs font-medium text-red-600 mt-2">Внести факт →</div>
          )}
        </Link>
      </div>

      {/* Today KPIs */}
      {(todayPlan || todayFact) && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">📊 KPI сегодня</h3>
            {avgCompletion != null && (
              <span className={`text-lg font-bold ${
                avgCompletion >= 90 ? 'text-green-600' : avgCompletion >= 70 ? 'text-yellow-600' : 'text-red-600'
              }`}>{avgCompletion}%</span>
            )}
          </div>
          <KPIGrid plan={todayPlan} fact={todayFact} storeNumber={user.store_number} hasGold={hasGold} />
        </div>
      )}

      {/* Engagement */}
      {store?.engagement && (
        <div className="card p-4">
          <EngagementBar
            index={store.engagement.index}
            breakdown={store.engagement.breakdown}
          />
          {store.engagement.stats && (
            <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-gray-100">
              <StatBox label="Заполнено" value={`${store.engagement.stats.fillRate}%`} />
              <StatBox label="Серия дней" value={`${store.engagement.stats.currentStreak} дн.`} />
              <StatBox label="Ср. выполн." value={`${store.engagement.stats.avgKpiCompletion}%`} />
            </div>
          )}
        </div>
      )}

      {/* Push notifications toggle */}
      <PushToggle />

      {/* Trends chart */}
      <CompletionLineChart
        data={trends.map(t => ({ date: t.date, completion: t.completion }))}
        title="Динамика выполнения за 30 дней"
      />

      {/* Recent history */}
      {store?.history?.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">История (7 дней)</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {store.history.slice(0, 7).map(day => {
              const fact = {
                ui_percent: day.f_ui, gold_qty: day.f_gold, silver_qty: day.f_silver,
                finmoll_qty: day.f_finmoll, kari_qty: day.f_kari, yandex_qty: day.f_yandex,
                items_per_receipt: day.f_items, conversion_shoes: day.f_conv_shoes,
                conversion_insoles: day.f_conv_insoles, sbp_share: day.f_sbp,
                mp_install_qty: day.f_mp
              };
              const avg = calcAvgCompletion(day, fact);

              return (
                <div key={day.plan_date} className="px-4 py-3 flex items-center justify-between">
                  <span className="text-sm text-gray-700">{shortDate(day.plan_date)}</span>
                  <div className="flex items-center gap-2">
                    {day.plan_date ? <span className="text-green-500 text-xs">П ✓</span> : <span className="text-red-400 text-xs">П ✗</span>}
                    {day.fact_date ? <span className="text-green-500 text-xs">Ф ✓</span> : <span className="text-gray-300 text-xs">Ф ✗</span>}
                    {avg != null && (
                      <span className={`text-sm font-semibold ${avg >= 90 ? 'text-green-600' : avg >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {avg}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value }) {
  return (
    <div className="text-center bg-gray-50 rounded-lg py-2">
      <div className="text-lg font-bold text-gray-800">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}
