'use client';

import { createBrowserSupabaseClient, isSupabaseConfigured } from '@/lib/supabaseClient';

/**
 * A fetch that does not tell a signed-in member to sign in.
 *
 * The app holds two ideas of being signed in: the user object in local storage,
 * which is what the interface renders from, and the Supabase Auth cookie, which
 * is what every route handler checks. They can disagree. The access token
 * expires on its own schedule, and members who were signed in before the auth
 * cutover have local state and no cookie at all.
 *
 * When they disagree the member sees a screen that knows their name printing
 * "Sign in to continue" at them, which is the single most alarming thing an app
 * can say to somebody who is already signed in. That is what the messages list
 * was doing: the route returned 401, the screen put the message straight into
 * its error banner, and there it stayed.
 *
 * Recovery already existed but only on the heartbeat, so a screen that failed
 * had to wait for a background loop to notice. Every screen can do it now: on a
 * 401, refresh the session once and try again. Almost always the refresh token
 * is still good and the retry succeeds, and the member never learns anything
 * happened.
 *
 * A second 401 is a real signed-out state. It is reported as such rather than
 * retried forever, because a loop that keeps retrying a genuinely dead session
 * is worse than an honest message.
 */

/** Shared across callers so a burst of screens cannot each fire their own refresh. */
let refreshInFlight = null;

async function refreshSessionOnce() {
    if (!isSupabaseConfigured()) return false;
    if (!refreshInFlight) {
        refreshInFlight = (async () => {
            try {
                const { data } = await createBrowserSupabaseClient().auth.refreshSession();
                return Boolean(data?.session);
            } catch {
                return false;
            } finally {
                // Cleared on the next tick so concurrent callers share this result
                // and the one after starts fresh.
                setTimeout(() => { refreshInFlight = null; }, 0);
            }
        })();
    }
    return refreshInFlight;
}

/**
 * Fetch, and recover once from an expired session.
 *
 * Returns the Response. `res.sessionExpired` is true when the session is
 * genuinely gone, so a caller can send the member to sign in rather than
 * printing an authentication error into a page they are already using.
 */
export async function apiFetch(input, init = {}) {
    const first = await fetch(input, init);
    if (first.status !== 401) return first;

    const refreshed = await refreshSessionOnce();
    if (!refreshed) {
        first.sessionExpired = true;
        return first;
    }

    const second = await fetch(input, init);
    if (second.status === 401) second.sessionExpired = true;
    return second;
}
