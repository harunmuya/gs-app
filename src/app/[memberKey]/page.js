import { notFound, redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RESERVED_KEYS = new Set([
    '_next',
    'admin',
    'api',
    'auth',
    'community-guidelines',
    'contact',
    'discover',
    'favicon.ico',
    'live',
    'matches',
    'members',
    'messages',
    'packages',
    'privacy',
    'profile',
    'safety',
    'terms',
    'wallet',
]);

function cleanKey(value) {
    return decodeURIComponent(String(value || ''))
        .trim()
        .replace(/^@+/, '')
        .replace(/^\/+|\/+$/g, '')
        .slice(0, 80);
}

function slugify(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/@.*/, '')
        .replace(/[^a-z0-9_]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function isMissingColumn(error) {
    return ['42703', 'PGRST204', 'PGRST205'].includes(error?.code);
}

function searchValue(searchParams, keys) {
    for (const key of keys) {
        const value = searchParams?.[key];
        if (Array.isArray(value) && value[0]) return cleanKey(value[0]);
        if (value) return cleanKey(value);
    }
    return '';
}

async function findByUsername(supabase, key) {
    if (!/^[a-z0-9_]{3,30}$/i.test(key)) return null;
    const result = await supabase
        .from('users')
        .select('id, username')
        .ilike('username', key.toLowerCase())
        .maybeSingle();
    if (result.error && !isMissingColumn(result.error)) return null;
    return result.data || null;
}

async function findByFullId(supabase, key) {
    const result = await supabase
        .from('users')
        .select('id, username')
        .eq('id', key)
        .maybeSingle();
    if (result.error) return null;
    return result.data || null;
}

async function findByName(supabase, key) {
    const lowerKey = key.toLowerCase();
    let result = await supabase
        .from('users')
        .select('id, username, display_name, email')
        .limit(5000);
    if (result.error && isMissingColumn(result.error)) {
        result = await supabase
            .from('users')
            .select('id, display_name, email')
            .limit(5000);
    }
    if (result.error || !Array.isArray(result.data)) return null;

    const usernameMatch = result.data.find((user) => slugify(user.username) === lowerKey);
    if (usernameMatch) return usernameMatch;

    // Require exact display_name match (case-insensitive) to avoid wrong-profile redirects
    const exactNameMatch = result.data.find((user) =>
        String(user.display_name || '').toLowerCase().trim() === lowerKey
    );
    if (exactNameMatch) return exactNameMatch;

    // Only match by slugified display_name if there is exactly one match
    const slugMatches = result.data.filter((user) => slugify(user.display_name) === lowerKey);
    if (slugMatches.length === 1) return slugMatches[0];

    return null;
}

export default async function MemberShortLinkPage({ params, searchParams }) {
    const resolvedParams = await params;
    const resolvedSearch = await searchParams;
    const key = cleanKey(resolvedParams?.memberKey);
    const lowerKey = key.toLowerCase();

    if (!key || RESERVED_KEYS.has(lowerKey)) notFound();

    if (lowerKey === 'single.php') {
        const idKey = searchValue(resolvedSearch, ['id']);
        const postKey = searchValue(resolvedSearch, ['p', 'post', 'post_id', 'wp_id', 'profile_id']) || (/^\d+$/.test(idKey) ? idKey : '');
        const memberKey = searchValue(resolvedSearch, ['member_id', 'member', 'user_id', 'username', 'u']) || (/^\d+$/.test(idKey) ? '' : idKey);
        if (postKey) redirect(`/discover/${postKey}`);
        if (memberKey) redirect(`/members/${memberKey}`);
        notFound();
    }

    if (lowerKey.startsWith('seed-local-')) redirect(`/members/${key}`);

    const supabase = createServerSupabaseClient({ admin: true });
    if (!supabase) notFound();

    const match = UUID_PATTERN.test(key)
        ? await findByFullId(supabase, key)
        : await findByUsername(supabase, key) || await findByName(supabase, key);

    if (!match?.id) notFound();
    redirect(`/members/${match.id}`);
}



