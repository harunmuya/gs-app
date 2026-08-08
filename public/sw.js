/*
 * Genuine Sugar Mummies service worker.
 *
 * The previous version reported "offline" constantly to people who were online,
 * and could not actually serve anything offline. Both faults are fixed here.
 *
 * What was wrong
 * --------------
 *  1. Any rejected navigation fetch served the offline page immediately. On
 *     mobile data a fetch rejects routinely — tower handover, a tunnel, the radio
 *     waking from idle — none of which mean the user has lost their connection.
 *  2. A response of 500 or above also served the offline page, so a transient
 *     upstream error told a user on full signal that they were offline. A server
 *     error is not a connectivity problem and must be shown as itself.
 *  3. Nothing was ever written to the cache. PRECACHE_URLS held only the offline
 *     page and no handler called cache.put, so the "fall back to cache" branch
 *     could never hit. Offline support was a dead-end page, not a working app.
 *
 * How it behaves now
 * ------------------
 *  - Immutable assets (build output, icons, imagery) are cache-first, so they
 *    load instantly and keep working with no connection.
 *  - Navigations are network-first with a short timeout, falling back to the last
 *    good copy of that page, then to any cached shell, and only then to the
 *    offline page. A brief mobile-data stall no longer looks like being offline.
 *  - Retries: a failed navigation is attempted twice before giving up.
 *  - Server errors (5xx) pass straight through to the browser.
 *  - API traffic is never cached — it is authenticated and per-user — but a failed
 *    API call returns a JSON error the app can act on, not an HTML page.
 */

const VERSION = 'v14';
const SHELL_CACHE = `gs-shell-${VERSION}`;
const ASSET_CACHE = `gs-assets-${VERSION}`;
const PAGE_CACHE = `gs-pages-${VERSION}`;
const OFFLINE_URL = '/offline.html';

/** Cached during install so a cold offline start still has something to show. */
const PRECACHE_URLS = [
    OFFLINE_URL,
    '/icons/sprite.svg',
    '/manifest.json',
];

/** Paths whose contents never change for a given URL. */
const IMMUTABLE_PREFIXES = ['/_next/static/', '/icons/', '/seed/', '/gifts/', '/downloads/'];

/** How long to wait for the network on a navigation before using a cached copy. */
const NAVIGATION_TIMEOUT_MS = 6000;
const NAVIGATION_ATTEMPTS = 2;

function isImmutableAsset(pathname) {
    return IMMUTABLE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(SHELL_CACHE);
        // Individually, so one missing file cannot fail the whole install.
        await Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)));
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keep = new Set([SHELL_CACHE, ASSET_CACHE, PAGE_CACHE]);
        const keys = await caches.keys();
        await Promise.all(keys.filter((key) => !keep.has(key)).map((key) => caches.delete(key)));
        // Serve navigations from the cache while the network is still being tried.
        if (self.registration.navigationPreload) {
            await self.registration.navigationPreload.enable().catch(() => {});
        }
        await self.clients.claim();
    })());
});

self.addEventListener('message', (event) => {
    const data = event.data || {};
    if (data.type === 'GS_BADGE_COUNT') {
        const count = Math.max(0, Math.min(99, Number(data.count || 0)));
        if (self.navigator?.setAppBadge) {
            if (count > 0) self.navigator.setAppBadge(count).catch(() => {});
            else self.navigator.clearAppBadge?.().catch(() => {});
        }
    }
    if (data.type === 'GS_SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = new URL(event.notification?.data?.url || '/alerts', self.location.origin).href;
    event.waitUntil((async () => {
        const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of list) {
            if ('focus' in client) {
                await client.focus();
                if ('navigate' in client) await client.navigate(targetUrl);
                return;
            }
        }
        if (self.clients.openWindow) await self.clients.openWindow(targetUrl);
    })());
});

