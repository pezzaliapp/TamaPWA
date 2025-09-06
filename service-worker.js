
// SW v15 network-first
const CACHE = 'tama-min-v15';
const ASSETS = ['./','./index.html','./manifest.json','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil((async()=>{const c=await caches.open(CACHE);await c.addAll(ASSETS);self.skipWaiting();})());});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{const ks=await caches.keys();await Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim();})());});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith((async()=>{
    try{ const net=await fetch(e.request); const c=await caches.open(CACHE); c.put(e.request, net.clone()); return net; }
    catch{ const cached=await caches.match(e.request); return cached || caches.match('./index.html'); }
  })());
});
