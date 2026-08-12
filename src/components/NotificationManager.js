'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { unreadActivityValue, unreadMessageValue } from '@/lib/inboxCounts';
import PermissionSheet from '@/components/PermissionSheet';
import { permissionState, wasDismissed } from '@/lib/permissions';

/*
  Where the rationale must not appear.

  This component mounts in the root layout, so without this the sheet could
  open fifteen seconds into a video call or a live broadcast, over the top of
  the End Call control. Nothing about notifications is urgent enough to
  interrupt a call in progress.
*/
const NEVER_ASK_ON = [/^\/calls\//, /^\/live\//];

// Long enough that the member has looked at something before being asked.
const ASK_AFTER_MS = 15_000;

function formatBadge(count) {
    if (!count) return '';
    return count > 99 ? '99+' : String(count);
}

async function getNativeNotifications() {
    try {
        const [{ Capacitor }, { LocalNotifications }] = await Promise.all([
            import('@capacitor/core'),
            import('@capacitor/local-notifications'),
        ]);
        if (!Capacitor.isNativePlatform?.()) return null;
        return LocalNotifications;
    } catch {
        return null;
    }
}

export default function NotificationManager() {
    const { settings, user, guest, activity, messages, updateSettings } = useAuth();
    const permissionRef = useRef('default');
    const previousUnreadRef = useRef(0);
    const nativePermissionAskedRef = useRef(false);
    const [askNotifications, setAskNotifications] = useState(false);
    const pathname = usePathname() || '';
    const onImmersiveScreen = NEVER_ASK_ON.some((pattern) => pattern.test(pathname));

    const unreadCount = useMemo(() => {
        const unreadAlerts = (activity || []).reduce((total, item) => total + unreadActivityValue(item), 0);
        const unreadMessages = (messages || []).reduce((total, item) => total + unreadMessageValue(item), 0);
        return Math.min(99, unreadAlerts + unreadMessages);
    }, [activity, messages]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const browserPermission = 'Notification' in window ? Notification.permission : 'default';
        permissionRef.current = browserPermission;
    }, [user, guest, settings.notifications]);

    /*
      Ask for notifications the same way the app asks for everything else.

      This used to fire the OS dialog straight off the back of mount. A member
      who had just signed in got a system prompt from an app that had not yet
      said what it wanted to notify them about, and on Android 13 a refusal
      there is permanent: the app cannot ask again, and the only way back is the
      device settings screen. Reflexive denials are the predictable result.

      The rationale comes first now. Declining it costs nothing because the real
      permission has not been requested yet, and a decline is remembered for a
      week rather than retried on the next navigation.

      The delay matters as much as the sheet. Arriving fifteen seconds in, once
      the member is actually looking at profiles, asks at a point where the
      answer means something; arriving on first paint is just an obstacle
      between them and the app they have not seen yet.
    */
    useEffect(() => {
        if (!user?.id || !settings.notifications || nativePermissionAskedRef.current) return undefined;
        if (onImmersiveScreen) return undefined;

        const key = `gsk_native_notification_permission_${user.id}`;
        let cancelled = false;

        const timer = window.setTimeout(async () => {
            if (cancelled) return;

            const state = await permissionState('notifications');
            if (state === 'granted') {
                permissionRef.current = 'granted';
                updateSettings?.({ notificationPermission: 'granted' });
                return;
            }
            // Blocked at the OS level. Asking again does nothing except show a
            // sheet whose only outcome is a dialog that never appears.
            if (state === 'denied') {
                updateSettings?.({ notificationPermission: 'denied' });
                return;
            }
            if (wasDismissed('notifications')) return;

            const last = Number(localStorage.getItem(key) || 0);
            if (Date.now() - last < 24 * 60 * 60 * 1000) return;
            localStorage.setItem(key, String(Date.now()));

            nativePermissionAskedRef.current = true;
            setAskNotifications(true);
        }, ASK_AFTER_MS);

        return () => { cancelled = true; window.clearTimeout(timer); };
    }, [settings.notifications, updateSettings, user?.id, onImmersiveScreen]);

    async function requestPermission() {
        if (typeof window === 'undefined') return;
        try {
            const nativeNotifications = await getNativeNotifications();
            if (nativeNotifications) {
                const nativePerm = await nativeNotifications.requestPermissions();
                permissionRef.current = nativePerm.display === 'granted' ? 'granted' : 'default';
            }
            if ('Notification' in window && Notification.permission !== 'granted') {
                permissionRef.current = await Notification.requestPermission();
            }
            updateSettings?.({ notificationPermission: permissionRef.current });
            if (permissionRef.current === 'granted') {
                await registerPushSubscription();
                window.dispatchEvent(new CustomEvent('gs-notification', {
                    detail: { title: 'Notifications enabled', body: 'GS messages and account alerts can now appear on your phone.', count: unreadCount },
                }));
            }
        } catch {}
    }

    function publicVapidKeyToUint8Array(key) {
        const padding = '='.repeat((4 - key.length % 4) % 4);
        const base64 = (key + padding).replace(/-/g, '+').replace(/_/g, '/');
        const raw = window.atob(base64);
        return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
    }

    async function registerPushSubscription() {
        if (!user?.id || typeof navigator === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidKey) return;
        try {
            const registration = await navigator.serviceWorker.ready;
            const existing = await registration.pushManager.getSubscription();
            const subscription = existing || await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: publicVapidKeyToUint8Array(vapidKey),
            });
            await fetch('/api/members', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'push_subscription',
                    memberId: user.id,
                    email: user.email,
                    subscription: subscription.toJSON(),
                    permission: Notification.permission,
                    platform: 'web-pwa',
                    userAgent: navigator.userAgent,
                }),
            });
        } catch {}
    }

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const handler = () => requestPermission();
        window.addEventListener('gs-request-notifications', handler);
        return () => window.removeEventListener('gs-request-notifications', handler);
    }, [unreadCount]);

    useEffect(() => {
        if (typeof navigator === 'undefined') return;
        const count = Math.max(0, unreadCount || 0);
        if ('setAppBadge' in navigator) {
            if (count > 0) navigator.setAppBadge(count).catch(() => {});
            else navigator.clearAppBadge?.().catch(() => {});
        }
        navigator.serviceWorker?.ready
            .then((registration) => {
                registration.active?.postMessage({ type: 'GS_BADGE_COUNT', count });
            })
            .catch(() => {});
        try { localStorage.setItem('gscom_badge_count', JSON.stringify({ count, label: formatBadge(count), at: Date.now() })); } catch {}
    }, [unreadCount]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const previous = previousUnreadRef.current;
        previousUnreadRef.current = unreadCount;
        if (!settings.notifications || unreadCount <= previous || unreadCount <= 0) return;
        if (document.visibilityState === 'visible') return;
        window.dispatchEvent(new CustomEvent('gs-notification', {
            detail: {
                title: 'New GS activity',
                body: `You have ${formatBadge(unreadCount)} unread message${unreadCount === 1 ? '' : 's'} or alert${unreadCount === 1 ? '' : 's'}.`,
                count: unreadCount,
            },
        }));
    }, [unreadCount, settings.notifications]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleNotification = async (e) => {
            if (!settings.notifications) return;
            const { title, body, image, icon, count } = e.detail || {};
            if (!title) return;
            if (document.visibilityState === 'visible') return;

            const badgeCount = Math.min(99, Number(count || unreadCount || 1));
            const nativeNotifications = await getNativeNotifications();
            if (nativeNotifications) {
                const perm = await nativeNotifications.checkPermissions().catch(() => ({ display: 'prompt' }));
                if (perm.display === 'granted') {
                    await nativeNotifications.schedule({
                        notifications: [{
                            id: Math.floor(Date.now() % 2147483647),
                            title,
                            body: body || '',
                            largeIcon: icon || '/icons/icon-192.png',
                            iconColor: '#0F766E',
                            extra: { url: '/alerts', count: badgeCount, label: formatBadge(badgeCount) },
                        }],
                    }).catch(() => {});
                    return;
                }
            }

            if (!('Notification' in window) || Notification.permission !== 'granted') return;
            const options = {
                body: body || '',
                icon: icon || '/icons/icon-192.png',
                badge: '/icons/icon-192.png',
                image: image || undefined,
                tag: 'gs-account-update',
                renotify: true,
                vibrate: [160, 80, 160],
                silent: false,
                data: { url: '/alerts', count: badgeCount, label: formatBadge(badgeCount) },
            };

            try {
                const reg = await navigator.serviceWorker?.ready;
                if (reg?.showNotification) {
                    await reg.showNotification(title, options);
                    return;
                }
                const notification = new Notification(title, options);
                notification.onclick = () => {
                    window.focus();
                    notification.close();
                };
                setTimeout(() => notification.close(), 8000);
            } catch {}
        };

        window.addEventListener('gs-notification', handleNotification);
        return () => window.removeEventListener('gs-notification', handleNotification);
    }, [settings.notifications, unreadCount]);

    if (!askNotifications || onImmersiveScreen) return null;

    return (
        <PermissionSheet
            permission="notifications"
            onResolved={(result) => {
                setAskNotifications(false);
                const granted = Boolean(result?.ok);
                permissionRef.current = granted ? 'granted' : 'default';
                updateSettings?.({ notificationPermission: granted ? 'granted' : 'default' });
                if (granted) registerPushSubscription();
            }}
            onClose={() => setAskNotifications(false)}
        />
    );
}

