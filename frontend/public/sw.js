const CACHE_VERSION = 'mall-delivery-pwa-v2';
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/truck.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-192.png',
  '/icons/maskable-512.png',
  '/icons/apple-touch-icon.png',
];

const TRACK_PATH = '/track/';

function isSameOrigin(requestUrl) {
  return requestUrl.origin === self.location.origin;
}

function isApiOrSocket(requestUrl) {
  return requestUrl.pathname.startsWith('/api') || requestUrl.pathname.startsWith('/socket.io');
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => ![APP_SHELL_CACHE, RUNTIME_CACHE].includes(key))
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!isSameOrigin(url) || isApiOrSocket(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(APP_SHELL_CACHE).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/') || url.pathname === '/truck.svg') {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response && response.ok) {
              const copy = response.clone();
              caches.open(RUNTIME_CACHE)
                .then((cache) => cache.put(request, copy))
                .then(() => trimCache(RUNTIME_CACHE, 80));
            }
            return response;
          })
          .catch(() => cached);

        return cached || network;
      })
    );
  }
});

self.addEventListener('push', (event) => {
  if (!event.data) {
    console.warn('[SW Push] No data in push event');
    return;
  }

  let payload;
  try {
    payload = event.data.json();
    console.log('[SW Push] Received push payload:', payload);
  } catch {
    payload = { title: 'Mall Delivery', body: event.data.text() };
    console.log('[SW Push] Fallback text payload:', payload);
  }

  const {
    title = 'Mall Delivery',
    body = '',
    url,
    tag,
    icon = '/icons/icon-192.png',
    badge = '/icons/maskable-192.png',
    vibrate = [300, 120, 300, 120, 600],
  } = payload;

  const notificationTag = tag ?? 'mall-delivery';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        const focusedTrackClient = windowClients.find((client) => {
          try {
            const clientUrl = new URL(client.url);
            return client.focused && clientUrl.origin === self.location.origin && clientUrl.pathname.startsWith(TRACK_PATH);
          } catch {
            return false;
          }
        });

        if (focusedTrackClient) {
          console.log('[SW Push] Track page focused, skipping system notification:', { title, body });
          return undefined;
        }

        console.log('[SW Push] Showing notification:', { title, body, tag: notificationTag, vibrate });
        return self.registration.showNotification(title, {
          body,
          icon,
          badge,
          tag: notificationTag,
          renotify: true,
          requireInteraction: true,
          data: { url: url ?? '/' },
          vibrate,
        });
      })
      .then(() => console.log('[SW Push] Push handled successfully'))
      .catch((err) => console.error('[SW Push] Failed to show notification:', err))
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[SW NotificationClick] Clicked notification with tag:', event.notification.tag);
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(TRACK_PATH) && 'focus' in client) {
          console.log('[SW NotificationClick] Focusing existing Track window');
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      console.log('[SW NotificationClick] Opening new window to:', targetUrl);
      if (clients.openWindow) return clients.openWindow(targetUrl);
      return undefined;
    })
  );
});
