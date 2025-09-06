const CACHE = 'tama-pwa-stable-v1';
const ASSETS = [
  './','./index.html','./style.css','./script.js','./manifest.json','./icon-192.png','./icon-512.png'
];
self.addEventListener('install', e=>{ e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))); });
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
});
self.addEventListener('fetch', e=>{
  const {request} = e; if (request.method!=='GET') return;
  e.respondWith(caches.match(request).then(cached => cached || fetch(request).then(resp=>{
    const copy = resp.clone(); caches.open(CACHE).then(c=>c.put(request, copy)); return resp;
  }).catch(()=>caches.match('./index.html'))));
});