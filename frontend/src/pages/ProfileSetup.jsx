import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { registerPush } from '../utils/pushNotifications';

export default function ProfileSetup() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [step, setStep] = useState(1); // 1=profile, 2=push
  const [form, setForm] = useState({ full_name: '', new_password: '', confirm_password: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [pushResult, setPushResult] = useState(null);

  async function handleProfileSubmit(e) {
    e.preventDefault();
    setError('');

    if (form.full_name.trim().length < 5) {
      return setError('Введите полное ФИО (минимум 5 символов)');
    }
    if (form.new_password.length < 6) {
      return setError('Пароль должен содержать минимум 6 символов');
    }
    if (form.new_password !== form.confirm_password) {
      return setError('Пароли не совпадают');
    }

    setSaving(true);
    try {
      await api.post('/users/setup-profile', {
        full_name: form.full_name.trim(),
        new_password: form.new_password
      });

      // Update stored user
      const updated = { ...user, full_name: form.full_name.trim(), profile_completed: 1 };
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
    if (result.ok) {
      setTimeout(() => navigate('/director'), 1500);
    }
  }

  function skipPush() {
    navigate('/director');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white rounded-2xl shadow-lg mb-3">
            <span className="text-2xl font-black text-red-600">K</span>
          </div>
          <h1 className="text-xl font-bold text-white">Добро пожаловать!</h1>
          <p className="text-red-200 text-sm mt-1">Магазин {user.store_number}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-6">
          {/* Steps indicator */}
          <div className="flex items-center gap-2 mb-6">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold ${step >= 1 ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-500'}`}>1</div>
            <div className={`flex-1 h-0.5 ${step >= 2 ? 'bg-red-600' : 'bg-gray-200'}`} />
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold ${step >= 2 ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-500'}`}>2</div>
          </div>

          {/* Step 1: Profile */}
          {step === 1 && (
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800 mb-1">Настройте профиль</h2>
                <p className="text-sm text-gray-500">Первый вход — установите ФИО и пароль</p>
              </div>

              <div>
                <label className="label">Ваше ФИО <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  className="input"
                  placeholder="Иванова Анна Сергеевна"
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  autoFocus
                />
              </div>

              <div>
                <label className="label">Новый пароль <span className="text-red-500">*</span></label>
                <input
                  type="password"
                  className="input"
                  placeholder="Минимум 6 символов"
                  value={form.new_password}
                  onChange={e => setForm(f => ({ ...f, new_password: e.target.value }))}
                />
              </div>

              <div>
                <label className="label">Повторите пароль <span className="text-red-500">*</span></label>
                <input
                  type="password"
                  className="input"
                  placeholder="Повторите пароль"
                  value={form.confirm_password}
                  onChange={e => setForm(f => ({ ...f, confirm_password: e.target.value }))}
                />
              </div>

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

          {/* Step 2: Push notifications */}
          {step === 2 && (
            <div className="space-y-4 text-center">
              <div className="text-5xl mb-2">🔔</div>
              <h2 className="text-lg font-semibold text-gray-800">Включить уведомления?</h2>
              <p className="text-sm text-gray-500 text-left">
                Система будет присылать вам напоминания:
              </p>
              <ul className="text-sm text-gray-600 text-left space-y-1 bg-gray-50 rounded-xl p-3">
                <li>📝 <b>09:00</b> — напоминание поставить план</li>
                <li>🔴 <b>10:00</b> — уведомление о просрочке плана</li>
                <li>✅ <b>21:00</b> — напоминание внести факт</li>
                <li>🔴 <b>22:00</b> — уведомление о просрочке факта</li>
              </ul>

              {pushResult?.ok && (
                <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-3 py-2">
                  ✅ Уведомления включены! Переходим...
                </div>
              )}
              {pushResult && !pushResult.ok && pushResult.reason === 'denied' && (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm rounded-lg px-3 py-2">
                  Доступ к уведомлениям запрещён. Можно включить позже в настройках браузера.
                </div>
              )}

              <div className="flex flex-col gap-2">
                {!pushResult?.ok && (
                  <button onClick={handleEnablePush} className="btn-primary w-full">
                    🔔 Включить уведомления
                  </button>
                )}
                <button onClick={skipPush} className="btn-secondary w-full text-sm">
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
