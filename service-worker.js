const CACHE = 'tama-pwa-stable-update-v2'; // bump per release
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(ASSETS);
    self.skipWaiting(); // pronto per attivarsi appena richiesto
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  e.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const resp = await fetch(request);
      const copy = resp.clone();
      const c = await caches.open(CACHE);
      c.put(request, copy);
      return resp;
    } catch {
      return caches.match('./index.html');
    }
  })());
});

// messaggio dalla pagina per attivare subito il nuovo SW
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
