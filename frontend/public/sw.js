self.addEventListener('push', (event) => {
  let data = { title: 'Kari Manager', body: 'Новое уведомление' };
  try { data = JSON.parse(event.data.text()); } catch {}

  const isOverdue = data.data?.type?.includes('overdue');

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        vibrate: isOverdue ? [300, 100, 300, 100, 300] : [200, 100, 200],
        tag: data.data?.type || 'default',
        requireInteraction: isOverdue,
        data: data.data || {}
      }),
      // Send message to open windows to play sound
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
        for (const client of list) {
          client.postMessage({ type: 'PLAY_NOTIFICATION_SOUND', urgent: isOverdue });
        }
      })
    ])
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes(self.location.origin)) {
          return client.focus();
        }
      }
      return clients.openWindow('/');
    })
  );
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));
