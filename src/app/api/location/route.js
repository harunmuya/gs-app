import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseAdmin';
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
    const label = String(location.city || location.location || labelFromCoordinates(latitude, longitude) || '').slice(0, 120);
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

export async function GET(request) {
    const fallback = await ipLocation(request);
    if (!fallback) return jsonError('IP location is unavailable.', 404);
    return NextResponse.json({ ok: true, location: fallback });
}

export async function POST(request) {
    const supabase = createServerSupabaseClient({ admin: true });
    if (!supabase) return jsonError('Supabase admin env missing.', 503);
    const body = await request.json().catch(() => ({}));
    const userId = body.userId;
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
