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
 *
 * Three things this got wrong, all of which told paying members they were on
 * the free tier:
 *
 *   A failed lookup was cached exactly like a successful one. One 401 during a
 *   cold start, or any blip, and every screen for the rest of the session read
 *   the free set from cache. A Silver member was told to upgrade to go live and
 *   nothing short of a full reload would change its mind.
 *
 *   The cache never expired, so an admin moving somebody onto Silver did not
 *   reach them at all. From the member's side the package looked like it had
 *   been applied and then vanished.
 *
 *   It was not keyed by member, so it survived an account switch.
 */

const EMPTY_FEATURES = {
    messages: true, phone: false, calls: false, voiceNotes: false, images: false,
    gifs: false, live: false, gifts: false, nearby: false, whoLiked: false,
    whoViewed: false, priorityVisibility: false, international: false,
};

const FREE_STATE = { loading: false, tierId: 'free', features: EMPTY_FEATURES, dailyLimits: {} };

/*
  How long a good answer is trusted.

  Short enough that an admin granting a package shows up while the member is
  still looking at the screen, long enough that mounting six components does not
  mean six requests. Entitlements change rarely, but when they change somebody
  is usually waiting for it.
*/
const TTL_MS = 60_000;

let cache = null;          // { userId, at, value }
let inFlight = null;
const subscribers = new Set();

function publish(userId, value, { remember = true } = {}) {
    /*
      A failure is reported but never remembered.

      Reporting the free set is right: offering a control that then errors is
      worse than not offering it. Remembering it is not, because the next mount
      would read the failure back out of cache instead of retrying, and the
      member stays locked out of what they paid for until they reload.
    */
    cache = remember ? { userId, at: Date.now(), value } : null;
    subscribers.forEach((fn) => fn(value));
}

function fresh(userId) {
    if (!cache || cache.userId !== userId) return null;
    if (Date.now() - cache.at > TTL_MS) return null;
    return cache.value;
}

async function load(userId) {
    if (inFlight) return inFlight;
    inFlight = (async () => {
        try {
            const res = await fetch('/api/v1/entitlements', { cache: 'no-store' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.entitlement) {
                publish(userId, FREE_STATE, { remember: false });
                return;
            }
            publish(userId, {
                loading: false,
                tierId: data.entitlement.tierId || 'free',
                features: { ...EMPTY_FEATURES, ...(data.entitlement.features || {}) },
                dailyLimits: data.entitlement.dailyLimits || {},
            });
        } catch {
            publish(userId, FREE_STATE, { remember: false });
        } finally {
            inFlight = null;
        }
    })();
    return inFlight;
}

/** Drop the cached answer — call after a package is activated. */
export function refreshEntitlements() {
    // Read the member before dropping the cache, not after; the cache is the
    // only thing that knows who this is.
    const userId = cache?.userId;
    cache = null;
    return load(userId);
}

export function useEntitlements(userId) {
    const [state, setState] = useState(() => fresh(userId) || { ...FREE_STATE, loading: true });

    useEffect(() => {
        if (!userId) {
            setState(FREE_STATE);
            return undefined;
        }

        subscribers.add(setState);
        const known = fresh(userId);
        if (known) setState(known);
        else load(userId);

        /*
          Re-check when the member comes back to the tab.

          This is the path that matters after an admin grants a package: they
          are usually told on the phone, switch back to the app, and expect it
          to be there. Without this they would have to close and reopen it.
        */
        const onVisible = () => {
            if (document.visibilityState === 'visible' && !fresh(userId)) load(userId);
        };
        document.addEventListener('visibilitychange', onVisible);

        return () => {
            subscribers.delete(setState);
            document.removeEventListener('visibilitychange', onVisible);
        };
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
