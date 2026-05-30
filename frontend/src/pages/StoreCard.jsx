import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import KPIGrid from '../components/KPIGrid';
import { EngagementBar } from '../components/EngagementBadge';
import { CompletionLineChart, KPITrendChart } from '../components/Charts';
import { formatDate, formatDateTime } from '../utils/dateUtils';
import { calcAvgCompletion, KPI_CONFIG, NO_GOLD_STORES } from '../utils/calculations';
import DirectorActions from '../components/DirectorActions';
import { KPIInputGrid } from '../components/KPIGrid';

const PERIODS = [
  { key: 'week', label: 'Неделя' },
  { key: 'month', label: 'Тек. месяц' },
  { key: 'quarter', label: 'Квартал' }
];

export default function StoreCard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [store, setStore] = useState(null);
  const [trends, setTrends] = useState([]);
  const [period, setPeriod] = useState('month');
  const [selectedDay, setSelectedDay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('today');
  const [planValues, setPlanValues] = useState({});
  const [planComment, setPlanComment] = useState('');
  const [planSaving, setPlanSaving] = useState(false);
  const [planError, setPlanError] = useState('');
  const [showPlanForm, setShowPlanForm] = useState(false);

  useEffect(() => {
    loadStore();
  }, [id]);

  useEffect(() => {
    loadTrends();
  }, [id, period]);

  async function loadStore() {
    setLoading(true);
    try {
      const data = await api.get(`/stores/${id}`);
      setStore(data);
      if (data.history?.length > 0) setSelectedDay(data.history[0]);
    } catch { navigate('/admin'); }
    finally { setLoading(false); }
  }

  async function handleAdminPlan(e) {
    e.preventDefault();
    setPlanError('');
    setPlanSaving(true);
    try {
      await api.post('/plans', {
        store_id: store.id,
        plan_date: today,
        comment: planComment,
        ...planValues
      });
      setShowPlanForm(false);
      setPlanValues({});
      setPlanComment('');
      await loadStore();
    } catch (err) {
      setPlanError(err.error || 'Ошибка сохранения');
    } finally {
      setPlanSaving(false);
    }
  }

  async function loadTrends() {
    try {
      const data = await api.get(`/analytics/store/${id}/trends?period=${period}`);
      setTrends(data);
    } catch {}
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <div className="text-center">
        <div className="text-3xl animate-spin mb-2">⟳</div>
        <p>Загрузка...</p>
      </div>
    </div>
  );

  if (!store) return null;

  const today = new Date().toISOString().split('T')[0];
  const todayPlan = store.history?.find(h => h.plan_date === today);
  const storeHasGold = !NO_GOLD_STORES.has(String(store.store_number));
  const chartsData = trends.map(t => ({
    date: t.date,
    completion: t.completion
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => navigate('/admin')} className="btn-ghost text-gray-500 mt-1">
          ← Назад
        </button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              Магазин {store.store_number}
            </h1>
            <span className="badge-gray">{store.director_name}</span>
          </div>
          <p className="text-gray-500 text-sm mt-1">{store.director_username}</p>
        </div>
        <DirectorActions store={store} onUpdate={loadStore} />
      </div>

      {/* Engagement */}
      <div className="card p-5">
        <EngagementBar
          index={store.engagement?.index}
          breakdown={store.engagement?.breakdown}
        />
        {store.engagement?.stats && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-4 pt-4 border-t border-gray-100">
            {[
              { label: 'Заполнено', value: `${store.engagement.stats.fillRate}%` },
              { label: 'Планы вовремя', value: store.engagement.stats.plansOnTime },
              { label: 'Просрочки', value: store.engagement.stats.plansLate + store.engagement.stats.factsLate },
              { label: 'Пропуски', value: store.engagement.stats.plansMissed },
              { label: 'Серия дней', value: store.engagement.stats.currentStreak },
              { label: 'Ср. выполн.', value: `${store.engagement.stats.avgKpiCompletion}%` }
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="text-xl font-bold text-gray-800">{s.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-0">
        {['today','history','charts'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'today' ? '📊 Сегодня' : tab === 'history' ? '📅 История' : '📈 Графики'}
          </button>
        ))}
      </div>

      {/* Today tab */}
      {activeTab === 'today' && (
        <div className="space-y-4">
          {todayPlan ? (
            <>
              <div className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-800">
                    {formatDate(todayPlan.plan_date)}
                  </h3>
                  <div className="flex gap-2">
                    <span className={todayPlan.plan_date ? 'badge-green' : 'badge-red'}>
                      {todayPlan.is_late ? '⏰ Просрочка' : '✓ Вовремя'}
                    </span>
                  </div>
                </div>
                <KPIGrid
                  plan={todayPlan}
                  hasGold={storeHasGold}
                  fact={{
                    ui_percent: todayPlan.f_ui, gold_qty: todayPlan.f_gold,
                    silver_qty: todayPlan.f_silver, finmoll_qty: todayPlan.f_finmoll,
                    kari_qty: todayPlan.f_kari, yandex_qty: todayPlan.f_yandex,
                    items_per_receipt: todayPlan.f_items,
                    conversion_shoes: todayPlan.f_conv_shoes,
                    conversion_insoles: todayPlan.f_conv_insoles,
                    sbp_share: todayPlan.f_sbp
                  }}
                />
              </div>
              {todayPlan.comment && (
                <div className="card p-4">
                  <h4 className="text-sm font-semibold text-gray-600 mb-2">💬 Комментарий к плану</h4>
                  <p className="text-sm text-gray-700 leading-relaxed">{todayPlan.comment}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    Поставлен: {formatDateTime(todayPlan.submitted_at)}
                    {todayPlan.is_late ? ' ⚠️ Просрочка' : ''}
                  </p>
                </div>
              )}
              {todayPlan.what_helped && (
                <div className="card p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-gray-600">📋 Отчёт по факту</h4>
                  <QABlock label="Что помогло?" text={todayPlan.what_helped} />
                  <QABlock label="Препятствия" text={todayPlan.obstacles} />
                  <QABlock label="Действия на завтра" text={todayPlan.tomorrow_actions} />
                  <p className="text-xs text-gray-400">
                    Внесён: {formatDateTime(todayPlan.fact_submitted_at)}
                    {todayPlan.fact_is_late ? ' ⚠️ Просрочка' : ''}
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              {!showPlanForm ? (
                <div className="card p-8 text-center">
                  <div className="text-5xl mb-3">📭</div>
                  <p className="font-medium text-gray-500 mb-4">План на сегодня ещё не внесён</p>
                  <button
                    onClick={() => setShowPlanForm(true)}
                    className="btn-primary"
                  >
                    📝 Поставить план за директора
                  </button>
                </div>
              ) : (
                <form onSubmit={handleAdminPlan} className="card p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800">📝 План — Магазин {store.store_number}</h3>
                    <button type="button" onClick={() => setShowPlanForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
                  </div>
                  <KPIInputGrid
                    values={planValues}
                    onChange={(k, v) => setPlanValues(prev => ({ ...prev, [k]: v }))}
                    disabled={planSaving}
                    hasGold={!NO_GOLD_STORES.has(String(store.store_number))}
                  />
                  <div>
                    <label className="label">💬 Комментарий <span className="text-gray-400 font-normal text-sm">(необязательно)</span></label>
                    <textarea
                      className="input resize-none"
                      rows={3}
                      value={planComment}
                      onChange={e => setPlanComment(e.target.value)}
                      placeholder="Комментарий к плану..."
                      disabled={planSaving}
                    />
                  </div>
                  {planError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{planError}</div>
                  )}
                  <button type="submit" disabled={planSaving} className="btn-primary w-full">
                    {planSaving ? 'Сохранение...' : '🔒 Зафиксировать план'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      {/* History tab */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          {store.history?.filter(h => String(h.plan_date).slice(0,10) !== today).length === 0 ? (
            <div className="card p-10 text-center text-gray-400">История пуста</div>
          ) : (
            store.history?.filter(h => String(h.plan_date).slice(0,10) !== today).map(day => {
              const fact = {
                ui_percent: day.f_ui, gold_qty: day.f_gold, silver_qty: day.f_silver,
                finmoll_qty: day.f_finmoll, kari_qty: day.f_kari, yandex_qty: day.f_yandex,
                items_per_receipt: day.f_items, conversion_shoes: day.f_conv_shoes,
                conversion_insoles: day.f_conv_insoles, sbp_share: day.f_sbp
              };
              const avg = calcAvgCompletion(day, fact);

              return (
                <div key={day.plan_date} className="card overflow-hidden">
                  <button
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    onClick={() => setSelectedDay(selectedDay?.plan_date === day.plan_date ? null : day)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-gray-800">{formatDate(day.plan_date)}</span>
                      {day.is_late ? <span className="badge-yellow text-xs">⏰ Просрочка плана</span> : null}
                      {day.fact_is_late ? <span className="badge-yellow text-xs">⏰ Просрочка факта</span> : null}
                    </div>
                    <div className="flex items-center gap-3">
                      {avg != null && (
                        <span className={`text-sm font-bold ${
                          avg >= 90 ? 'text-green-600' : avg >= 70 ? 'text-yellow-600' : 'text-red-600'
                        }`}>{avg}%</span>
                      )}
                      {day.fact_date ? <span className="badge-green text-xs">✓ Факт</span> : <span className="badge-red text-xs">✗ Нет факта</span>}
                      <span className="text-gray-400">{selectedDay?.plan_date === day.plan_date ? '▲' : '▼'}</span>
                    </div>
                  </button>
                  {selectedDay?.plan_date === day.plan_date && (
                    <div className="px-4 pb-4 border-t border-gray-100 space-y-3 pt-3">
                      <KPIGrid plan={day} fact={fact} hasGold={storeHasGold} />
                      {day.comment && <QABlock label="Комментарий к плану" text={day.comment} />}
                      {day.what_helped && (
                        <div className="space-y-2">
                          <QABlock label="Что помогло?" text={day.what_helped} />
                          <QABlock label="Препятствия" text={day.obstacles} />
                          <QABlock label="Действия на завтра" text={day.tomorrow_actions} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Charts tab */}
      {activeTab === 'charts' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            {PERIODS.map(p => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  period === p.key ? 'bg-red-600 text-white' : 'btn-secondary'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <CompletionLineChart data={chartsData} title="Динамика выполнения плана" />
          <KPITrendChart
            data={trends.map(t => ({ date: t.date, p_ui_percent: t.plan?.ui, f_ui_percent: t.fact?.ui }))}
            planKey="p_ui_percent"
            factKey="f_ui_percent"
            title="ЮИ % — план vs факт"
          />
        </div>
      )}
    </div>
  );
}

function QABlock({ label, text }) {
  if (!text) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
      <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">{text}</p>
    </div>
  );
}
