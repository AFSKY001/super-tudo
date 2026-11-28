const CACHE_NAME='super-tudo-v3.75.4';
const APP_CACHE_PREFIX = 'super-tudo-';
self.addEventListener('install', event => {
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(APP_CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (_) {
    payload = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(self.registration.showNotification(payload.title || 'Super Tudo', {
    body: payload.body || 'Você tem uma nova notificação.',
    icon: '/logo.webp',
    badge: '/logo.webp',
    tag: payload.tag || 'super-tudo',
    data: payload.data || { url: '/' },
    renotify: false
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async windows => {
    for (const client of windows) {
      if ('focus' in client) {
        if ('navigate' in client) await client.navigate(target);
        return client.focus();
      }
    }
    return self.clients.openWindow(target);
  }));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin && request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        // Ignore the browser HTTP cache when checking for a newer app version.
        // Keep the existing Cache Storage fallback below for offline launches.
        const networkRequest = new Request(request, { cache: 'no-store' });
        const response = await fetch(networkRequest);
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put('/', response.clone());
          return response;
        }
        if (response && response.status < 500) return response;
        const cached = await caches.match('/');
        if (cached) return cached;
        const fallback = await caches.match('/index.html');
        if (fallback) return fallback;
        return response;
      } catch (error) {
        const cached = await caches.match('/');
        if (cached) return cached;
        const fallback = await caches.match('/index.html');
        if (fallback) return fallback;
        return new Response('O Super Tudo ainda não foi carregado neste aparelho. Conecte-se à internet e abra o aplicativo uma vez.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
    })());
    return;
  }
  if (url.origin === self.location.origin && ['/manifest.webmanifest', '/icon.svg', '/logo.webp', '/pickers.js', '/routine.js', '/notes.js', '/notification-sounds.js'].includes(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(new Request(request, { cache: 'no-store' }));
        if (response && response.ok) {
          await cache.put(request, response.clone());
          return response;
        }
        if (response && response.status < 500) return response;
        const cached = await cache.match(request);
        if (cached) return cached;
        return response;
      } catch (error) {
        const cached = await cache.match(request);
        if (cached) return cached;
        throw error;
      }
    })());
    return;
  }
  if (url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('/@supabase/supabase-js/')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response && response.ok) await cache.put(request, response.clone());
      return response;
    })());
  }
});
