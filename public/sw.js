// Genuine Sugarmummies Service Worker
// Custom offline fallback configuration (safely handles offline state without caching other resources)

const CACHE_NAME = 'gs-offline-v2';
const OFFLINE_URL = '/offline.html';

// Install event: cache only the offline fallback page
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll([OFFLINE_URL]);
        })
    );
    self.skipWaiting();
});

// Activate event: clean up older caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event: intercept page navigations and serve offline page if disconnected
self.addEventListener('fetch', (event) => {
    // Only intercept page navigation requests (HTML page loads)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => {
                return caches.open(CACHE_NAME).then((cache) => {
                    return cache.match(OFFLINE_URL);
                });
            })
        );
    }
    // All other requests (bundles, images, API) bypass cache and go directly to network
});
