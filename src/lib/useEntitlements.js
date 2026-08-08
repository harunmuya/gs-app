'use client';

import { useEffect, useState } from 'react';

/**
 * The signed-in member's entitlements, as the server computes them.
 *
 * Screens used to guess at access by reading `user.subscription_tier` straight
 * from the profile. That is the *requested* tier, not the effective one — it
 * ignores admin approval, a locked package and an expired one, so a member whose
 * package had lapsed still saw Go Live and a call button, pressed them, and got
 * a 402. /api/v1/entitlements applies all three rules, so it is the only honest
 * answer to "can this member do X".
 *
 * This is presentation only. Every gate here is enforced again server-side; the
 * point is to not offer a control that is going to fail.
 *
 * One in-flight request is shared across all subscribers — the members grid,
 * the live page and the stories composer all mount at once, and three identical
 * round trips per navigation is waste.
 */

const EMPTY_FEATURES = {
    messages: true, phone: false, calls: false, voiceNotes: false, images: false,
    gifs: false, live: false, gifts: false, nearby: false, whoLiked: false,
    whoViewed: false, priorityVisibility: false, international: false,
};

let cache = null;
let inFlight = null;
const subscribers = new Set();

function publish(value) {
    cache = value;
    subscribers.forEach((fn) => fn(value));
}

async function load() {
    if (inFlight) return inFlight;
    inFlight = (async () => {
        try {
            const res = await fetch('/api/v1/entitlements', { cache: 'no-store' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.entitlement) {
                // Signed out, restricted, or the request failed. Report the free
                // set rather than an optimistic one: showing a control that then
                // errors is worse than not showing it.
                publish({ loading: false, tierId: 'free', features: EMPTY_FEATURES, dailyLimits: {} });
                return;
            }
            publish({
                loading: false,
                tierId: data.entitlement.tierId || 'free',
                features: { ...EMPTY_FEATURES, ...(data.entitlement.features || {}) },
                dailyLimits: data.entitlement.dailyLimits || {},
            });
        } catch {
            publish({ loading: false, tierId: 'free', features: EMPTY_FEATURES, dailyLimits: {} });
        } finally {
            inFlight = null;
        }
    })();
    return inFlight;
}

/** Drop the cached answer — call after a package is activated. */
export function refreshEntitlements() {
    cache = null;
    return load();
}

export function useEntitlements(userId) {
    const [state, setState] = useState(cache || { loading: true, tierId: 'free', features: EMPTY_FEATURES, dailyLimits: {} });

    useEffect(() => {
        if (!userId) {
            setState({ loading: false, tierId: 'free', features: EMPTY_FEATURES, dailyLimits: {} });
            return undefined;
        }
        subscribers.add(setState);
        if (cache) setState(cache);
        else load();
        return () => { subscribers.delete(setState); };
    }, [userId]);

    return state;
}

/**
 * Reset on sign-out or account switch, so the next member does not inherit the
 * previous one's access.
 */
export function clearEntitlements() {
    cache = null;
    inFlight = null;
}
