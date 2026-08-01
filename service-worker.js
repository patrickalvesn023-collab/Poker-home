const CACHE_NAME = 'poker-ofc-cache-v1';
const FILES_TO_CACHE = [
  'index.html',
  'index.html',
  'styles.css',
  'app.js',
  'manifest.json',
  'service-worker.js',
  'icon-192.png',
  'icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
          return null;
        }),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request)
        .then((networkResponse) => {
          if (
            !networkResponse ||
            networkResponse.status !== 200 ||
            networkResponse.type === 'opaque'
          ) {
            return networkResponse;
          }

          const responseClone = networkResponse.clone();
          if (event.request.url.startsWith(self.location.origin)) {
            event.waitUntil(
              caches.open(CACHE_NAME).then((cache) =>
                cache.put(event.request, responseClone),
              ),
            );
          }

          return networkResponse;
        })
        .catch(() => {
          if (event.request.mode === 'navigate') {
            return caches.match('index.html').then((cachedResponse) => {
              return cachedResponse || caches.match('index.html');
            });
          }
          return null;
        });
    }),
  );
});
