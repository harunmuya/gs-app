'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, RefreshCw } from '@/components/icons';

/**
 * Connectivity banner.
 *
 * Replaces a full-page offline takeover with the pattern messaging apps use: a
 * slim bar that appears only when the connection is genuinely gone, and clears
 * itself the moment it returns.
 *
 * Why not just `navigator.onLine`
 * -------------------------------
 * It reports whether the device has a network interface, not whether that
 * interface reaches anything. On mobile data it stays true through dead spots,
 * captive portals, and exhausted data bundles — which is exactly when a member
 * needs to be told something is wrong. And it flickers false during tower
 * handovers while the connection is perfectly usable.
 *
 * So `onLine === false` is trusted immediately (the device is certain), but
 * `onLine === true` is verified with a real request to our own origin before the
 * banner is dismissed, and a single failure is confirmed by a second probe before
 * the banner is shown. That two-strike rule is what stops a brief mobile-data
 * stall from being reported as an outage.
 */

// A 204 with no database work. The service worker leaves this path alone so a
// real network failure rejects instead of resolving to a synthetic response.
const PROBE_URL = '/api/ping';
const PROBE_TIMEOUT_MS = 5000;
const RECHECK_WHILE_OFFLINE_MS = 5000;
const RECHECK_WHILE_ONLINE_MS = 30000;
/**
 * After a first failed probe, confirm quickly rather than waiting for the next
 * scheduled poll. Without this a genuinely offline member could sit for ~30s with
 * no indication, because the first failure only counts one strike and the routine
 * poll is half a minute away. Two strikes 1.5s apart still filters out a single
 * stalled request while keeping detection in the couple-of-seconds range.
 */
const CONFIRM_FAILURE_MS = 1500;
/** Below this, an outage was never really visible, so no reconnection notice. */
const MIN_OUTAGE_TO_ANNOUNCE_MS = 2000;

async function probe() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
        const res = await fetch(`${PROBE_URL}?t=${Date.now()}`, {
            method: 'GET',
            cache: 'no-store',
            signal: controller.signal,
        });
        // Any answer at all — including a server error — proves the network works.
        // Only a rejected request means we could not reach anything.
        return Boolean(res);
    } catch {
        return false;
    } finally {
        clearTimeout(timer);
    }
}

