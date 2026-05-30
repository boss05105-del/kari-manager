export function today() {
  return new Date().toISOString().split('T')[0];
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(dtStr) {
  if (!dtStr) return '—';
  const d = new Date(dtStr);
  return d.toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

export function formatTime(dtStr) {
  if (!dtStr) return '—';
  const d = new Date(dtStr);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function relativeTime(dtStr) {
  if (!dtStr) return '—';
  const now = new Date();
  const d = new Date(dtStr);
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'только что';
  if (diff < 3600) return `${Math.floor(diff / 60)} мин. назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч. назад`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} дн. назад`;
  return formatDate(dtStr);
}

export function getDayName(dateStr) {
  const days = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
  return days[new Date(dateStr).getDay()];
}

export function shortDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}
