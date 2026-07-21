const CACHE_NAME = 'medicore-v1';
const ASSETS = [
  './',
  './index.html',
  './css/index.css',
  './js/index.js',
  './js/shared-state.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then((res) => res || fetch(e.request)));
});