import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseAdmin';
import { requireMember } from '@/lib/authSession';
import { labelFromCoordinates } from '@/lib/geo';

function jsonError(message, status = 500) {
    return NextResponse.json({ error: message }, { status });
}

function clientIp(request) {
    const forwarded = request.headers.get('x-forwarded-for') || '';
    const ip = forwarded.split(',')[0]?.trim()
        || request.headers.get('x-real-ip')
        || request.headers.get('cf-connecting-ip')
        || '';
    if (!ip || ip === '::1' || ip.startsWith('127.') || ip.startsWith('10.') || ip.startsWith('192.168.')) return '';
    return ip;
}

async function ipLocation(request) {
    const ip = clientIp(request);
    const url = ip ? `https://ipapi.co/${encodeURIComponent(ip)}/json/` : 'https://ipapi.co/json/';
    try {
        const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(3500) });
        const data = await res.json().catch(() => ({}));
        const latitude = Number(data.latitude);
        const longitude = Number(data.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
        return {
            latitude,
            longitude,
            accuracy: 25000,
            source: 'ip',
            city: [data.city, data.region, data.country_name].filter(Boolean).join(', '),
            ip: ip || data.ip || '',
        };
    } catch {
        return null;
    }
}

async function saveLocation(supabase, userId, location) {
    const latitude = Number(location.latitude);
    const longitude = Number(location.longitude);
    if (!userId) return { error: { message: 'User id is required.' } };
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return { error: { message: 'Valid latitude and longitude are required.' } };
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return { error: { message: 'Invalid coordinates.' } };

    const now = new Date().toISOString();
    // Prefer a name the caller already resolved; otherwise reverse geocode properly
    // and only then fall back to the offline table.
    const resolved = (location.city || location.location)
        ? String(location.city || location.location)
        : (await reverseGeocode(latitude, longitude))?.label || labelFromCoordinates(latitude, longitude) || '';
    const label = String(resolved).slice(0, 120);
    const fullPatch = {
        latitude,
        longitude,
        geo_updated_at: now,
        location_enabled: true,
        live_location: location.source !== 'ip',
        location_accuracy_m: Number.isFinite(Number(location.accuracy)) ? Math.round(Number(location.accuracy)) : null,
        location_source: String(location.source || 'device').slice(0, 40),
        ...(label ? { location: label, city: label } : {}),
    };
    let result = await supabase
        .from('users')
        .update(fullPatch)
        .eq('id', userId)
        .select('id, latitude, longitude, geo_updated_at, location, city')
        .maybeSingle();

    if (result.error && ['42703', 'PGRST204'].includes(result.error.code)) {
        const fallbackPatch = {
            latitude,
            longitude,
            geo_updated_at: now,
            ...(label ? { location: label, city: label } : {}),
        };
        result = await supabase
            .from('users')
            .update(fallbackPatch)
            .eq('id', userId)
            .select('id, latitude, longitude, geo_updated_at, location, city')
            .maybeSingle();
    }
    return result;
}

/**
 * Turn coordinates into a real place name.
 *
 * The previous behaviour picked the nearest of 31 hardcoded towns, so anyone
 * outside those was given a place that could be a hundred kilometres away. This
 * calls a reverse-geocoding service that knows actual localities, and only falls
 * back to the offline table when the service is unavailable.
 *
 * Runs server-side for three reasons: the browser's Content-Security-Policy does
 * not need widening, the upstream host is not exposed to the client, and the
 * result can be cached at the edge.
 *
 * Precision is deliberately limited to the locality/city level. A dating profile
 * needs "Westlands, Nairobi", not a street address, and coarser data is the safer
 * default for members.
 */
async function reverseGeocode(latitude, longitude) {
    const url = 'https://api.bigdatacloud.net/data/reverse-geocode-client'
        + `?latitude=${encodeURIComponent(latitude)}`
        + `&longitude=${encodeURIComponent(longitude)}`
        + '&localityLanguage=en';
    try {
        const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(4000) });
        if (!res.ok) return null;
        const data = await res.json().catch(() => null);
        if (!data) return null;

        // Prefer the most specific name available, then qualify it with the city
        // when the two differ — "Kilimani, Nairobi" reads better than either alone.
        const area = String(data.locality || '').trim();
        const city = String(data.city || data.principalSubdivision || '').trim();
        const country = String(data.countryName || '').trim();

        const parts = [];
        if (area) parts.push(area);
        if (city && city.toLowerCase() !== area.toLowerCase()) parts.push(city);
        const label = parts.join(', ');
        if (!label) return null;

        return { label, area, city, country, source: 'reverse-geocode' };
    } catch {
        return null;
    }
}

export async function GET(request) {
    const { searchParams } = new URL(request.url);

    if (searchParams.get('action') === 'reverse') {
        const latitude = Number(searchParams.get('lat'));
        const longitude = Number(searchParams.get('lng'));
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
            || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
            return jsonError('Valid lat and lng are required.', 400);
        }

        // Deliberately unauthenticated: this is used during signup, before an
        // account exists. It only transforms coordinates the caller already has
        // and neither reads nor writes any member data.
        const resolved = await reverseGeocode(latitude, longitude);
        if (resolved) {
            return NextResponse.json({ ok: true, ...resolved }, {
                headers: { 'Cache-Control': 'public, max-age=86400' },
            });
        }

        const fallbackLabel = labelFromCoordinates(latitude, longitude);
        return NextResponse.json({
            ok: true,
            label: fallbackLabel,
            area: '',
            city: fallbackLabel,
            country: '',
            source: fallbackLabel ? 'offline-table' : 'unresolved',
        });
    }

    const fallback = await ipLocation(request);
    if (!fallback) return jsonError('IP location is unavailable.', 404);
    return NextResponse.json({ ok: true, location: fallback });
}

export async function POST(request) {
    const supabase = createServerSupabaseClient({ admin: true });
    if (!supabase) return jsonError('Supabase admin env missing.', 503);
    const body = await request.json().catch(() => ({}));
    // A member may only write their own location. body.userId allowed overwriting
    // another member's coordinates, which drives the nearby/distance features.
    const { member, response } = await requireMember();
    if (response) return response;
    const userId = member.id;
    let location = body;
    if (body.action === 'ip_fallback') {
        const fallback = await ipLocation(request);
        if (!fallback) return jsonError('IP location is unavailable.', 404);
        location = fallback;
    }

    const result = await saveLocation(supabase, userId, location);
    if (result.error) return jsonError(result.error.message);
    return NextResponse.json({ ok: true, location: result.data });
}
