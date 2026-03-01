// Service Worker for GS App — Push Notifications
// Handles background notifications even when app is closed

const APP_ICON = '/icon-192.png';

// Install event
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

// Push notification event
self.addEventListener('push', (event) => {
    let data = { title: 'Genuine Sugarmummies', body: 'You have a new notification!', icon: APP_ICON };

    try {
        if (event.data) {
            const payload = event.data.json();
            data = { ...data, ...payload };
        }
    } catch {
        if (event.data) data.body = event.data.text();
    }

    const options = {
        body: data.body,
        icon: data.icon || APP_ICON,
        badge: APP_ICON,
        vibrate: [200, 100, 200],
        data: { url: data.url || '/', timestamp: Date.now() },
        actions: [
            { action: 'open', title: 'Open App' },
            { action: 'dismiss', title: 'Dismiss' },
        ],
        tag: data.tag || 'gs-notification',
        renotify: true,
    };

    event.waitUntil(self.registration.showNotification(data.title, options));
});

// Click notification → open app
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    if (event.action === 'dismiss') return;
    const url = event.notification.data?.url || '/';
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            for (const client of clients) {
                if (client.url.includes(self.location.origin)) {
                    client.navigate(url);
                    return client.focus();
                }
            }
            return self.clients.openWindow(url);
        })
    );
});
