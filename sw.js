// Service Worker for auto-updates and caching (sw.js)

const CACHE_NAME = 'pdf-pwa-cache-v1'; // Change this on app update
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js'
];


// --- Installation: Cache static assets ---
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting(); // Force the waiting service worker to become the active service worker.
});


// --- Activation: Clean up old caches ---
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
   return self.clients.claim(); // Take control of all open clients.
});


// --- Fetch: Serve from cache first, then network ---
self.addEventListener('fetch', event => {
    // We use a "Stale-While-Revalidate" strategy for navigation requests (HTML)
    // and a "Cache First" for other requests.
    if (event.request.mode === 'navigate') {
        event.respondWith(
            caches.open(CACHE_NAME).then(cache => {
                return cache.match(event.request).then(cachedResponse => {
                    const fetchedResponsePromise = fetch(event.request).then(networkResponse => {
                        // Check if we received a valid response
                        if (networkResponse && networkResponse.status === 200) {
                             cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    }).catch(() => {
                        // Network failed, but we might have a cached version
                        return cachedResponse;
                    });

                    // Return cached response immediately if available, otherwise wait for network
                    return cachedResponse || fetchedResponsePromise;
                });
            })
        );
    } else {
        event.respondWith(
            caches.match(event.request)
            .then(response => {
                // Cache hit - return response
                if (response) {
                    return response;
                }
                // Not in cache - fetch from network
                return fetch(event.request);
            })
        );
    }
});
