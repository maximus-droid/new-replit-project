const CACHE_NAME = 'mysty-cache-v1';
const PRECACHE = [
  './',
  './index.html',
  './style.css',
  './game.js',
  './manifest.webmanifest',
];
self.addEventListener('install', (event) => {
  event.waitUntil((async ()=>{
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE);
    self.skipWaiting();
  })());
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async ()=>{
    const keys = await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)));
    self.clients.claim();
  })());
});
self.addEventListener('fetch', (event) => {
  const req = event.request;
  event.respondWith((async ()=>{
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    if(cached) return cached;
    try{
      const res = await fetch(req);
      if(req.method==='GET' && res && res.status===200 && res.type==='basic'){
        cache.put(req, res.clone());
      }
      return res;
    }catch{
      // offline fallback to cache root
      const root = await cache.match('./');
      return root || new Response('Offline', { status: 503 });
    }
  })());
});
