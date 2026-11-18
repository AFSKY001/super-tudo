const CACHE_NAME = 'super-tudo-v3.42.0';
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
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin && request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put('/', response.clone());
        }
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
  if (url.origin === self.location.origin && ['/manifest.webmanifest', '/icon.svg', '/logo.webp'].includes(url.pathname)) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response && response.ok) (await caches.open(CACHE_NAME)).put(request, response.clone());
      return response;
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
