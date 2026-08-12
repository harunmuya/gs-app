'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { resolvePlaceName } from '@/lib/placeName';
import PermissionSheet from '@/components/PermissionSheet';
import { permissionState, wasDismissed } from '@/lib/permissions';

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
    const [askLocation, setAskLocation] = useState(false);

    // Everything below needs the member id, so it lives at component scope
    // rather than being rebuilt inside the effect and reached for with refs.
    const useIpFallback = useCallback(async () => {
        if (!user?.id) return;
        try {
            const saved = await saveLocation({ action: 'ip_fallback', userId: user.id });
            updateStoredUser({ ...saved, source: 'ip' });
            window.dispatchEvent(new CustomEvent('gs-location-updated', { detail: { source: 'ip', location: saved } }));
        } catch {
            window.dispatchEvent(new CustomEvent('gs-location-failed'));
        }
    }, [user?.id]);

    // Stores a fix that has already been read, from wherever it came from.
    const storeCoords = useCallback(async (coords) => {
        if (!user?.id || !coords) return;
        const label = await resolvePlaceName(coords.latitude, coords.longitude);
        const payload = {
            userId: user.id,
            source: 'device',
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy ?? null,
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
    }, [user?.id, useIpFallback]);

    // Reads a fresh fix. Only ever called once the OS has agreed, either
    // because it already had, or because the sheet has just asked.
    const readPosition = useCallback(({ precise = true } = {}) => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) return;
        inFlight.current = true;
        navigator.geolocation.getCurrentPosition(
            (position) => storeCoords(position.coords),
            async () => { await useIpFallback(); inFlight.current = false; },
            {
                // Whatever the member chose in the sheet, not what we prefer.
                enableHighAccuracy: precise,
                timeout: 15000,
                maximumAge: 60 * 1000,
            },
        );
    }, [storeCoords, useIpFallback]);

    /*
      Explain, then ask.

      This ran `getCurrentPosition` the moment a member landed on Discover, so
      the browser's location dialog appeared over a screen they had not read
      yet, from an app that had never said what it wanted their location for. A
      denial there is sticky: the browser stops asking, Nearby stops working,
      and every distance on every card disappears, with no way back except the
      site settings panel. That is a lot to lose to a reflex.

      The sheet comes first now, and it offers approximate or precise rather
      than silently demanding GPS. A member who has already granted it sees
      nothing, and one who has already blocked it gets the IP estimate quietly
      instead of a dialog that can no longer appear.
    */
    useEffect(() => {
        if (!user?.id || !shouldRunForPath(pathname) || inFlight.current) return;
        const now = Date.now();
        const last = Number(localStorage.getItem(LAST_REQUEST_KEY) || 0);
        if (now - last < 2 * 60 * 1000) return;
        localStorage.setItem(LAST_REQUEST_KEY, String(now));

        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            useIpFallback();
            return;
        }

        (async () => {
            const state = await permissionState('location');

            // Already blocked. The dialog would never appear, so do not pretend.
            if (state === 'denied') {
                await useIpFallback();
                return;
            }

            // Already granted. Nothing to explain; just read it.
            if (state === 'granted') {
                readPosition();
                return;
            }

            // 'prompt' or 'unknown'. Explain first; the sheet does the asking.
            if (wasDismissed('location')) {
                await useIpFallback();
                return;
            }
            setAskLocation(true);
        })();
    }, [pathname, user?.id, readPosition, useIpFallback]);

    if (!askLocation) return null;

    return (
        <PermissionSheet
            permission="location"
            onResolved={(result) => {
                setAskLocation(false);
                /*
                  The sheet read a position to prove the grant, so the fix is
                  already in hand. Using it avoids a second GPS lock, which on a
                  phone is several seconds and a visible battery cost for an
                  answer that has just been given.
                */
                if (result?.ok && result.coords) { storeCoords(result.coords); return; }
                if (result?.ok) { readPosition({ precise: result.precise !== false }); return; }
                useIpFallback();
            }}
            onClose={() => {
                setAskLocation(false);
                // Declining is a real answer. Fall back to the IP estimate so
                // distances still work rather than leaving the field empty.
                useIpFallback();
            }}
        />
    );
}