export default function ConnectionStatus() {
    const [offline, setOffline] = useState(false);
    const [checking, setChecking] = useState(false);
    const [justReconnected, setJustReconnected] = useState(false);
    const strikes = useRef(0);
    const timerRef = useRef(null);
    const confirmRef = useRef(null);
    const offlineSince = useRef(0);
    const mounted = useRef(true);

    const evaluate = useCallback(async ({ manual = false } = {}) => {
        if (manual) setChecking(true);

        // The device is certain when it says there is no interface at all.
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            strikes.current = 2;
            if (!offlineSince.current) offlineSince.current = Date.now();
            if (mounted.current) {
                setOffline(true);
                setChecking(false);
            }
            return;
        }

        const reachable = await probe();
        if (!mounted.current) return;

        if (reachable) {
            // Only celebrate a reconnection the member actually noticed. A device
            // can report "offline" for a moment while the connection is fine — the
            // verification here corrects that within a second, and flashing "Back
            // online" for an outage nobody experienced is just noise.
            const outageMs = offlineSince.current ? Date.now() - offlineSince.current : 0;
            const wasOffline = strikes.current >= 2 && outageMs >= MIN_OUTAGE_TO_ANNOUNCE_MS;
            strikes.current = 0;
            offlineSince.current = 0;
            setOffline(false);
            if (wasOffline) {
                setJustReconnected(true);
                setTimeout(() => mounted.current && setJustReconnected(false), 2500);
            }
        } else {
            // Two consecutive failures before claiming an outage, so one stalled
            // request on a weak signal does not raise the banner.
            strikes.current += 1;
            if (strikes.current >= 2) {
                if (!offlineSince.current) offlineSince.current = Date.now();
                setOffline(true);
            } else {
                clearTimeout(confirmRef.current);
                confirmRef.current = setTimeout(() => {
                    if (mounted.current) evaluateRef.current?.();
                }, CONFIRM_FAILURE_MS);
            }
        }

        if (manual) setChecking(false);
    }, []);

    // Lets the confirmation timer call the latest evaluate without making it a
    // dependency of itself.
    const evaluateRef = useRef(evaluate);
    useEffect(() => { evaluateRef.current = evaluate; }, [evaluate]);

    // The poll interval depends on whether we are currently offline, but this must
    // not go in the effect's dependency array. Doing so re-ran the effect whenever
    // the state changed, and the effect body calls evaluate() — so going offline
    // immediately triggered a fresh probe that cleared the banner again. Reading
    // the value from a ref keeps the effect mount-only.
    const offlineRef = useRef(false);
    useEffect(() => { offlineRef.current = offline; }, [offline]);

    useEffect(() => {
        mounted.current = true;

        function schedule() {
            clearTimeout(timerRef.current);
            timerRef.current = setTimeout(async () => {
                if (document.visibilityState === 'visible') await evaluate();
                if (mounted.current) schedule();
            }, offlineRef.current ? RECHECK_WHILE_OFFLINE_MS : RECHECK_WHILE_ONLINE_MS);
        }

        function onOnline() { strikes.current = 1; evaluate(); }
        function onOffline() {
            strikes.current = 2;
            if (!offlineSince.current) offlineSince.current = Date.now();
            setOffline(true);
        }
        function onVisible() { if (document.visibilityState === 'visible') evaluate(); }

        /**
         * The service worker reports the outcome of real API traffic. A failure it
         * has already observed counts as the first strike, so the verification
         * probe that follows is the second — detection lands in about a second
         * instead of waiting for the routine poll.
         */
        function onWorkerMessage(event) {
            const type = event.data?.type;
            if (type === 'GS_NETWORK_LOST') {
                strikes.current = Math.max(strikes.current, 1);
                evaluate();
            } else if (type === 'GS_NETWORK_OK' && offlineRef.current) {
                evaluate();
            }
        }

        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);
        document.addEventListener('visibilitychange', onVisible);
        navigator.serviceWorker?.addEventListener('message', onWorkerMessage);
        // Required. When a page listens with addEventListener rather than by
        // assigning onmessage, service worker messages stay queued until delivery
        // is explicitly started. Without this the worker's GS_NETWORK_LOST notice
        // never arrives and detection silently falls back to the slow poll.
        navigator.serviceWorker?.startMessages?.();
        evaluate();
        schedule();

        return () => {
            mounted.current = false;
            clearTimeout(timerRef.current);
            clearTimeout(confirmRef.current);
            window.removeEventListener('online', onOnline);
            window.removeEventListener('offline', onOffline);
            document.removeEventListener('visibilitychange', onVisible);
            navigator.serviceWorker?.removeEventListener('message', onWorkerMessage);
        };
    }, [evaluate]);

    if (!offline && !justReconnected) return null;

    const reconnected = !offline && justReconnected;

    return (
        <div
            role="status"
            aria-live="polite"
            className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 px-4 py-2 type-caption font-semibold text-white"
            style={{
                background: reconnected ? 'var(--color-success)' : '#3A3340',
                paddingTop: 'calc(0.5rem + env(safe-area-inset-top))',
            }}
        >
            {reconnected ? (
                <span>Back online</span>
            ) : (
                <>
                    <span>No internet connection</span>
                    <button
                        type="button"
                        onClick={() => evaluate({ manual: true })}
                        disabled={checking}
                        className="inline-flex min-h-[28px] items-center gap-1 rounded-full px-2.5 type-caption font-semibold disabled:opacity-60"
                        style={{ background: 'rgba(255,255,255,0.16)' }}
                    >
                        {checking
                            ? <Loader2 size={12} className="animate-spin" />
                            : <RefreshCw size={12} />}
                        {checking ? 'Checking' : 'Retry'}
                    </button>
                </>
            )}
        </div>
    );
}
