// Service Worker for Web Push Notifications
const TRACK_PATH = '/track/';

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'QUE Delivery', body: event.data.text() };
  }

  const { title = 'QUE Delivery', body = '', url, tag, icon = '/favicon.ico' } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      tag: tag ?? 'que-delivery',
      renotify: true,
      requireInteraction: false,
      data: { url: url ?? '/' },
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // Focus existing tab if already open
      for (const client of list) {
        if (client.url.includes(TRACK_PATH) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Open new tab
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));
