// Self-Destructing Service Worker
// Instantly deletes all browser caches and unregisters to remove caching completely.

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
            .then(() => self.registration.unregister())
            .then(() => {
                console.log('[SW] Service Worker self-destructed and cache cleared completely.');
            })
    );
});
