import React, { useState, useEffect } from 'react';
import api from '../api/client';
import KPIGrid from '../components/KPIGrid';
import { KPIInputGrid } from '../components/KPIGrid';
import { KPI_CONFIG, NO_GOLD_STORES } from '../utils/calculations';
import { formatDateTime } from '../utils/dateUtils';

export default function FactForm() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const kpiExclusions = user.kpi_exclusions ?? null;
  const hasGold = !NO_GOLD_STORES.has(String(user.store_number));
  const now = new Date();
  const moscowNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
  const today = `${moscowNow.getFullYear()}-${String(moscowNow.getMonth()+1).padStart(2,'0')}-${String(moscowNow.getDate()).padStart(2,'0')}`;
  const moscowHour = moscowNow.getHours();
  const moscowMin = moscowNow.getMinutes();
  const isLate = moscowHour > 23 || (moscowHour === 23 && moscowMin >= 30);
  const isEarlyWarning = moscowHour === 23 && moscowMin >= 0 && moscowMin < 30;

  const [plan, setPlan] = useState(null);
  const [fact, setFact] = useState(null);
  const [values, setValues] = useState({});
  const [comments, setComments] = useState({ what_helped: '', obstacles: '', tomorrow_actions: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [planData, factData] = await Promise.all([
        api.get(`/plans/${user.store_id}/${today}`).catch(() => null),
        api.get(`/facts/${user.store_id}/${today}`).catch(() => null)
      ]);
      setPlan(planData);
      if (factData) setFact(factData);
    } catch {}
    finally { setLoading(false); }
  }

  function handleChange(key, val) {
    setValues(v => ({ ...v, [key]: val }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        store_id: user.store_id,
        fact_date: today,
        ...values,
        ...comments
      };
      await api.post('/facts', payload);
      setSuccess('✅ Результаты дня зафиксированы');
      await loadData();
    } catch (err) {
      setError(err.error || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-center py-12 text-gray-400">Загрузка...</div>;

  const todayFormatted = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long'
  });

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Факт за день</h1>
        <p className="text-gray-500 text-sm mt-0.5 capitalize">{todayFormatted}</p>
      </div>

      {/* No plan warning */}
      {!plan && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="font-semibold text-red-700">⚠️ План на сегодня не поставлен</p>
          <p className="text-sm text-red-600 mt-1">Сначала заполните план, затем вернитесь сюда.</p>
        </div>
      )}

      {/* Plan summary */}
      {plan && !fact && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-600 mb-3">📝 Ваш план на сегодня</h3>
          <KPIGrid plan={plan} mode="plan" storeNumber={user.store_number} hasGold={hasGold} kpiExclusions={kpiExclusions !== null ? kpiExclusions : undefined} />
          <p className="text-xs text-gray-400 mt-3">
            Поставлен: {formatDateTime(plan.submitted_at)}
          </p>
        </div>
      )}

      {/* Submitted fact */}
      {fact && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔒</span>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-800">Факт зафиксирован</h3>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-sm font-mono font-semibold text-gray-700">
                  {formatDateTime(fact.submitted_at)}
                </span>
                {fact.is_late
                  ? <span className="badge-yellow text-xs">⏰ Просрочка — после 23:30</span>
                  : <span className="badge-green text-xs">✓ Вовремя</span>
                }
              </div>
            </div>
          </div>
          <KPIGrid plan={plan} fact={fact} storeNumber={user.store_number} hasGold={hasGold} kpiExclusions={kpiExclusions !== null ? kpiExclusions : undefined} />
          <div className="space-y-3 pt-2">
            {[
              { key: 'what_helped', label: '✅ Что помогло?' },
              { key: 'obstacles', label: '🚧 Препятствия' },
              { key: 'tomorrow_actions', label: '🎯 Действия на завтра' }
            ].map(item => (
              <div key={item.key}>
                <p className="text-xs font-semibold text-gray-500 mb-1">{item.label}</p>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">{fact[item.key]}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fact form */}
      {plan && !fact && (
        <form onSubmit={handleSubmit} className="space-y-5">
          {isEarlyWarning && !isLate && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-800">
              ⚠️ Уже почти 23:30 — успейте внести факт вовремя
            </div>
          )}
          {isLate && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              🔴 Срок подачи истёк (23:30) — заполните всё равно. Факт будет принят, но зафиксирована просрочка с точным временем подачи.
            </div>
          )}

          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-gray-800">📊 Фактические результаты</h3>
            <KPIInputGrid values={values} onChange={handleChange} disabled={saving} storeNumber={user.store_number} hasGold={hasGold} kpiExclusions={kpiExclusions !== null ? kpiExclusions : undefined} isPlan={false} />
          </div>

          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-gray-800">💬 Анализ дня</h3>

            {[
              {
                key: 'what_helped',
                label: '✅ Что помогло выполнить план?',
                placeholder: 'Опишите факторы, которые способствовали выполнению плана...'
              },
              {
                key: 'obstacles',
                label: '🚧 Какие препятствия возникли?',
                placeholder: 'Опишите проблемы и причины невыполнения показателей...'
              },
              {
                key: 'tomorrow_actions',
                label: '🎯 Какие действия предпримете завтра для улучшения?',
                placeholder: 'Опишите конкретные шаги на завтра...'
              }
            ].map(field => (
              <div key={field.key}>
                <label className="label font-medium">
                  {field.label} <span className="text-gray-400 font-normal text-sm">(необязательно)</span>
                </label>
                <textarea
                  className="input resize-none"
                  rows={3}
                  value={comments[field.key]}
                  onChange={e => setComments(c => ({ ...c, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  disabled={saving}
                />
              </div>
            ))}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-green-700 text-sm">
              {success}
            </div>
          )}

          <button type="submit" disabled={saving} className="btn-primary w-full py-3 text-base">
            {saving ? 'Сохранение...' : '🔒 Зафиксировать результаты'}
          </button>

          <p className="text-xs text-center text-gray-400">
            После сохранения данные нельзя изменить
          </p>
        </form>
      )}
    </div>
  );
}
