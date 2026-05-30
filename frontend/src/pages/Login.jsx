import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.post('/auth/login', form);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate(data.user.role === 'admin' ? '/admin' : '/director');
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

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Вход в систему</h2>

          {error && (
            <div className="bg-purple-50 border border-purple-200 text-purple-700 text-sm rounded-lg px-3 py-2.5">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Логин</label>
              <input
                type="text"
                className="input"
                placeholder="Введите логин"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                autoComplete="username"
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
                autoComplete="current-password"
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

          <div className="border-t border-gray-100 pt-3 text-xs text-gray-400 space-y-1">
            <p><span className="font-medium">Руководитель:</span> admin / admin123</p>
            <p><span className="font-medium">Директор:</span> dir11392 / store11392</p>
          </div>
        </div>
      </div>
    </div>
  );
}
