import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import NotificationBell from './NotificationBell';

const NAV_ADMIN = [
  { to: '/admin', label: 'Дашборд', icon: '📊' },
  { to: '/admin/analytics', label: 'Аналитика', icon: '📈' },
  { to: '/admin/ratings', label: 'Рейтинг', icon: '🏆' },
  { to: '/admin/overdue', label: 'Просрочки', icon: '⚠️' }
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

  const rawUser = localStorage.getItem('user');
  const user = rawUser ? JSON.parse(rawUser) : null;
  const nav = user?.role === 'admin' ? NAV_ADMIN : NAV_DIRECTOR;

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Top bar */}
      <header className="bg-red-600 text-white shadow-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-1 rounded hover:bg-red-700 transition-colors"
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
                    ? 'bg-red-800 text-white'
                    : 'text-red-100 hover:bg-red-700 hover:text-white'
                }`}
              >
                <span className="mr-1">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <NotificationBell />
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <span className="text-red-200 truncate max-w-[140px]">{user?.full_name?.split(' ')[0]}</span>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded hover:bg-red-700 transition-colors text-red-100 hover:text-white"
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
        <div className="lg:hidden bg-red-700 px-4 py-2 flex flex-col gap-1 z-20 shadow-lg">
          {nav.map(item => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMenuOpen(false)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === item.to
                  ? 'bg-red-900 text-white'
                  : 'text-red-100 hover:bg-red-600'
              }`}
            >
              <span className="mr-2">{item.icon}</span>
              {item.label}
            </Link>
          ))}
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
                  ? 'text-red-600'
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
