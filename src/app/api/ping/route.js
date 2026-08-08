/**
 * Connectivity probe.
 *
 * Deliberately the cheapest possible endpoint: no database, no auth, no body.
 * The client polls this to tell "genuinely offline" apart from "device claims a
 * network but nothing is reachable", which `navigator.onLine` cannot do.
 *
 * Why not reuse /api/v1/health: that runs two `count` queries against Supabase on
 * every call. Polling it from every client every 30 seconds would generate
 * continuous database load for no diagnostic value, and it also reports env and
 * table readability, which is not information an anonymous caller needs.
 *
 * The service worker deliberately does NOT intercept this path. If it applied its
 * usual API fallback, an offline request would receive a synthetic 503 Response
 * instead of rejecting, and the probe would read that as a working connection.
 */

export const dynamic = 'force-dynamic';

export async function GET() {
    return new Response(null, {
        status: 204,
        headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
    });
}

export async function HEAD() {
    return new Response(null, {
        status: 204,
        headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
    });
}
