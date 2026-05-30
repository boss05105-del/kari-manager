import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { registerPush } from '../utils/pushNotifications';

export default function ProfileSetup() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [pushResult, setPushResult] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (fullName.trim().length < 5) {
      return setError('Введите полное ФИО (минимум 5 символов)');
    }
    setSaving(true);
    try {
      await api.post('/users/setup-profile', { full_name: fullName.trim(), skip_password: true });
      const updated = { ...user, full_name: fullName.trim(), profile_completed: 1 };
      localStorage.setItem('user', JSON.stringify(updated));
      setStep(2);
    } catch (err) {
      setError(err.error || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  async function handleEnablePush() {
    const result = await registerPush();
    setPushResult(result);
    if (result.ok) setTimeout(() => navigate('/director'), 1500);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-700 to-purple-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white rounded-2xl shadow-lg mb-3">
            <span className="text-2xl font-black text-purple-700 tracking-tight">kari</span>
          </div>
          <h1 className="text-xl font-bold text-white">Добро пожаловать!</h1>
          <p className="text-purple-200 text-sm mt-1">Магазин {user.store_number}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-6">
          {step === 1 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800 mb-1">Введите ваше ФИО</h2>
                <p className="text-sm text-gray-500">Это имя будет отображаться в системе</p>
              </div>

              <input
                type="text"
                className="input"
                placeholder="Иванова Анна Сергеевна"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                autoFocus
              />

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <button type="submit" disabled={saving} className="btn-primary w-full">
                {saving ? 'Сохранение...' : 'Далее →'}
              </button>
            </form>
          )}

          {step === 2 && (
            <div className="space-y-4 text-center">
              <div className="text-5xl mb-2">🔔</div>
              <h2 className="text-lg font-semibold text-gray-800">Включить уведомления?</h2>
              <ul className="text-sm text-gray-600 text-left space-y-1 bg-gray-50 rounded-xl p-3">
                <li>📝 <b>10:00</b> — напоминание поставить план</li>
                <li>🔴 <b>11:00</b> — уведомление о просрочке плана</li>
                <li>✅ <b>22:00</b> — напоминание внести факт</li>
                <li>🔴 <b>23:00</b> — уведомление о просрочке факта</li>
              </ul>

              {pushResult?.ok && (
                <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-3 py-2">
                  ✅ Уведомления включены! Переходим...
                </div>
              )}
              {pushResult && !pushResult.ok && (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm rounded-lg px-3 py-2">
                  Можно включить позже в настройках браузера.
                </div>
              )}

              <div className="flex flex-col gap-2">
                {!pushResult?.ok && (
                  <button onClick={handleEnablePush} className="btn-primary w-full">
                    🔔 Включить уведомления
                  </button>
                )}
                <button onClick={() => navigate('/director')} className="btn-secondary w-full text-sm">
                  Пропустить
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
