import React, { useState, useEffect, useRef } from 'react';
import api from '../api/client';
import { relativeTime } from '../utils/dateUtils';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function fetchUnread() {
    try {
      const data = await api.get('/notifications/unread-count');
      setUnread(data.count);
    } catch {}
  }

  async function handleOpen() {
    if (!open) {
      try {
        const data = await api.get('/notifications');
        setNotifications(data);
        setOpen(true);
      } catch {}
    } else {
      setOpen(false);
    }
  }

  async function markAllRead() {
    try {
      await api.put('/notifications/read-all');
      setUnread(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch {}
  }

  function typeIcon(type) {
    if (type?.includes('overdue')) return '🔴';
    if (type?.includes('reminder')) return '🔔';
    return '📌';
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="relative p-1.5 rounded hover:bg-red-700 transition-colors text-red-100"
        aria-label="Уведомления"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-yellow-400 text-gray-900 text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-gray-900">Уведомления</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-red-600 hover:underline">
                Прочитать все
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">Нет уведомлений</div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-gray-50 last:border-0 ${!n.is_read ? 'bg-red-50' : ''}`}
                >
                  <div className="flex gap-2">
                    <span className="text-base shrink-0">{typeIcon(n.type)}</span>
                    <div className="min-w-0">
                      <p className="text-sm text-gray-800">{n.message}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{relativeTime(n.created_at)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
