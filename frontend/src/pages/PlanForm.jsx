import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { KPIInputGrid } from '../components/KPIGrid';
import { KPI_CONFIG, getKpiConfig, NO_GOLD_STORES } from '../utils/calculations';
import { formatDateTime, formatDate } from '../utils/dateUtils';

function getUpcomingDays(n = 7) {
  const days = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    if (d.getDay() !== 0) { // skip Sundays
      days.push(d.toISOString().split('T')[0]);
    }
  }
  return days;
}

const DAY_NAMES = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];

export default function PlanForm() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const hasGold = !NO_GOLD_STORES.has(String(user.store_number));
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const moscowNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
  const moscowHour = moscowNow.getHours();

  const upcomingDays = getUpcomingDays(7);

  const [selectedDate, setSelectedDate] = useState(today);
  const [plan, setPlan] = useState(null);
  const [values, setValues] = useState({});
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadPlan();
    setValues({});
    setComment('');
    setError('');
    setSuccess('');
  }, [selectedDate]);

  async function loadPlan() {
    setLoading(true);
    try {
      const data = await api.get(`/plans/${user.store_id}/${selectedDate}`);
      if (data) setPlan(data);
      else setPlan(null);
    } catch { setPlan(null); }
    finally { setLoading(false); }
  }

  function handleChange(key, val) {
    setValues(v => ({ ...v, [key]: val === '' ? '' : val }));
  }

  const isToday = selectedDate === today;
  const isFuture = selectedDate > today;
  const isLateWarning = isToday && moscowHour >= 10;
  const isLate = isToday && moscowHour >= 11;

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
      const payload = { store_id: user.store_id, plan_date: selectedDate, comment, ...values };
      await api.post('/plans', payload);
      setSuccess(`✅ План на ${formatDate(selectedDate)} зафиксирован`);
      await loadPlan();
    } catch (err) {
      setError(err.error || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  const todayFormatted = new Date(selectedDate + 'T12:00:00').toLocaleDateString('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long'
  });

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">План на день</h1>
        <p className="text-gray-500 text-sm mt-0.5 capitalize">{todayFormatted}</p>
      </div>

      {/* Date selector */}
      <div className="card p-3">
        <p className="text-xs text-gray-500 mb-2 font-medium">Выберите дату:</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {upcomingDays.map(d => {
            const dt = new Date(d + 'T12:00:00');
            const dayName = DAY_NAMES[dt.getDay()];
            const dayNum = dt.getDate();
            const isSelected = d === selectedDate;
            const isTd = d === today;
            return (
              <button
                key={d}
                onClick={() => setSelectedDate(d)}
                className={`flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-xl text-sm font-medium transition-colors min-w-[56px] ${
                  isSelected
                    ? 'bg-purple-700 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span className="text-xs">{isTd ? 'Сег.' : dayName}</span>
                <span className="text-base font-bold">{dayNum}</span>
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">Загрузка...</div>
      ) : plan ? (
        /* Already submitted */
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🔒</span>
            <div>
              <h3 className="font-semibold text-gray-800">План зафиксирован</h3>
              <p className="text-sm text-gray-500">
                {formatDateTime(plan.submitted_at)}
                {plan.is_late ? ' · ⚠️ Просрочка (после 11:00)' : ' · ✓ Вовремя'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {getKpiConfig(user.store_number).map(kpi => (
              <div key={kpi.key} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">{kpi.label}</p>
                <p className="font-semibold text-gray-800">
                  {plan[kpi.key] != null ? `${plan[kpi.key]} ${kpi.unit}` : '—'}
                </p>
              </div>
            ))}
          </div>
          {plan.comment && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-xs font-medium text-blue-700 mb-1">Комментарий к плану</p>
              <p className="text-sm text-gray-700">{plan.comment}</p>
            </div>
          )}
        </div>
      ) : (
        /* Form */
        <form onSubmit={handleSubmit} className="space-y-5">
          {isFuture && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2">
              <span>📅</span>
              <p className="text-sm text-blue-800">
                Вы ставите план заранее на <strong>{formatDate(selectedDate)}</strong> — просрочки не будет
              </p>
            </div>
          )}
          {isLateWarning && !isLate && isToday && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex items-center gap-2">
              <span>⚠️</span>
              <p className="text-sm text-yellow-800">
                Уже почти 11:00 — поторопитесь, чтобы не получить просрочку
              </p>
            </div>
          )}
          {isLate && isToday && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
              <span>🔴</span>
              <p className="text-sm text-red-700">
                План ставится с опозданием (после 11:00) — будет отмечена просрочка. Всё равно заполните план.
              </p>
            </div>
          )}

          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-gray-800">📊 KPI на {formatDate(selectedDate)}</h3>
            <KPIInputGrid values={values} onChange={handleChange} disabled={saving} storeNumber={user.store_number} hasGold={hasGold} />
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
            {saving ? 'Сохранение...' : `🔒 Зафиксировать план на ${formatDate(selectedDate)}`}
          </button>

          <p className="text-xs text-center text-gray-400">
            После сохранения план нельзя изменить
          </p>
        </form>
      )}
    </div>
  );
}
