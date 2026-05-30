import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('store'); // 'store' | 'admin'
  const [storeNumber, setStoreNumber] = useState('');
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleStoreLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.post('/auth/login-store', { store_number: storeNumber });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate(data.user.profile_completed ? '/director' : '/setup');
    } catch (err) {
      setError(err.error || 'Магазин не найден');
    } finally {
      setLoading(false);
    }
  }

  async function handleAdminLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.post('/auth/login', form);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/admin');
    } catch (err) {
      setError(err.error || 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-700 to-purple-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
            <span className="text-2xl font-black text-purple-700 tracking-tight">kari</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Kari Manager</h1>
          <p className="text-purple-200 mt-1 text-sm">Система управления магазинами</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-6 space-y-5">

          {mode === 'store' ? (
            <>
              <div className="text-center">
                <h2 className="text-xl font-bold text-gray-800">Введите номер магазина</h2>
                <p className="text-gray-400 text-sm mt-1">Пароль не нужен</p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2.5 text-center">
                  {error}
                </div>
              )}

              <form onSubmit={handleStoreLogin} className="space-y-4">
                <input
                  type="number"
                  className="input text-center text-2xl font-bold tracking-widest h-14"
                  placeholder="00000"
                  value={storeNumber}
                  onChange={e => setStoreNumber(e.target.value)}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={loading || storeNumber.length < 4}
                  className="btn-primary w-full py-3 text-base"
                >
                  {loading ? 'Входим...' : 'Войти →'}
                </button>
              </form>

              <button
                onClick={() => { setMode('admin'); setError(''); }}
                className="w-full text-center text-xs text-gray-400 hover:text-gray-600 pt-1"
              >
                Войти как руководитель
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <button onClick={() => { setMode('store'); setError(''); }} className="text-gray-400 hover:text-gray-600">←</button>
                <h2 className="text-lg font-semibold text-gray-800">Вход для руководителя</h2>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2.5">
                  {error}
                </div>
              )}

              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label className="label">Логин</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="admin"
                    value={form.username}
                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="label">Пароль</label>
                  <input
                    type="password"
                    className="input"
                    placeholder="Введите пароль"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !form.username || !form.password}
                  className="btn-primary w-full"
                >
                  {loading ? 'Входим...' : 'Войти'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