self.addEventListener('push', (event) => {
    let payload = {};
    try { payload = event.data ? event.data.json() : {}; } catch { payload = { title: 'GS notification', body: event.data?.text() || '' }; }
    const title = payload.title || 'Genuine Sugar Mummies';
    const count = Math.max(0, Math.min(99, Number(payload.count || 1)));
    const options = {
        body: payload.body || '',
        icon: payload.icon || '/icons/icon-192.png',
        badge: payload.badge || '/icons/icon-192.png',
        image: payload.image || undefined,
        tag: payload.tag || 'gs-push',
        renotify: true,
        vibrate: [160, 80, 160],
        data: { url: payload.url || '/alerts', count, label: count > 99 ? '99+' : String(count) },
    };
    event.waitUntil((async () => {
        if (self.navigator?.setAppBadge) {
            if (count > 0) await self.navigator.setAppBadge(count).catch(() => {});
            else await self.navigator.clearAppBadge?.().catch(() => {});
        }
        await self.registration.showNotification(title, options);
    })());
});

/**
 * Tell open pages about connectivity changes observed while proxying requests.
 * Throttled so a burst of failed requests does not flood the page with messages.
 */
let lastNotice = { type: '', at: 0 };
async function notifyClients(type) {
    const now = Date.now();
    if (lastNotice.type === type && now - lastNotice.at < 2000) return;
    lastNotice = { type, at: now };
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) client.postMessage({ type });
}

/** Fetch with a deadline, so a stalled radio does not hang the page indefinitely. */
async function fetchWithTimeout(request, ms) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
        return await fetch(request, { signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

/** Cache-first. Immutable by definition, so a hit is always safe to serve. */
async function handleImmutableAsset(request) {
    const cache = await caches.open(ASSET_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
        const response = await fetch(request);
        if (response && response.ok) cache.put(request, response.clone());
        return response;
    } catch (error) {
        // A miss with no network is a genuine failure for this asset, but it must
        // not be dressed up as the whole app being offline.
        return new Response('', { status: 504, statusText: 'Asset unavailable offline' });
    }
}

/**
 * Network-first with retries, then the last good copy of this page, then any
 * cached shell, then the offline page.
 */
async function handleNavigation(event) {
    const { request } = event;
    const cache = await caches.open(PAGE_CACHE);

    const preload = await event.preloadResponse?.catch(() => null);
    if (preload) {
        if (preload.ok) cache.put(request, preload.clone());
        return preload;
    }

    for (let attempt = 0; attempt < NAVIGATION_ATTEMPTS; attempt += 1) {
        try {
            const response = await fetchWithTimeout(request, NAVIGATION_TIMEOUT_MS);
            // Server errors are returned as-is. Showing "you are offline" for a 502
            // misdescribes the problem and sends the user to check their signal.
            if (response) {
                if (response.ok) cache.put(request, response.clone());
                return response;
            }
        } catch (error) {
            // Transient. Try again before concluding anything.
        }
    }

    const cachedPage = await cache.match(request);
    if (cachedPage) return cachedPage;

    const anyShell = await cache.match('/') || await cache.match('/discover');
    if (anyShell) return anyShell;

    const shell = await caches.open(SHELL_CACHE);
    return (await shell.match(OFFLINE_URL)) || new Response('Offline', { status: 503 });
}

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    // The connectivity probe must pass through untouched. If it received the
    // synthetic offline response below, the request would resolve rather than
    // reject and the client would read a dead connection as a working one.
    if (url.pathname === '/api/ping') return;

    // Never cache API traffic: it is authenticated and per-user. On failure return
    // JSON so the app can show an inline message rather than an HTML page.
    if (url.pathname.startsWith('/api/')) {
        event.respondWith((async () => {
            try {
                const response = await fetch(request);
                notifyClients('GS_NETWORK_OK');
                return response;
            } catch (error) {
                // The worker sees a real request fail before any poll would. Telling
                // the page immediately is what makes the connection banner appear in
                // seconds rather than on the next scheduled check, which is how
                // established apps behave — they react to their own traffic failing.
                notifyClients('GS_NETWORK_LOST');
                return new Response(
                    JSON.stringify({ error: 'You appear to be offline.', code: 'OFFLINE' }),
                    { status: 503, headers: { 'Content-Type': 'application/json' } }
                );
            }
        })());
        return;
    }

    if (isImmutableAsset(url.pathname)) {
        event.respondWith(handleImmutableAsset(request));
        return;
    }

    if (request.mode === 'navigate') {
        event.respondWith(handleNavigation(event));
        return;
    }

    // Everything else: network, falling back to cache if we happen to have it.
    event.respondWith(
        fetch(request).catch(async () => {
            const cached = await caches.match(request);
            return cached || new Response('', { status: 504 });
        })
    );
});
