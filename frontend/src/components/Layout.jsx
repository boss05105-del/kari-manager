import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import NotificationBell from './NotificationBell';
import api from '../api/client';

const NAV_ADMIN = [
  { to: '/admin', label: 'Дашборд', icon: '📊' },
  { to: '/admin/analytics', label: 'Аналитика', icon: '📈' },
  { to: '/admin/ratings', label: 'Рейтинг', icon: '🏆' },
  { to: '/admin/overdue', label: 'Просрочки', icon: '⚠️' },
  { to: '/admin/report', label: 'Отчёт', icon: '📋' },
  { to: '/admin/control', label: 'Контроль', icon: '🎯' },
  { to: '/admin/plan-control', label: 'План директора', icon: '📆' },
  { to: '/admin/stores', label: 'Магазины', icon: '🏪' }
];

const NAV_DIRECTOR = [
  { to: '/director', label: 'Главная', icon: '🏠' },
  { to: '/director/plan', label: 'План', icon: '📝' },
  { to: '/director/fact', label: 'Факт', icon: '✅' },
  { to: '/director/history', label: 'История', icon: '📅' }
];

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editName, setEditName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [nameSaving, setNameSaving] = useState(false);

  const rawUser = localStorage.getItem('user');
  const user = rawUser ? JSON.parse(rawUser) : null;
  const nav = user?.role === 'admin' ? NAV_ADMIN : NAV_DIRECTOR;

  async function handleSaveName(e) {
    e.preventDefault();
    if (nameValue.trim().length < 5) return;
    setNameSaving(true);
    try {
      await api.post('/users/setup-profile', { full_name: nameValue.trim(), new_password: null, skip_password: true });
      const updated = { ...user, full_name: nameValue.trim() };
      localStorage.setItem('user', JSON.stringify(updated));
      setEditName(false);
      window.location.reload();
    } catch {}
    finally { setNameSaving(false); }
  }

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Top bar */}
      <header className="bg-purple-700 text-white shadow-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-1 rounded hover:bg-purple-800 transition-colors"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Меню"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Link to="/" className="font-bold text-lg tracking-tight">
              <span className="text-white">Kari</span>
              <span className="text-red-200 font-normal ml-1 text-sm hidden sm:inline">Управление</span>
            </Link>
          </div>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {nav.map(item => (
              <Link
                key={item.to}
                to={item.to}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === item.to
                    ? 'bg-purple-900 text-white'
                    : 'text-purple-200 hover:bg-purple-800 hover:text-white'
                }`}
              >
                <span className="mr-1">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <NotificationBell />
            {user?.role === 'director' && (
              <button
                onClick={() => { setNameValue(user.full_name || ''); setEditName(true); }}
                className="hidden sm:flex items-center gap-1 text-sm text-purple-200 hover:text-white transition-colors"
                title="Изменить ФИО"
              >
                <span className="truncate max-w-[140px]">{user?.full_name?.split(' ')[0]}</span>
                <span className="text-xs opacity-60">✏️</span>
              </button>
            )}
            {user?.role !== 'director' && (
              <span className="hidden sm:block text-sm text-purple-200 truncate max-w-[140px]">{user?.full_name?.split(' ')[0]}</span>
            )}
            <button
              onClick={handleLogout}
              className="p-1.5 rounded hover:bg-purple-800 transition-colors text-purple-200 hover:text-white"
              title="Выйти"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile nav */}
      {menuOpen && (
        <div className="lg:hidden bg-purple-800 px-4 py-2 flex flex-col gap-1 z-20 shadow-lg">
          {nav.map(item => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMenuOpen(false)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === item.to
                  ? 'bg-purple-950 text-white'
                  : 'text-purple-200 hover:bg-purple-700'
              }`}
            >
              <span className="mr-2">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>
      )}

      {/* Edit name modal */}
      {editName && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Изменить ФИО</h3>
            <form onSubmit={handleSaveName} className="space-y-4">
              <input
                type="text"
                className="input"
                placeholder="Фамилия Имя Отчество"
                value={nameValue}
                onChange={e => setNameValue(e.target.value)}
                autoFocus
              />
              <div className="flex gap-2">
                <button type="submit" disabled={nameSaving || nameValue.trim().length < 5} className="btn-primary flex-1">
                  {nameSaving ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button type="button" onClick={() => setEditName(false)} className="btn-secondary flex-1">Отмена</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-20 safe-bottom">
        <div className="flex">
          {nav.map(item => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex-1 flex flex-col items-center py-2 text-xs transition-colors ${
                location.pathname === item.to
                  ? 'text-purple-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="mt-0.5 truncate">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
