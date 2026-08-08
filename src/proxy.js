import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Refreshes the Supabase auth session on every matched request and writes the
 * rotated tokens back onto the response.
 *
 * Without this, access tokens expire in the background and users are silently
 * signed out mid-session. Route handlers read the refreshed cookies via
 * `createRouteClient()` in `@/lib/authSession`.
 *
 * This does not authorize anything. Authorization belongs in the route handlers,
 * where the resource being accessed is known.
 *
 * Formerly `src/middleware.js`. Next.js 16 deprecated the `middleware` file
 * convention in favour of `proxy`, which renames both the file and the exported
 * function. Behaviour and the request/response API are unchanged.
 */
export async function proxy(request) {
    let response = NextResponse.next({ request: { headers: request.headers } });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!url || !anonKey) return response;

    const supabase = createServerClient(url, anonKey, {
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value }) => {
                    request.cookies.set(name, value);
                });
                response = NextResponse.next({ request: { headers: request.headers } });
                cookiesToSet.forEach(({ name, value, options }) => {
                    response.cookies.set(name, value, options);
                });
            },
        },
    });

    // Triggers the refresh and the cookie writes above. Errors are non-fatal:
    // an unauthenticated request should still reach the route, which decides.
    try {
        await supabase.auth.getUser();
    } catch {
        // ignore
    }

    return response;
}

export const config = {
    matcher: [
        /*
         * Everything except static assets and image files. Seed photography under
         * /seed is large and heavily requested — keeping it out of the matcher
         * avoids running auth refresh on tens of thousands of image requests.
         *
         * api/ping is excluded too: every client polls it for connectivity, and
         * refreshing a session on each poll would mean a Supabase auth call every
         * 30 seconds per user for a request that returns an empty 204.
         */
        '/((?!_next/static|_next/image|favicon.ico|api/ping|seed/|gifts/|icons/|downloads/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|apk)$).*)',
    ],
};
