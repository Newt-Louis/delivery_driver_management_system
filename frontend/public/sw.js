const CACHE_VERSION = 'mall-delivery-pwa-v4';
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
          .filter((key) => ![APP_SHELL_CACHE, RUNTIME_CACHE, 'driver-notice-receipts-v1'].includes(key))
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

// Serialise push receipts: delayed WAITING must never replace a newer CALLED.
let pushWork = Promise.resolve();
const RECEIPTS_CACHE = 'driver-notice-receipts-v1';

async function selectedCode(client) {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => { channel.port1.close(); resolve(null); }, 400);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      channel.port1.close();
      resolve(event.data?.code ?? null);
    };
    client.postMessage({ type: 'driver-notification-context' }, [channel.port2]);
  });
}

async function handleDriverPush(payload) {
  const code = payload.deliveryCode;
  if (!code) return;
  const receiptUrl = new URL('/__driver-notice/' + encodeURIComponent(code), self.location.origin).href;
  const cache = await caches.open(RECEIPTS_CACHE);
  const previousResponse = await cache.match(receiptUrl);
  const previous = previousResponse ? await previousResponse.json() : null;
  const obsolete = previous && (previous.eventId === payload.eventId
    || (previous.occurredAt && payload.occurredAt && previous.occurredAt > payload.occurredAt)
    || ['COMPLETED', 'CANCELLED', 'EXPIRED', 'INCOMPLETED'].includes(previous.status));
  if (obsolete) {
    // Every received push must remain user-visible on Safari. Re-present the
    // latest notice silently instead of sounding/replacing it with stale data.
    await self.registration.showNotification(previous.title, {
      body: previous.body, tag: 'delivery:' + code, silent: true,
      icon: '/icons/icon-192.png', data: { url: '/track/' + encodeURIComponent(code), deliveryCode: code },
    });
    return;
  }
  const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  const focused = windows.find((client) => client.focused && client.visibilityState === 'visible');
  const personalForeground = focused && await selectedCode(focused) === code;
  windows.forEach((client) => client.postMessage({ type: 'driver-push-received', payload }));
  await self.registration.showNotification(payload.title || 'Thông báo chuyến giao hàng', {
    body: payload.body || '', icon: '/icons/icon-192.png', badge: '/icons/maskable-192.png',
    tag: 'delivery:' + code, renotify: !personalForeground,
    requireInteraction: payload.status === 'CALLED',
    ...(personalForeground ? { silent: true } : { vibrate: [300, 120, 300, 120, 600] }),
    data: { url: '/track/' + encodeURIComponent(code), deliveryCode: code },
  });
  await cache.put(receiptUrl, new Response(JSON.stringify({
    eventId: payload.eventId, occurredAt: payload.occurredAt, status: payload.status,
    title: payload.title || 'Thông báo chuyến giao hàng', body: payload.body || '',
  }), { headers: { 'Content-Type': 'application/json' } }));
  await trimCache(RECEIPTS_CACHE, 30);
}

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); } catch { return; }
  pushWork = pushWork.catch(() => {}).then(() => handleDriverPush(payload));
  event.waitUntil(pushWork);
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
