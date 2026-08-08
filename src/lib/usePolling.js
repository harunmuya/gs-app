'use client';

import { useEffect, useRef } from 'react';

/**
 * Polling that stops when nobody is looking.
 *
 * The app had eleven independent setInterval loops, five of them mounted on
 * every browsing screen, none of them aware of whether the tab was visible or
 * the member was still there. An idle tab generated roughly 2,100 requests an
 * hour doing nothing — enough to burn the entire 1,000,000/month Vercel free
 * tier in about 475 tab-hours, which is what happened.
 *
 * Three rules, in order of how much they save:
 *
 *   1. A hidden tab does not poll at all. Nothing it fetches can be seen, and a
 *      backgrounded tab can sit open for days.
 *   2. After `idleAfterMs` without a pointer, key or scroll event the interval
 *      stretches by `idleFactor`. Someone reading one profile for ten minutes
 *      does not need the boosted-members strip refreshed twenty times.
 *   3. Anything that changes on a human timescale gets a human interval. A
 *      "boosted members" strip was refetching every 30 seconds; it changes daily.
 *
 * Coming back — tab focus, or any interaction after idle — fetches immediately
 * rather than waiting out the timer, so the pause is invisible in use.
 *
 * What this deliberately does NOT do is make things less live. Incoming calls
 * still need sub-5-second latency; the answer there is Supabase Realtime, whose
 * websocket goes straight to Supabase and costs no edge requests at all. See
 * `realtimeActive` below.
 */

const INTERACTION_EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart'];

export function usePolling(callback, {
    interval,
    enabled = true,
    idleAfterMs = 120_000,
    idleFactor = 4,
    maxIntervalMs = 600_000,
    // When a realtime subscription is carrying the updates, this poll is only a
    // safety net and can run far slower.
    realtimeActive = false,
    realtimeFactor = 10,
    immediate = true,
} = {}) {
    const savedCallback = useRef(callback);
    savedCallback.current = callback;

    const lastInteraction = useRef(Date.now());

    useEffect(() => {
        if (!enabled || !interval) return undefined;

        let timer = null;
        let stopped = false;

        function markInteraction() {
            const wasIdle = Date.now() - lastInteraction.current > idleAfterMs;
            lastInteraction.current = Date.now();
            // Returning from idle should feel instant, not "up to N seconds".
            if (wasIdle && document.visibilityState === 'visible') run(true);
        }

        function currentDelay() {
            let delay = interval;
            if (realtimeActive) delay *= realtimeFactor;
            if (Date.now() - lastInteraction.current > idleAfterMs) delay *= idleFactor;
            return Math.min(delay, maxIntervalMs);
        }

        function schedule() {
            if (stopped) return;
            if (timer) window.clearTimeout(timer);
            timer = window.setTimeout(() => run(false), currentDelay());
        }

        async function run(force) {
            if (stopped) return;
            // The core saving: a hidden tab performs no work and schedules
            // nothing. visibilitychange restarts it.
            if (!force && document.visibilityState === 'hidden') return;
            try {
                await savedCallback.current();
            } catch {
                // A failed poll is not fatal; the next one covers it.
            }
            schedule();
        }

        function onVisibility() {
            if (document.visibilityState === 'visible') run(true);
            else if (timer) window.clearTimeout(timer);
        }

        if (immediate) run(true);
        else schedule();

        document.addEventListener('visibilitychange', onVisibility);
        INTERACTION_EVENTS.forEach((e) => window.addEventListener(e, markInteraction, { passive: true }));

        return () => {
            stopped = true;
            if (timer) window.clearTimeout(timer);
            document.removeEventListener('visibilitychange', onVisibility);
            INTERACTION_EVENTS.forEach((e) => window.removeEventListener(e, markInteraction));
        };
    }, [enabled, interval, idleAfterMs, idleFactor, maxIntervalMs, realtimeActive, realtimeFactor, immediate]);
}

/**
 * Intervals, in one place.
 *
 * Named so the reason for each is visible at the call site. The previous values
 * are recorded because several were three orders of magnitude faster than the
 * data they were fetching actually changes.
 */
export const POLL = {
    /** Ringing calls, with no Realtime. Was 3s — the app's largest single cost. */
    incomingCalls: 6_000,
    /** Ringing calls once the websocket is confirmed carrying them. */
    incomingCallsRealtime: 60_000,
    /** Session and package state. Was 10s; it changes when an admin acts. */
    account: 60_000,
    /** Conversation list. Was 5s. */
    messageList: 15_000,
    /** Who is live. Was 15s. */
    liveStrip: 45_000,
    /** Stories are 24h objects. Was 20s. */
    stories: 120_000,
    /** Boosts last 24 hours. Was 30s. */
    boosted: 300_000,
    /** Inside a live room, where latency is actually visible. */
    liveRoom: 2_500,
    /** The host's own keepalive; the server sweeps at 90s. */
    liveHeartbeat: 25_000,
};
