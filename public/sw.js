const CACHE = 'pdv-burguer-v2';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll([
      '/',
      '/dashboard',
      '/offline.html',
      '/favicon.ico'
    ])).catch(()=>{})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith((async () => {
    try {
      const net = await fetch(req);
      const cache = await caches.open(CACHE);
      cache.put(req, net.clone());
      return net;
    } catch (e) {
      // Offline
      const cache = await caches.open(CACHE);
      // Navegação: tenta shell ou offline
      if (req.mode === 'navigate' || (req.destination === 'document')) {
        const shell = await cache.match('/') || await cache.match('/offline.html');
        if (shell) return shell;
      }
      const hit = await cache.match(req) || await cache.match('/offline.html');
      if (hit) return hit;
      throw e;
    }
  })());
});
