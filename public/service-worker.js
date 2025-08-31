const CACHE = 'chorechart-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  event.respondWith((async () => {
    try {
      const network = await fetch(request);
      const cache = await caches.open(CACHE);
      cache.put(request, network.clone());
      return network;
    } catch (err) {
      const cached = await caches.match(request);
      return cached || caches.match('/index.html');
    }
  })());
});