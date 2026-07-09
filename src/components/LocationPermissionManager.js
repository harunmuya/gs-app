'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { labelFromCoordinates } from '@/lib/geo';

const ACTIVE_PATHS = ['/discover', '/matches', '/members', '/profile', '/live'];
const LAST_REQUEST_KEY = 'gsk_location_request_last';
const USER_KEY = 'gscom_user';
const LIVE_LOCATION_KEY = 'gscom_live_location';

function shouldRunForPath(pathname = '') {
    return ACTIVE_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function updateStoredUser(location) {
    if (typeof window === 'undefined' || !location?.latitude || !location?.longitude) return;
    try {
        localStorage.setItem(LIVE_LOCATION_KEY, JSON.stringify({
            lat: location.latitude,
            lng: location.longitude,
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy || null,
            city: location.city || location.location || '',
            source: location.source || 'device',
            timestamp: Date.now(),
        }));
        const user = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
        if (user?.id) {
            const nextUser = {
                ...user,
                latitude: location.latitude,
                longitude: location.longitude,
                geo_updated_at: location.geo_updated_at || new Date().toISOString(),
                location: location.city || location.location || user.location,
                city: location.city || location.location || user.city,
            };
            localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
        }
    } catch {}
}

async function saveLocation(payload) {
    const res = await fetch('/api/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Location could not be saved.');
    return data.location || null;
}

export default function LocationPermissionManager() {
    const pathname = usePathname();
    const { user } = useAuth();
    const inFlight = useRef(false);

    useEffect(() => {
        if (!user?.id || !shouldRunForPath(pathname) || inFlight.current) return;
        const now = Date.now();
        const last = Number(localStorage.getItem(LAST_REQUEST_KEY) || 0);
        if (now - last < 2 * 60 * 1000) return;
        localStorage.setItem(LAST_REQUEST_KEY, String(now));
        inFlight.current = true;

        async function useIpFallback() {
            try {
                const saved = await saveLocation({ action: 'ip_fallback', userId: user.id });
                updateStoredUser({ ...saved, source: 'ip' });
                window.dispatchEvent(new CustomEvent('gs-location-updated', { detail: { source: 'ip', location: saved } }));
            } catch {
                window.dispatchEvent(new CustomEvent('gs-location-failed'));
            }
        }

        if (!navigator.geolocation) {
            useIpFallback().finally(() => { inFlight.current = false; });
            return;
        }

        navigator.geolocation.getCurrentPosition(async (position) => {
            const label = labelFromCoordinates(position.coords.latitude, position.coords.longitude);
            const payload = {
                userId: user.id,
                source: 'device',
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                geo_updated_at: new Date().toISOString(),
                city: label,
                location: label,
            };
            try {
                const saved = await saveLocation(payload);
                updateStoredUser({ ...payload, ...(saved || {}) });
                window.dispatchEvent(new CustomEvent('gs-location-updated', { detail: { source: 'device', location: saved || payload } }));
            } catch {
                await useIpFallback();
            } finally {
                inFlight.current = false;
            }
        }, async () => {
            await useIpFallback();
            inFlight.current = false;
        }, {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 60 * 1000,
        });
    }, [pathname, user?.id]);

    return null;
}
