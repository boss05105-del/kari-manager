import React, { useState, useEffect } from 'react';
import { getPushStatus, registerPush, unregisterPush } from '../utils/pushNotifications';

export default function PushToggle() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getPushStatus().then(setStatus);
  }, []);

  async function toggle() {
    setLoading(true);
    if (status?.subscribed) {
      await unregisterPush();
      setStatus(s => ({ ...s, subscribed: false }));
    } else {
      const result = await registerPush();
      if (result.ok) setStatus(s => ({ ...s, subscribed: true, permission: 'granted' }));
      else if (result.reason === 'denied') setStatus(s => ({ ...s, permission: 'denied' }));
    }
    setLoading(false);
  }

  if (!status?.supported) return null;

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
      <span className="text-2xl">{status.subscribed ? '🔔' : '🔕'}</span>
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-800">Push-уведомления</p>
        <p className="text-xs text-gray-500">
          {status.permission === 'denied'
            ? 'Запрещено в браузере'
            : status.subscribed ? 'Включены' : 'Отключены'}
        </p>
      </div>
      {status.permission !== 'denied' && (
        <button
          onClick={toggle}
          disabled={loading}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            status.subscribed ? 'bg-green-500' : 'bg-gray-300'
          } disabled:opacity-50`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            status.subscribed ? 'translate-x-6' : 'translate-x-1'
          }`} />
        </button>
      )}
    </div>
  );
}
