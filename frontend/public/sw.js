const CACHE_NAME = 'kari-v2';
const STATIC_ASSETS = ['/', '/index.html'];

// Install: cache the shell
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: remove old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  e.waitUntil(clients.claim());
});

// Fetch: network first for API, cache first for static assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API requests: network only (never cache)
  if (url.pathname.startsWith('/api/')) return;

  // Static assets (JS, CSS, fonts): cache first, then network
  if (
    url.pathname.match(/\.(js|css|woff2?|png|svg|ico)$/) ||
    url.pathname.startsWith('/assets/')
  ) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // HTML pages: network first, fallback to cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }
});

// Push notifications
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
        if (client.url.includes(self.location.origin)) return client.focus();
      }
      return clients.openWindow('/');
    })
  );
});
