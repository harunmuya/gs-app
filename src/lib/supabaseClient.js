import { createBrowserClient } from '@supabase/ssr';

let browserClient;

export function getSupabaseConfig() {
    return {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    };
}

export function isSupabaseConfigured() {
    const { url, anonKey } = getSupabaseConfig();
    return Boolean(url && anonKey);
}

/**
 * The browser client, reading the same session the server wrote.
 *
 * This used to be `createClient` from supabase-js, which keeps its session in
 * local storage. Sign in happens in a route handler using @supabase/ssr, which
 * writes the session to cookies. So there were two stores and only one of them
 * ever had anything in it: the browser client had never held a session in its
 * life, because nothing returns tokens to the client and nothing calls
 * setSession.
 *
 * Every `auth.refreshSession()` in the app was therefore a no-op that resolved
 * with no session. That is not a harmless dead call. The heartbeat treats a
 * failed refresh as proof the member is signed out and calls signOut, so a
 * single 401 from any cause would sign somebody out who was perfectly fine, and
 * the recovery added to the messages screen could only ever report "your
 * session has ended" no matter how healthy the session was.
 *
 * createBrowserClient reads and writes the same cookies as createServerClient,
 * so client and server now share one session. Refresh works because there is
 * finally something to refresh, and Realtime connects as the signed-in member
 * rather than anonymously, which matters now that RLS denies anon by default.
 *
 * This only works because @supabase/ssr writes its cookies with httpOnly
 * false. If that ever changes, the browser cannot see them and this has to go
 * back to being fed tokens explicitly.
 */
export function createBrowserSupabaseClient() {
    const { url, anonKey } = getSupabaseConfig();

    if (!url || !anonKey) {
        throw new Error('Supabase public environment variables are not configured.');
    }

    if (!browserClient) {
        browserClient = createBrowserClient(url, anonKey);
    }

    return browserClient;
}
