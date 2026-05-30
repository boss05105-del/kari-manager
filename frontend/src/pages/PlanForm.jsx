import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { KPIInputGrid } from '../components/KPIGrid';
import { KPI_CONFIG, getKpiConfig } from '../utils/calculations';
import { formatDateTime } from '../utils/dateUtils';

export default function PlanForm() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const moscowHour = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' })).getHours();
  const isLateWarning = moscowHour >= 10;
  const isLate = moscowHour >= 11;

  const [plan, setPlan] = useState(null);
  const [values, setValues] = useState({});
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadPlan();
  }, []);

  async function loadPlan() {
    try {
      const data = await api.get(`/plans/${user.store_id}/${today}`);
      if (data) setPlan(data);
    } catch {}
    finally { setLoading(false); }
  }

  function handleChange(key, val) {
    setValues(v => ({ ...v, [key]: val === '' ? '' : val }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    // Validate minimums
    const config = getKpiConfig(user.store_number);
    for (const kpi of config) {
      if (kpi.min != null) {
        const val = parseFloat(values[kpi.key]);
        if (isNaN(val) || val < kpi.min) {
          setError(`${kpi.label}: минимальное значение ${kpi.min} ${kpi.unit}`);
          return;
        }
      }
    }
    setSaving(true);
    try {
      const payload = { store_id: user.store_id, plan_date: today, comment, ...values };
      await api.post('/plans', payload);
      setSuccess('✅ План зафиксирован');
      await loadPlan();
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
        <h1 className="text-2xl font-bold text-gray-900">План на день</h1>
        <p className="text-gray-500 text-sm mt-0.5 capitalize">{todayFormatted}</p>
      </div>

      {/* Already submitted */}
      {plan && (
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🔒</span>
            <div>
              <h3 className="font-semibold text-gray-800">План зафиксирован</h3>
              <p className="text-sm text-gray-500">
                Время постановки: {formatDateTime(plan.submitted_at)}
                {plan.is_late ? ' · ⚠️ Просрочка (после 10:00)' : ' · ✓ Вовремя'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {KPI_CONFIG.map(kpi => (
              <div key={kpi.key} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">{kpi.label}</p>
                <p className="font-semibold text-gray-800">
                  {plan[kpi.key] != null ? `${plan[kpi.key]} ${kpi.unit}` : '—'}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-xs font-medium text-blue-700 mb-1">Комментарий к плану</p>
            <p className="text-sm text-gray-700">{plan.comment}</p>
          </div>
        </div>
      )}

      {/* Form */}
      {!plan && (
        <form onSubmit={handleSubmit} className="space-y-5">
          {isLateWarning && !isLate && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex items-center gap-2">
              <span>⚠️</span>
              <p className="text-sm text-yellow-800">
                Уже почти 11:00 — поторопитесь, чтобы не получить просрочку
              </p>
            </div>
          )}
          {isLate && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
              <span>🔴</span>
              <p className="text-sm text-red-700">
                План ставится с опозданием (после 11:00) — будет отмечена просрочка. Всё равно заполните план.
              </p>
            </div>
          )}

          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-gray-800">📊 KPI на сегодня</h3>
            <KPIInputGrid values={values} onChange={handleChange} disabled={saving} storeNumber={user.store_number} hasGold={user.has_gold} />
          </div>

          <div className="card p-5">
            <label className="label text-base font-semibold">
              💬 Комментарий к плану <span className="text-gray-400 font-normal text-sm">(необязательно)</span>
            </label>
            <textarea
              className="input resize-none"
              rows={3}
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Комментарий к плану..."
              disabled={saving}
            />
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
            {saving ? 'Сохранение...' : '🔒 Зафиксировать план'}
          </button>

          <p className="text-xs text-center text-gray-400">
            После сохранения план нельзя изменить
          </p>
        </form>
      )}
    </div>
  );
}
