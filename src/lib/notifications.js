'use client';

// ============================================================
// Notifications — Permission, Service Worker, Local Notifications
// ============================================================

let swRegistration = null;

// Register Service Worker
export async function registerServiceWorker() {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
    try {
        swRegistration = await navigator.serviceWorker.register('/sw.js');
        console.log('[SW] Registered:', swRegistration.scope);
        return swRegistration;
    } catch (err) {
        console.warn('[SW] Registration failed:', err);
        return null;
    }
}

// Request notification permission
export async function requestNotificationPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    try {
        const result = await Notification.requestPermission();
        return result;
    } catch {
        return 'denied';
    }
}

// Check if notifications are supported and permitted
export function canNotify() {
    return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted';
}

// Send a local notification (works even when app is backgrounded if SW is registered)
export async function sendNotification(title, body, options = {}) {
    if (!canNotify()) return;

    const notifOptions = {
        body,
        icon: options.icon || '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [200, 100, 200],
        tag: options.tag || 'gs-' + Date.now(),
        renotify: true,
        data: {
            url: options.url || '/',
            timestamp: Date.now(),
        },
        ...options,
    };

    // Try Service Worker notification first (works in background)
    if (swRegistration) {
        try {
            await swRegistration.showNotification(title, notifOptions);
            return;
        } catch { }
    }

    // Fallback: browser Notification API (only works when page is open)
    try {
        new Notification(title, notifOptions);
    } catch { }
}

// Send match notification
export function notifyMatch(matchName) {
    sendNotification(
        '💖 New Match!',
        `${matchName} matched with you! Start chatting now.`,
        { tag: 'match-' + Date.now(), url: '/matches' }
    );
}

// Send message notification
export function notifyMessage(senderName, messagePreview) {
    const preview = messagePreview.length > 50 ? messagePreview.substring(0, 47) + '...' : messagePreview;
    sendNotification(
        senderName,
        preview,
        { tag: 'msg-' + Date.now(), url: '/chat' }
    );
}

// Send like notification
export function notifyLike(likerName) {
    sendNotification(
        '❤️ Someone Liked You!',
        `${likerName} liked your profile. Check it out!`,
        { tag: 'like-' + Date.now(), url: '/matches' }
    );
}

// Send system notification
export function notifySystem(title, body) {
    sendNotification(title, body, { tag: 'system-' + Date.now() });
}

// Initialize notifications (call on app load)
export async function initNotifications() {
    await registerServiceWorker();
    const permission = await requestNotificationPermission();
    return permission;
}
