const CACHE_NAME = 'medicore-v2';
const ASSETS = [
  './',
  './index.html',
  './css/variables.css',
  './css/index.css',
  './js/shared-state.js',
  './js/index.js',
  './MediCore.png',
  './icon-192.png',
  './icon-512.png',
  './manifest.json'
];

// Install: cache core assets
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; }).map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// Fetch: network first (API), cache first (static)
self.addEventListener('fetch', function(e) {
  var url = new URL(e.request.url);

  // Supabase API — network only, no cache
  if (url.hostname.includes('supabase')) {
    return;
  }

  // Static assets — cache first
  if (ASSETS.includes(url.pathname) || url.pathname.match(/\.(css|js|png|jpg|svg|woff2?)$/)) {
    e.respondWith(
      caches.match(e.request).then(function(cached) {
        return cached || fetch(e.request).then(function(res) {
          return caches.open(CACHE_NAME).then(function(cache) {
            cache.put(e.request, res.clone());
            return res;
          });
        });
      })
    );
    return;
  }

  // Everything else — network first, fallback to cache
  e.respondWith(
    fetch(e.request).then(function(res) {
      return caches.open(CACHE_NAME).then(function(cache) {
        cache.put(e.request, res.clone());
        return res;
      });
    })['catch'](function() {
      return caches.match(e.request);
    })
  );
});
