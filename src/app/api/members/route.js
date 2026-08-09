import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseAdmin';
import { emailHtml, sendAndLogEmail } from '@/lib/email';
// hashPassword is intentionally not imported: this route no longer writes password
// hashes. verifyPassword remains only to authenticate legacy accounts during the
// one-time migration in `login_account`.
import { verifyPassword, createResetCode, hashResetCode, hashEmail } from '@/lib/security';
import { accountRestrictionMessage, accountStatus, activeTierId, canUseFeature, dailyLimitForFeature, getPackageTier, isAccountRestricted } from '@/lib/packageAccess';
import { getLocalSeedMember, localSeedRows } from '@/lib/localSeedMembers';
import { coordinatesForProfile, displayDistanceKm, distanceKm } from '@/lib/geo';
import { fallbackProfileImageSrc } from '@/lib/profileImages';
import { facilitationFields, profileKindFor } from '@/lib/profileKind';
import { notifyMember } from '@/lib/notifyMember';
import { getSessionMember, provisionAuthUser, signInWithPassword } from '@/lib/authSession';
import { displayMatchPercent, interleave, scoreMember } from '@/lib/discoveryRanking';
import { consumeQuota } from '@/lib/entitlementGuard';
import { TELEGRAM_MENTION } from '@/lib/support';

const FULL_MEMBER_FIELDS = `
    id,
    username,
    display_name,
    email,
    avatar_url,
    photos,
    bio,
    description,
    age,
    location,
    country,
    city,
    latitude,
    longitude,
    geo_updated_at,
    phone,
    phone_number,
    preference,
    profile_label,
    member_category,
    looking_for,
    intent_summary,
    wants,
    needed_qualities,
    age_range_preference,
    hobbies,
    interests,
    body_type,
    subscription_tier,
    verified,
    verification_status,
    show_in_public,
    is_banned,
    is_suspended,
    account_deleted_at,
    total_profile_views,
    followers_count,
    gifts_received_count,
    admin_approved,
    package_locked,
    package_expires_at,
    verification_selfie_url,
    verification_document_url,
    verification_document_type,
    verification_phone,
    verification_submitted_at,
    verification_rejection_reason,
    phone_reveal_plan,
    password_hash,
    created_at,
    last_seen_at,
    last_seen,
    is_seed_profile,
    boost_expires_at,
    boost_score
`;

const BASIC_MEMBER_FIELDS = `
    id,
    display_name,
    email,
    avatar_url,
    photos,
    bio,
    description,
    age,
    location,
    country,
    city,
    phone,
    phone_number,
    preference,
    profile_label,
    subscription_tier,
    verified,
    verification_status,
    show_in_public,
    is_banned,
    is_suspended,
    total_profile_views,
    created_at,
    last_seen_at,
    last_seen
`;

/**
 * Page size for the members listing.
 *
 * The default was 240 — the same as the maximum — so any caller that omitted
 * `per_page` received the entire pool in one response: full profile rows for 240
 * members, plus 240 image URLs the browser then fetched. The grid asks for 12,
 * but every other caller and every crawler got the full 240.
 *
 * 24 is two screens of the 12-card grid, so a caller that does not paginate
 * still gets something sensible without pulling the whole roster.
 */
const DEFAULT_PER_PAGE = 24;
const MAX_PER_PAGE = 240;

const UNLOCKED_PLANS = new Set(['silver', 'gold', 'diamond']);
const PAID_PLANS = new Set(['basic', 'silver', 'gold', 'diamond']);

const LIMIT_NOTICE = 'Daily quota reached. Subscribe to a package for more access, or recharge GS Credits for supported premium actions.';

function booleanSetting(value, fallback) {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return fallback;
}

function settingsPayload(input = {}) {
    const source = input.settings && typeof input.settings === 'object' ? input.settings : input;
    return {
        notifications: booleanSetting(source.notifications, true),
        email_notifications: booleanSetting(source.emailNotifications ?? source.email_notifications, false),
        dark_mode: booleanSetting(source.darkMode ?? source.dark_mode, false),
        show_online: booleanSetting(source.showOnline ?? source.show_online, true),
        show_age: booleanSetting(source.showAge ?? source.show_age, true),
        is_public: booleanSetting(source.isPublic ?? source.is_public, true),
        live_location: booleanSetting(source.liveLocation ?? source.live_location, false),
        location_enabled: booleanSetting(source.locationEnabled ?? source.location_enabled, false),
        push_token: String(source.pushToken ?? source.push_token ?? '').slice(0, 500),
        push_platform: String(source.pushPlatform ?? source.push_platform ?? '').slice(0, 80),
        notification_permission: String(source.notificationPermission ?? source.notification_permission ?? 'default').slice(0, 40),
        preferences: source.preferences && typeof source.preferences === 'object' ? source.preferences : {},
        updated_at: new Date().toISOString(),
    };
}

function normalizeSettings(row = {}) {
    return {
        notifications: row.notifications !== false,
        emailNotifications: Boolean(row.email_notifications),
        darkMode: Boolean(row.dark_mode),
        showOnline: row.show_online !== false,
        showAge: row.show_age !== false,
        isPublic: row.is_public !== false,
        liveLocation: Boolean(row.live_location),
        locationEnabled: Boolean(row.location_enabled),
        pushToken: row.push_token || '',
        pushPlatform: row.push_platform || '',
        notificationPermission: row.notification_permission || 'default',
        preferences: row.preferences || {},
    };
}

/**
 * The acting member for this request.
 *
 * This previously returned `body.memberId || body.userId`, or resolved an account
 * from a bare `body.email` — all attacker-controlled. Every caller of this function
 * performs a member-scoped read or write (settings, inbox, profile edits, account
 * deletion), so identity now comes from the verified session and the body is ignored.
 *
 * Returns null for anonymous callers; callers decide whether that is an error.
 */
async function resolveUserId() {
    const member = await getSessionMember({ fields: 'id, auth_user_id, is_banned, is_suspended, account_deleted_at' });
    if (!member) return null;
    if (isAccountRestricted(member)) return null;
    return member.id;
}

async function getUserSettings(supabase, userId) {
    if (!userId) return null;
    const result = await supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle();
    if (result.error && result.error.code !== 'PGRST116') return { error: result.error };
    if (!result.data) return { data: normalizeSettings({}) };
    return { data: normalizeSettings(result.data) };
}

async function alreadyNotifiedToday(supabase, userId, type) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
        .from('user_notifications')
        .select('id')
        .eq('user_id', userId)
        .eq('type', type)
        .gte('created_at', since)
        .limit(1)
        .maybeSingle();
    return Boolean(data?.id);
}

async function notifyOnceDaily(supabase, userId, payload) {
    if (!userId || !payload?.type || await alreadyNotifiedToday(supabase, userId, payload.type)) return false;
    await supabase.from('user_notifications').insert({ user_id: userId, ...payload });
    return true;
}

const SUPPORT_RESPONSE_TEMPLATES = {
    payment_issue: {
        team: 'Billing Team',
        title: 'Payment issue received',
        shortStatus: 'Payment issue received. Billing has replied in your inbox and email.',
        body: ({ name, subject }) => `Hello ${name},\n\nWe have received your payment issue${subject ? ` about "${subject}"` : ''}. The Billing Team will check the transaction ID, amount paid, selected package, and admin approval status.\n\nPlease keep your M-PESA, Airtel Money, or bank payment message safe. If any detail is missing, Admin Mary G support will request it from you before the package is unlocked or corrected.\n\nYou will receive the next update in your GS app inbox and on your email.`,
    },
    package_unlock: {
        team: 'Billing Team',
        title: 'Package unlock request received',
        shortStatus: 'Package unlock request received. Billing has replied in your inbox and email.',
        body: ({ name }) => `Hello ${name},\n\nYour package unlock request has been received. The Billing Team will confirm the payment reference, the package you selected, and the account that should be unlocked.\n\nAfter approval, the paid features on your lifetime package will open from the admin control panel. If you paid for Silver or Gold, contact reveal, unlimited messaging, gifts, and supported premium features will update on your account after approval.\n\nFor urgent help, you can also contact Admin Mary G on Telegram ${TELEGRAM_MENTION}.`,
    },
    refund: {
        team: 'Billing Team',
        title: 'Refund request received',
        shortStatus: 'Refund request received. Billing has replied in your inbox and email.',
        body: ({ name }) => `Hello ${name},\n\nWe have received your refund or cancellation request. The Billing Team will review your payment status, package access, and service history.\n\nIf your refund is approved, eligible payments are processed within 24 hours after approval. Please keep your payment transaction ID available so the team can confirm the correct record.\n\nYou will receive an update in your GS app inbox and email after review.`,
    },
    verification: {
        team: 'Verification Team',
        title: 'Verification help request received',
        shortStatus: 'Verification request received. The Verification Team has replied.',
        body: ({ name }) => `Hello ${name},\n\nYour verification help request has been received. The Verification Team reviews profile photo, selfie, ID or passport image, and phone number before a badge is approved.\n\nIf any required item is missing or unclear, you will be asked to upload it again. The blue badge appears only after manual admin approval.\n\nPlease use clear photos and make sure the details match your account information.`,
    },
    safety_report: {
        team: 'Safety Team',
        title: 'Safety report received',
        shortStatus: 'Safety report received. The Safety Team has replied.',
        body: ({ name }) => `Hello ${name},\n\nYour scam or fake profile report has been received. The Safety Team will review the profile, message, payment claim, or contact details you reported.\n\nPlease do not send more money or private documents to anyone outside the official Admin Mary G support route. If you have screenshots or usernames, keep them ready for the review.\n\nWe will update you in your GS app inbox and email when action is taken.`,
    },
    account_profile: {
        team: 'Technical Support',
        title: 'Account support request received',
        shortStatus: 'Account request received. Technical Support has replied.',
        body: ({ name }) => `Hello ${name},\n\nYour account or profile help request has reached Technical Support. The team will check profile photos, saved details, login state, visibility settings, preferences, and any missing account information.\n\nPlease keep your app updated and avoid deleting your account while support is reviewing the issue.\n\nYou will receive the next reply inside your GS inbox and email.`,
    },
    direct_connection: {
        team: 'Admin Mary G Support',
        title: 'Direct connection request received',
        shortStatus: 'Direct connection request received. Admin Mary G Support has replied.',
        body: ({ name }) => `Hello ${name},\n\nYour direct connection service request has been received by Admin Mary G Support. Connections are handled through the official support route, and you choose the person you want help with. We do not assign random connections.\n\nIf your package or direct connection payment is approved, Admin Mary G will guide the next step, including Telegram assistance where needed.\n\nFor faster help, contact ${TELEGRAM_MENTION} on Telegram using the same name as your GS account.`,
    },
    general: {
        team: 'GS Support Team',
        title: 'Support request received',
        shortStatus: 'Support request received. A GS Support reply has been sent.',
        body: ({ name }) => `Hello ${name},\n\nWe have received your support request. The GS Support Team will review your message and direct it to the correct department if Billing, Verification, Safety, Technical Support, or Admin Mary G needs to handle it.\n\nYou can continue using the app while the request is reviewed. The next update will appear in your GS inbox and email.`,
    },
};

function buildSupportAutoResponse(service, { name = 'Member', subject = '' } = {}) {
    const key = SUPPORT_RESPONSE_TEMPLATES[service] ? service : 'general';
    const template = SUPPORT_RESPONSE_TEMPLATES[key];
    return {
        service: key,
        team: template.team,
        senderLabel: template.team,
        title: template.title,
        body: template.body({ name, subject }),
        shortStatus: template.shortStatus,
    };
}

function maskPhone(phone) {
    if (!phone) return null;
    const digits = String(phone).replace(/\D/g, '').replace(/^00/, '');
    if (digits.length < 7) return 'Hidden';
    const knownCodes = ['254', '255', '256', '250', '257', '260', '263', '234', '233', '243', '258', '265', '251', '237', '225', '221', '211', '27', '1', '44'];
    const matchedCode = knownCodes.find((code) => digits.startsWith(code) && digits.length > code.length + 6);
    const countryCode = matchedCode || '254';
    let local = matchedCode ? digits.slice(matchedCode.length) : digits;
    if (local.startsWith('0')) local = local.slice(1);
    local = local.slice(-10);
    if (local.length < 7) return 'Hidden';
    return `+${countryCode} ${local.slice(0, 1)}** *** ${local.slice(-4)}`;
}

function normalizeResetCode(value) {
    return String(value || '').replace(/\D/g, '').slice(0, 6);
}

function getDisplayName(member) {
    return member.display_name || member.email?.split('@')[0] || 'Member';
}

function isLegacySeedPhoto(url = '') {
    return String(url || '').toLowerCase().includes('/seed-photos/');
}

function photoLabelFromPath(member = {}, photoUrl = '', fallbackLabel = '') {
    const media = `${photoUrl || ''} ${member.avatar_url || ''} ${Array.isArray(member.photos) ? member.photos.join(' ') : ''}`.toLowerCase();
    if (media.includes('sugarmums')) return 'sugar_mummy';
    if (media.includes('sugar-dads') || media.includes('/seed-photos/seed-m-')) return 'sugar_daddy';
    if (media.includes('mistresses')) return 'mistress';
    if (media.includes('toboys') || media.includes('sugarguys') || media.includes('sugar-guys')) return 'toyboy';
    return fallbackLabel || member.profile_label || member.member_category || '';
}

function fallbackPhotoSeed(member = {}) {
    return member.display_name || member.username || member.email || member.id || 'Member';
}

function cleanPhotoUrl(member = {}, url = '', label = '') {
    const photoUrl = String(url || '').trim();
    if (!photoUrl) return '';
    if (!isLegacySeedPhoto(photoUrl)) return photoUrl;
    return fallbackProfileImageSrc(fallbackPhotoSeed(member), photoLabelFromPath(member, photoUrl, label));
}

function getPrimaryPhoto(member, label = '') {
    const firstPhoto = Array.isArray(member.photos) && member.photos[0] ? member.photos[0] : '';
    const rawPhoto = member.avatar_url || firstPhoto;
    const cleanPhoto = cleanPhotoUrl(member, rawPhoto, label);
    if (cleanPhoto) return cleanPhoto;
    if (member.is_seed_profile) return fallbackProfileImageSrc(fallbackPhotoSeed(member), label || photoLabelFromPath(member));
    return '';
}

function getMemberPhotos(member, label = '') {
    const photos = Array.isArray(member.photos) ? member.photos : [];
    const cleanPhotos = photos.map((photo) => cleanPhotoUrl(member, photo, label)).filter(Boolean);
    const primaryPhoto = getPrimaryPhoto(member, label);
    if (primaryPhoto && !cleanPhotos.includes(primaryPhoto)) cleanPhotos.unshift(primaryPhoto);
    return cleanPhotos;
}

function hasProfilePhoto(member) {
    return Boolean(getPrimaryPhoto(member));
}

function seedIdentityKey(member = {}) {
    const label = inferProfileLabel(member);
    const photo = String(getPrimaryPhoto(member) || '').toLowerCase().replace(/^https?:\/\/[^/]+/i, '');
    const name = String(member.display_name || member.name || member.username || member.email || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    return `${label}:${name}:${photo}`;
}

function dedupeMemberRows(rows = []) {
    const seenIds = new Set();
    const seenSeedKeys = new Set();
    const output = [];
    rows.forEach((row) => {
        const id = String(row.id || '');
        if (id && seenIds.has(id)) return;
        if (row.is_seed_profile) {
            if (!hasProfilePhoto(row)) return;
            const key = seedIdentityKey(row);
            if (seenSeedKeys.has(key)) return;
            seenSeedKeys.add(key);
        }
        if (id) seenIds.add(id);
        output.push(row);
    });
    return output;
}

function inferProfileLabel(member = {}) {
    const raw = String(member.profile_label || member.member_category || '').toLowerCase().replace(/[\s-]+/g, '_');
    const valid = ['sugar_mummy', 'sugar_daddy', 'mistress', 'toyboy'];
    if (member.is_seed_profile) {
        const media = `${member.avatar_url || ''} ${Array.isArray(member.photos) ? member.photos.join(' ') : ''}`.toLowerCase();
        if (media.includes('/seed/sugarmums/')) return 'sugar_mummy';
        if (media.includes('/seed/sugar-dads/')) return 'sugar_daddy';
        if (media.includes('/seed/mistresses/')) return 'mistress';
        if (media.includes('/seed/toboys%20or%20sugarguys/') || media.includes('/seed/toboys or sugarguys/')) return 'toyboy';
        if (valid.includes(raw)) return raw;
        return '';
    }
    if (valid.includes(raw)) return raw;
    if (raw.startsWith('sugar_mummy')) return 'sugar_mummy';
    if (raw.startsWith('sugar_daddy')) return 'sugar_daddy';
    if (raw.startsWith('mistress')) return 'mistress';
    if (raw.startsWith('toyboy') || raw.startsWith('sugar_guy')) return 'toyboy';
    const preference = String(member.preference || '').toLowerCase();
    if (preference.startsWith('sugar_mummy')) return 'sugar_mummy';
    if (preference.startsWith('sugar_daddy')) return 'sugar_daddy';
    if (preference.startsWith('mistress')) return 'mistress';
    if (preference.startsWith('toyboy') || preference.startsWith('sugar_guy')) return 'toyboy';
    if (raw) return raw;
    return '';
}

// PREFERENCE_MIX_PATTERN / PROFILE_MIX_RULES / applyViewerPreferenceMix were removed
// with the ranking rebuild. They interleaved primary and secondary matches on a fixed
// 4:1 cadence regardless of profile strength, so a distant inactive primary always
// outranked a nearby active secondary. The pairings now live in
// lib/discoveryRanking.js#PREFERENCE_RULES and feed a weighted score instead.

function defaultLookingFor(label) {
    if (label === 'sugar_mummy') return 'Sugar Guy / Toyboy';
    if (label === 'sugar_daddy') return 'Mistress';
    if (label === 'mistress') return 'Sugar Daddy';
    if (label === 'toyboy') return 'Sugar Mummy';
    return '';
}

function humanProfileLabel(label) {
    if (label === 'sugar_mummy') return 'Sugar Mummy';
    if (label === 'sugar_daddy') return 'Sugar Daddy';
    if (label === 'mistress') return 'Mistress';
    if (label === 'toyboy') return 'Sugar Guy / Toyboy';
    return 'Member';
}

function defaultIntentSummary(label, lookingFor) {
    if (!label || label === 'member') return '';
    return `I am a ${humanProfileLabel(label)} looking for ${lookingFor || 'a genuine match'}.`;
}

function cleanIntentSummary(member, label, lookingFor) {
    const existing = String(member.intent_summary || '').trim();
    if (member.is_seed_profile) return defaultIntentSummary(label, lookingFor);
    if (!existing) return defaultIntentSummary(label, lookingFor);
    const lower = existing.toLowerCase();
    const expected = String(lookingFor || '').toLowerCase();
    const labelText = humanProfileLabel(label).toLowerCase();
    if ((expected && !lower.includes(expected)) || (labelText && !lower.includes(labelText))) {
        return defaultIntentSummary(label, lookingFor);
    }
    return existing;
}

function recentDisplayTime(member) {
    const real = member.last_seen_at || member.last_seen;
    const realMs = real ? new Date(real).getTime() : 0;
    if (!realMs || Number.isNaN(realMs)) return null;
    return new Date(realMs).toISOString();
}

function stableHash(value) {
    const text = String(value || '');
    let hash = 0;
    for (let index = 0; index < text.length; index++) hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
    return Math.abs(hash);
}

function activeBoost(member) {
    const expires = member.boost_expires_at ? new Date(member.boost_expires_at).getTime() : 0;
    return Boolean(expires && !Number.isNaN(expires) && expires > Date.now());
}

function isUnlockedViewer(viewer) {
    if (!viewer) return false;
    if (isAccountRestricted(viewer)) return false;
    const tier = String(viewer.subscription_tier || '').toLowerCase();
    const approved = viewer.admin_approved ?? true;
    return Boolean(approved !== false && !viewer.package_locked && UNLOCKED_PLANS.has(tier));
}

async function getUserPlan(supabase, userId) {
    if (!userId) return 'free';
    const { data } = await supabase
        .from('users')
        .select('subscription_tier, admin_approved, package_locked, is_banned, is_suspended, account_deleted_at')
        .eq('id', userId)
        .maybeSingle();
    if (isAccountRestricted(data)) {
        return {
            restricted: true,
            message: accountRestrictionMessage(data),
            status: accountStatus(data),
        };
    }
    return activeTierId(data);
}

/**
 * Thin wrapper over the canonical guard in lib/entitlementGuard.
 *
 * The implementation that lived here was one of three near-copies. It counted
 * with a read-modify-write that two concurrent requests could both pass, and it
 * returned "allowed" on any database error. Both are fixed centrally now.
 */
async function enforceDailyLimit(supabase, userId, kind) {
    if (!userId || !kind) return { ok: true, remaining: null };
    const { data: user } = await supabase
        .from('users')
        .select('id, subscription_tier, package_expires_at, admin_approved, package_locked, is_banned, is_suspended, account_deleted_at')
        .eq('id', userId)
        .maybeSingle();
    if (!user?.id) return { ok: true, remaining: null };
    return consumeQuota(supabase, user, kind);
}

/**
 * Record an interaction, and for likes between two real members also record the
 * like itself so a match can form.
 *
 * The previous version wrote to `user_interactions` inside a try/catch. The
 * Supabase client returns an error object rather than throwing, so the catch
 * never fired and the returned error was never inspected — and the table did not
 * exist in this database at all. Every like, super like, pass, save and view was
 * discarded in silence while the member's daily quota was still spent on it.
 *
 * Failures are now logged. They remain non-fatal: losing the ledger entry should
 * not fail the member's action, but it must not be invisible either.
 */
async function recordInteraction(supabase, userId, profileKey, action, details = {}) {
    if (!userId || !profileKey || !action) return;

    const { error } = await supabase.from('user_interactions').upsert({
        user_id: userId,
        profile_key: String(profileKey).slice(0, 180),
        action,
        profile_name: String(details.profileName || details.name || '').slice(0, 120),
        profile_image: String(details.profileImage || details.imageUrl || '').slice(0, 500),
        is_super_like: Boolean(details.isSuperLike),
        metadata: details.metadata || {},
        updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,profile_key,action' });

    if (error) {
        console.error('[recordInteraction] failed:', action, error.code, error.message);
    }
}

/**
 * Register a like between two real members.
 *
 * `member_likes` is the table that carries reciprocity, and a database trigger
 * turns a returned like into a row in `member_matches` and notifies both people.
 * Keeping that in the database means a match forms however the like was created.
 *
 * Only real accounts participate: a seeded or WordPress profile has nobody behind
 * it to like you back, so recording one would manufacture a match that can never
 * be reciprocated.
 *
 * Returns `{ matched }` so the caller can tell the member immediately.
 */
async function recordMemberLike(supabase, likerId, likedKey, { isSuperLike = false } = {}) {
    const likedId = String(likedKey || '').replace(/^member:/, '');
    if (!likerId || !likedId) return { matched: false };
    if (likerId === likedId) return { matched: false };
    if (!UUID_PATTERN.test(likedId)) return { matched: false };   // seed / wp profile

    const { data: target } = await supabase
        .from('users')
        .select('id, is_seed_profile')
        .eq('id', likedId)
        .maybeSingle();
    if (!target?.id || target.is_seed_profile) return { matched: false };

    const { error } = await supabase
        .from('member_likes')
        .upsert({ liker_id: likerId, liked_id: likedId, is_super_like: Boolean(isSuperLike) },
            { onConflict: 'liker_id,liked_id' });

    if (error) {
        console.error('[recordMemberLike] failed:', error.code, error.message);
        return { matched: false };
    }

    // The trigger creates the match; ask whether one now exists.
    const [low, high] = [likerId, likedId].sort();
    const { data: match } = await supabase
        .from('member_matches')
        .select('id, created_at')
        .eq('user_low', low)
        .eq('user_high', high)
        .maybeSingle();

    const matched = Boolean(match?.id);

    /*
      Tell them.

      This recorded the like, detected the match, and told nobody. A member could
      be liked and matched without a single notification in the app or an email,
      which makes the two strongest reasons to come back completely invisible.

      A match notifies both sides, because both need to know they can now message.
      A one-sided like notifies only the person who received it; telling the liker
      "you liked someone" is noise.
    */
    const { data: liker } = await supabase
        .from('users')
        .select('id, display_name')
        .eq('id', likerId)
        .maybeSingle();
    const likerName = liker?.display_name || 'A member';

    if (matched) {
        const { data: likedUser } = await supabase
            .from('users')
            .select('id, display_name')
            .eq('id', likedId)
            .maybeSingle();
        const likedName = likedUser?.display_name || 'A member';
        await Promise.all([
            notifyMember(supabase, {
                userId: likedId,
                type: 'match',
                title: `You matched with ${likerName}`,
                body: 'You both liked each other. You can message now.',
                metadata: { matchId: match.id, memberId: likerId, actionLink: `/messages/${likerId}` },
                email: { template: 'match', data: { matchName: likerName } },
            }),
            notifyMember(supabase, {
                userId: likerId,
                type: 'match',
                title: `You matched with ${likedName}`,
                body: 'You both liked each other. You can message now.',
                metadata: { matchId: match.id, memberId: likedId, actionLink: `/messages/${likedId}` },
                email: { template: 'match', data: { matchName: likedName } },
            }),
        ]);
    } else {
        await notifyMember(supabase, {
            userId: likedId,
            type: isSuperLike ? 'superlike' : 'like',
            title: isSuperLike ? `${likerName} super liked you` : `${likerName} liked your profile`,
            body: 'Like them back to start talking.',
            metadata: { memberId: likerId, actionLink: `/members/${likerId}` },
            email: { template: 'like', data: { likerName, isSuperLike: Boolean(isSuperLike) } },
        });
    }

    return { matched };
}

function parseDataUrl(dataUrl) {
    const match = String(dataUrl || '').match(/^data:([^;,]+)(?:;[^,]*)?;base64,(.+)$/);
    if (!match) return null;
    return {
        contentType: match[1],
        buffer: Buffer.from(match[2], 'base64'),
    };
}

async function uploadMessageAsset(supabase, rawUrl, { ownerId, type, name }) {
    if (!rawUrl || !String(rawUrl).startsWith('data:')) return rawUrl || '';
    const parsed = parseDataUrl(rawUrl);
    if (!parsed || parsed.buffer.length > 6 * 1024 * 1024) return rawUrl;

    const extMap = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif',
        'audio/webm': 'webm',
        'audio/mp4': 'm4a',
        'audio/mpeg': 'mp3',
        'audio/wav': 'wav',
    };
    const ext = extMap[parsed.contentType] || (String(type).includes('voice') ? 'webm' : 'bin');
    const cleanOwner = String(ownerId || 'guest').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 80) || 'guest';
    const cleanName = String(name || type || 'message').replace(/[^a-zA-Z0-9.-]/g, '-').slice(0, 80);
    const path = `${cleanOwner}/${Date.now()}-${Math.random().toString(36).slice(2)}-${cleanName}.${ext}`;

    try {
        const uploaded = await supabase.storage
            .from('message-attachments')
            .upload(path, parsed.buffer, { contentType: parsed.contentType, upsert: false });
        if (uploaded.error) return rawUrl;
        const { data } = supabase.storage.from('message-attachments').getPublicUrl(path);
        return data?.publicUrl || rawUrl;
    } catch {
        return rawUrl;
    }
}

function normalizeMember(member, { canViewPhone = false, includeEmail = false, viewer = null } = {}) {
    const phone = member.phone_number || member.phone || '';
    const verified = Boolean(member.verified || member.verification_status === 'verified');
    // Real recorded activity only. Presence is never synthesised — a fabricated
    // "last active" makes an unattended profile look reachable to a paying member.
    const lastSeenAt = recentDisplayTime(member);
    const lastSeenMs = lastSeenAt ? new Date(lastSeenAt).getTime() : 0;
    const privacy = member.privacy_settings && typeof member.privacy_settings === 'object' ? member.privacy_settings : {};
    const showOnline = privacy.showOnline !== false && privacy.show_online !== false;
    const showAge = privacy.showAge !== false && privacy.show_age !== false;
    const isOnline = Boolean(showOnline && lastSeenMs && Date.now() - lastSeenMs < 3 * 60 * 1000);
    const isBoosted = activeBoost(member);
    const profileLabel = inferProfileLabel(member) || member.profile_label || member.member_category || '';
    // For real users, respect their stored looking_for if it looks correct; only override for seed or conflicts
    const storedLookingFor = String(member.looking_for || '').trim();
    const expectedLookingFor = defaultLookingFor(profileLabel);
    const lookingFor = member.is_seed_profile
        ? (expectedLookingFor || storedLookingFor || '')
        : (storedLookingFor && isValidLookingFor(storedLookingFor, profileLabel) ? storedLookingFor : (expectedLookingFor || storedLookingFor || ''));
    const displayName = getDisplayName(member);
    const kind = profileKindFor(member);
    const coords = coordinatesForProfile(member);
    const viewerCoords = coordinatesForProfile(viewer);
    const awayKm = displayDistanceKm(viewerCoords, coords);

    return {
        id: member.id,
        source: 'member',
        detailPath: `/members/${member.id}`,
        username: member.username || `${makeUsername(displayName || member.email || 'member')}_${String(member.id || '').slice(0, 6)}`,
        name: displayName,
        email: includeEmail ? (member.email || '') : '',
        avatarUrl: getPrimaryPhoto(member, profileLabel),
        photos: getMemberPhotos(member, profileLabel),
        bio: member.description || member.bio || '',
        age: showAge ? (member.age || null) : null,
        location: member.location || member.city || member.country || '',
        country: member.country || '',
        city: member.city || '',
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        locationApproximate: Boolean(coords?.approximate),
        distanceKm: awayKm,
        distanceText: awayKm ? `${coords?.approximate || viewerCoords?.approximate ? 'about ' : ''}${awayKm} km away` : '',
        geoUpdatedAt: member.geo_updated_at || null,
        profileLabel,
        memberCategory: profileLabel,
        lookingFor,
        intentSummary: cleanIntentSummary(member, profileLabel, lookingFor),
        wants: member.wants || '',
        neededQualities: member.needed_qualities || '',
        ageRangePreference: member.age_range_preference || '',
        hobbies: Array.isArray(member.hobbies) ? member.hobbies : [],
        interests: Array.isArray(member.interests) ? member.interests : [],
        bodyType: member.body_type || '',
        subscriptionTier: member.subscription_tier || 'free',
        verified,
        verificationStatus: member.verification_status || (verified ? 'verified' : 'unsubmitted'),
        showInPublic: member.show_in_public !== false,
        isBanned: Boolean(member.is_banned),
        isSuspended: Boolean(member.is_suspended),
        accountDeletedAt: member.account_deleted_at || null,
        accountStatus: accountStatus(member),
        accessBlocked: isAccountRestricted(member),
        adminApproved: Boolean(member.admin_approved),
        packageLocked: Boolean(member.package_locked),
        packageExpiresAt: member.package_expires_at || null,
        verificationSelfieUrl: member.verification_selfie_url || '',
        verificationDocumentUrl: member.verification_document_url || '',
        verificationDocumentType: member.verification_document_type || '',
        verificationPhone: member.verification_phone || '',
        verificationSubmittedAt: member.verification_submitted_at || null,
        verificationRejectionReason: member.verification_rejection_reason || '',
        phone: canViewPhone ? phone || null : null,
        phoneMasked: phone ? maskPhone(phone) : null,
        phoneLocked: Boolean(phone && !canViewPhone),
        // Counts come straight from recorded activity. No synthetic floors.
        totalProfileViews: Number(member.total_profile_views || 0),
        followersCount: Number(member.followers_count || 0),
        giftsReceivedCount: Number(member.gifts_received_count || 0),
        ...facilitationFields(kind),
        isBoosted,
        boostExpiresAt: member.boost_expires_at || null,
        boostScore: isBoosted ? Number(member.boost_score || 0) : 0,
        createdAt: member.created_at || null,
        lastSeenAt: showOnline ? lastSeenAt : null,
        isOnline,
        // Set by the ranking pass; absent on direct lookups, which are not ranked.
        // Excludes jitter and paid placement — see discoveryRanking#displayMatchPercent.
        matchPercent: typeof member.__matchPercent === 'number' ? member.__matchPercent : null,
    };
}

/**
 * The set of profile labels a request is asking for, from either `label` (single)
 * or `labels` (comma-separated). One parser so the SQL filter, the JavaScript
 * filter, and the local-seed filter can never disagree about what was requested.
 * An empty array means "no label constraint".
 */
function requestedLabelSet(searchParams) {
    const many = String(searchParams.get('labels') || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 8);
    if (many.length) return many;
    const single = searchParams.get('label')?.trim();
    if (single && single !== 'all') return [single];
    return [];
}

/**
 * Whether seed profile labels in the database are known to match their photo
 * folders. Set SEED_LABELS_RECONCILED=1 only after running
 * 20260808_020_reconcile_seed_profile_labels.sql and confirming its verification
 * query returns 0.
 */
function seedLabelsReconciled() {
    return process.env.SEED_LABELS_RECONCILED === '1';
}

function applyFilters(query, searchParams, { fullSchema, directLookup = false }) {
    const search = searchParams.get('search')?.trim();
    const country = searchParams.get('country')?.trim();
    const online = searchParams.get('mode') === 'online';
    const boosted = searchParams.get('boosted') === '1';

    const minAge = parseInt(searchParams.get('min_age') || '', 10);
    const maxAge = parseInt(searchParams.get('max_age') || '', 10);
    const labelSet = requestedLabelSet(searchParams);

    if (fullSchema && !directLookup) {
        if (country && country !== 'all') query = query.ilike('country', `%${country}%`);
        if (boosted) query = query.gt('boost_expires_at', new Date().toISOString());
        if (online) {
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
            query = query.gte('last_seen_at', fiveMinutesAgo);
        }
        // Age bounds are applied in SQL so they shrink the candidate pool rather
        // than discarding rows that were already paid for.
        if (Number.isFinite(minAge) && minAge >= 18) query = query.gte('age', minAge);
        if (Number.isFinite(maxAge) && maxAge >= 18) query = query.lte('age', maxAge);
        // Label filtering in SQL, which lets the candidate pool shrink a long way.
        // Only correct once seed profile_label values agree with their photo folders
        // — see supabase/migrations/20260808_020_reconcile_seed_profile_labels.sql.
        // The JavaScript filter downstream still runs, so this is a narrowing, not a
        // replacement; if the flag is set prematurely the result is missing rows,
        // never wrong rows.
        if (seedLabelsReconciled() && labelSet.length) {
            query = query.in('profile_label', labelSet);
        }
    }

    if (search) {
        const searchable = fullSchema
            ? `display_name.ilike.%${search}%,username.ilike.%${search}%,email.ilike.%${search}%,location.ilike.%${search}%,country.ilike.%${search}%,looking_for.ilike.%${search}%`
            : `display_name.ilike.%${search}%,email.ilike.%${search}%,location.ilike.%${search}%,country.ilike.%${search}%`;
        query = query.or(searchable);
    }

    return query;
}

async function fetchMembers(supabase, searchParams, { fullSchema }) {
    const id = searchParams.get('id');
    const usernameKey = String(searchParams.get('username') || '').trim().replace(/^@+/, '').toLowerCase();
    const directLookup = Boolean(id || usernameKey);
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const perPage = Math.min(Math.max(parseInt(searchParams.get('per_page') || String(DEFAULT_PER_PAGE), 10), 1), MAX_PER_PAGE);
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    let query = supabase
        .from('users')
        .select(fullSchema ? FULL_MEMBER_FIELDS : BASIC_MEMBER_FIELDS, { count: 'exact' });

    if (id) {
        const cleanId = String(id).trim();
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanId)) {
            query = query.eq('id', cleanId);
        } else {
            // For non-UUID IDs (seed-local-*, wp-*, etc.) always look up by the id column directly
            query = query.eq('id', cleanId);
        }
    }
    if (!id && usernameKey) query = fullSchema ? query.ilike('username', usernameKey) : query.eq('username', usernameKey);
    query = applyFilters(query, searchParams, { fullSchema, directLookup });
    if (fullSchema) query = query.order('boost_expires_at', { ascending: false, nullsFirst: false });
    query = query.order('created_at', { ascending: false }).range(from, to);

    return query;
}

/**
 * Rank a candidate pool for a viewer.
 *
 * Ordering used to be `hash(row.id) XOR hash(seed)` — a deterministic shuffle
 * unrelated to the viewer or the profile, which is why discovery felt random. Rows
 * are now scored on preference match, proximity, real activity, profile quality,
 * freshness, and paid visibility. See lib/discoveryRanking.js for the weights.
 *
 * `feedMode` still selects a presentation:
 *   mixed    — full relevance score (default)
 *   featured — relevance, with paid and verified profiles weighted harder
 *   new      — newest first, relevance as the tie-break
 *   random   — deliberate shuffle, for "surprise me"
 */
function mixedMemberRows(rows, { feedMode = 'mixed', seed = 'members', viewer = null } = {}) {
    const viewerLabel = viewer ? inferProfileLabel(viewer) : '';
    const real = [];
    const seeded = [];

    dedupeMemberRows(rows).forEach((row) => {
        const profileLabel = inferProfileLabel(row) || row.profile_label || row.member_category || '';
        const boostActive = activeBoost(row);
        const { score, parts } = scoreMember(row, {
            viewer,
            viewerLabel,
            profileLabel,
            seed,
            boostActive,
        });

        // Surfaced so the client can show a match figure derived from the same
        // signals the server ranked on, instead of recomputing its own.
        row.__score = score;
        row.__matchPercent = displayMatchPercent(parts);

        if (row.is_seed_profile) seeded.push(row);
        else real.push(row);
    });

    const byScore = (a, b) => b.__score - a.__score;

    const comparator = (() => {
        if (feedMode === 'random') {
            return (a, b) => jitterCompare(a, b, seed);
        }
        if (feedMode === 'new') {
            return (a, b) => {
                const dateDiff = new Date(b.created_at || 0) - new Date(a.created_at || 0);
                return dateDiff || byScore(a, b);
            };
        }
        if (feedMode === 'featured') {
            return (a, b) => {
                const boostDiff = Number(activeBoost(b)) - Number(activeBoost(a));
                if (boostDiff) return boostDiff;
                const verifiedDiff = Number(Boolean(b.verified)) - Number(Boolean(a.verified));
                if (verifiedDiff) return verifiedDiff;
                return byScore(a, b);
            };
        }
        return byScore;
    })();

    // A profile with no photo is close to unusable in a swipe deck, so it sorts
    // last regardless of score rather than being scored down and still surfacing.
    const withPhotoLast = (comparatorFn) => (a, b) => {
        const photoDiff = Number(hasProfilePhoto(b)) - Number(hasProfilePhoto(a));
        if (photoDiff) return photoDiff;
        return comparatorFn(a, b);
    };

    real.sort(withPhotoLast(comparator));
    seeded.sort(withPhotoLast(comparator));

    if (feedMode === 'random') {
        return [...real, ...seeded].sort((a, b) => jitterCompare(a, b, seed));
    }

    return interleave(real, seeded, feedMode === 'featured'
        ? ['real', 'seed', 'real', 'seed']
        : ['real', 'real', 'seed']);
}

function jitterCompare(a, b, seed) {
    return stableHash(`${a.id}:${seed}`) - stableHash(`${b.id}:${seed}`);
}

function localSeedMatchesFilters(member, searchParams) {
    const country = searchParams.get('country')?.trim();
    const search = searchParams.get('search')?.trim().toLowerCase();
    const online = searchParams.get('mode') === 'online';

    const labelSet = requestedLabelSet(searchParams);
    if (labelSet.length && !labelSet.includes(inferProfileLabel(member))) return false;
    if (country && country !== 'all' && !String(member.country || '').toLowerCase().includes(country.toLowerCase())) return false;
    if (online && Date.now() - new Date(member.last_seen_at || 0).getTime() > 60 * 60 * 1000) return false;
    if (!search) return true;

    return [
        member.display_name,
        member.username,
        member.location,
        member.country,
        member.looking_for,
        member.profile_label,
    ].some((value) => String(value || '').toLowerCase().includes(search));
}

/**
 * Resolve the viewer from the authenticated session.
 *
 * This previously read `?viewer_id=` and looked up whatever account id it was
 * handed, without checking the requester was that user. Member listings expose
 * `id`, so any Gold subscriber's uuid could be pasted in to unlock phone reveal.
 * Entitlement is now keyed to the verified session and the query parameter is
 * ignored entirely.
 */
async function getViewerContext() {
    const member = await getSessionMember({
        fields: 'id, subscription_tier, package_expires_at, admin_approved, package_locked, is_banned, '
            + 'is_suspended, account_deleted_at, latitude, longitude, location, city, country, '
            + 'preference, profile_label, member_category, looking_for',
    });
    if (!member) return { canViewPhone: false, viewer: null };
    return { canViewPhone: isUnlockedViewer(member), viewer: member };
}


async function applyMemberPrivacySettings(supabase, rows = []) {
    const userIds = rows
        .filter((row) => !row.is_seed_profile && row.id)
        .map((row) => row.id);
    if (!userIds.length) return rows;
    try {
        const { data, error } = await supabase
            .from('user_settings')
            .select('user_id, show_online, show_age, is_public')
            .in('user_id', userIds);
        if (error) return rows;
        const byUserId = new Map((data || []).map((setting) => [String(setting.user_id), setting]));
        return rows
            .filter((row) => row.is_seed_profile || byUserId.get(String(row.id))?.is_public !== false)
            .map((row) => ({ ...row, privacy_settings: byUserId.get(String(row.id)) || {} }));
    } catch {
        return rows;
    }
}

export async function GET(request) {
    const supabase = createServerSupabaseClient({ admin: true }) || createServerSupabaseClient({ admin: false });
    const { searchParams } = new URL(request.url);
    const directLookup = Boolean(searchParams.get('id') || searchParams.get('username'));
    const localDirect = directLookup ? getLocalSeedMember(searchParams.get('id') || searchParams.get('username')) : null;

    if (localDirect) {
        return NextResponse.json({
            members: [normalizeMember(localDirect, { canViewPhone: false, includeEmail: false })],
            count: 1,
            schemaReady: true,
        }, {
            headers: { 'Cache-Control': 'private, max-age=20' },
        });
    }

    if (!supabase) {
        const localRows = localSeedRows().filter((member) => localSeedMatchesFilters(member, searchParams));
        return NextResponse.json({
            members: localRows.map((member) => normalizeMember(member, { canViewPhone: false, includeEmail: false })),
            count: localRows.length,
            setupRequired: true,
            error: 'Supabase environment variables are not configured.',
        }, { status: 200 });
    }

    const { canViewPhone, viewer } = await getViewerContext();
    // Any response shaped by a session — personalised ordering, distance, or an
    // unlocked phone number — must never enter a shared cache. Signed-in requests
    // are private even when the URL looks anonymous, because entitlement now comes
    // from cookies rather than the query string.
    const privateLookup = Boolean(viewer || searchParams.get('id') || searchParams.get('username'));
    const cacheControl = privateLookup ? 'private, no-cache, max-age=0' : 'public, s-maxage=15, stale-while-revalidate=30';
    const requestedPage = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const perPage = Math.min(Math.max(parseInt(searchParams.get('per_page') || String(DEFAULT_PER_PAGE), 10), 1), MAX_PER_PAGE);
    const requestedLabel = searchParams.get('label')?.trim();
    // `labels` accepts a comma-separated set so a caller needing several categories
    // makes one request instead of one per label. The matches page previously fired
    // 1 + N parallel requests, each pulling a full 240-row page.
    const requestedLabels = new Set(requestedLabelSet(searchParams));
    const usePreferenceMix = searchParams.get('scope') !== 'all_types' && searchParams.get('personalize') !== '0';
    const radiusRaw = parseInt(searchParams.get('radius_km') || '', 10);
    const radiusKm = Number.isFinite(radiusRaw) && radiusRaw > 0 ? Math.min(radiusRaw, 20000) : 0;
    const includeSelf = searchParams.get('include_self') === '1';
    const feedMode = ['mixed', 'random', 'featured', 'new'].includes(searchParams.get('feed') || '') ? searchParams.get('feed') : 'mixed';
    const mixSeed = String(searchParams.get('mix') || viewer?.id || Math.floor(Date.now() / (15 * 60 * 1000))).slice(0, 80);
    const fetchParams = new URLSearchParams(searchParams);
    if (!directLookup) {
        // Ranking, the local-seed merge, and the preference interleave all operate
        // across a candidate pool, so the pool has to be larger than the page. It
        // does not have to be 240 every time, which is what this used to do: a
        // 20-card discover request pulled 240 full rows and discarded 220.
        //
        // The pool is rounded up to a fixed grid so that consecutive pages usually
        // share the same pool and therefore the same ordering. Crossing a grid
        // boundary can still reshuffle; stable deep pagination needs the database
        // -side ranking planned for Phase 6.
        const POOL_GRID = 60;
        // How far the pool must exceed the page depends on how much filtering still
        // happens after the fetch. With the SQL label filter active, only visibility
        // and self-exclusion remain, so the pool can be much tighter.
        const labelFilteredInSql = seedLabelsReconciled() && requestedLabels.size > 0;
        const OVERSHOOT = labelFilteredInSql ? 1.3 : 2;
        const needed = requestedPage * perPage * OVERSHOOT;
        const poolSize = Math.min(240, Math.max(POOL_GRID, Math.ceil(needed / POOL_GRID) * POOL_GRID));
        fetchParams.set('page', '1');
        fetchParams.set('per_page', String(poolSize));
    }

    let fullSchema = true;
    let result = await fetchMembers(supabase, fetchParams, { fullSchema });

    if (result.error && ['42703', 'PGRST204'].includes(result.error.code)) {
        fullSchema = false;
        result = await fetchMembers(supabase, fetchParams, { fullSchema });
    }

    if (!fullSchema && searchParams.get('boosted') === '1') {
        return NextResponse.json({
            members: [],
            count: 0,
            schemaReady: false,
        }, {
            headers: { 'Cache-Control': cacheControl },
        });
    }

    if (result.error) {
        console.error('Members API error:', result.error);
        return NextResponse.json({
            members: [],
            count: 0,
            setupRequired: true,
            error: result.error.message || 'Unable to load members.',
        }, { status: 500 });
    }

    const rows = (result.data || [])
        /**
         * Who may appear in a listing.
         *
         * The previous expression was a chain of ORs:
         *   directLookup || show_in_public !== false || (!is_seed && admin_approved !== false)
         *
         * so a real member who had switched their profile to private still passed
         * on the third clause. Their privacy setting did nothing. Turning a
         * privacy control into a no-op is worse than not offering one.
         *
         * A direct lookup by id still resolves — that is how a member opens their
         * own or a shared profile — but browsing respects the setting.
         */
        .filter((member) => {
            if (directLookup) return true;
            if (member.show_in_public === false) return false;
            if (!member.is_seed_profile && member.admin_approved === false) return false;
            return true;
        })
        /**
         * A real account with no picture is not listed.
         *
         * The app already tells members "your account stays off the Members page
         * until you upload a clear profile picture" — but nothing enforced it, and
         * 56 of 148 accounts were publicly listed with no image at all. Either the
         * promise holds or it should not be made; browsing a wall of blank cards
         * is also the fastest way to make a dating app feel empty.
         *
         * Seeded profiles are exempt: they always carry imagery, and they are
         * filtered separately by provenance.
         */
        .filter((member) => directLookup || member.is_seed_profile || hasProfilePhoto(member))
        .filter((member) => member.is_banned !== true && member.is_suspended !== true)
        .filter((member) => includeSelf || !viewer?.id || String(member.id) !== String(viewer.id))
        .filter((member) => {
            if (!requestedLabels.size) return true;
            return requestedLabels.has(inferProfileLabel(member) || member.profile_label || member.member_category);
        })
        .filter((member) => {
            // Radius filter. Applied after the fetch because a profile's position
            // may be inferred from its location text rather than stored as
            // coordinates — see geo#coordinatesForProfile.
            if (!radiusKm || !viewer) return true;
            const km = distanceKm(coordinatesForProfile(viewer), coordinatesForProfile(member));
            return km === null ? true : km <= radiusKm;
        });
    let publicRows = rows;

    if (!directLookup && searchParams.get('boosted') !== '1') {
        const existingIds = new Set(publicRows.map((member) => String(member.id)));
        const existingEmails = new Set(publicRows.map((member) => String(member.email || '').toLowerCase()));
        const existingSeedKeys = new Set(publicRows.filter((member) => member.is_seed_profile).map(seedIdentityKey));
        const supplements = localSeedRows()
            .filter((member) => !existingIds.has(String(member.id)) && !existingEmails.has(String(member.email || '').toLowerCase()))
            .filter((member) => !existingSeedKeys.has(seedIdentityKey(member)))
            .filter((member) => localSeedMatchesFilters(member, searchParams));
        const mixedRows = mixedMemberRows(
            await applyMemberPrivacySettings(supabase, [...publicRows, ...supplements]),
            { feedMode, seed: mixSeed, viewer: usePreferenceMix ? viewer : null }
        );
        const from = (requestedPage - 1) * perPage;
        publicRows = mixedRows.slice(from, from + perPage);
    } else if (!directLookup) {
        const mixedRows = mixedMemberRows(
            await applyMemberPrivacySettings(supabase, publicRows),
            { feedMode, seed: mixSeed, viewer: usePreferenceMix ? viewer : null }
        );
        const from = (requestedPage - 1) * perPage;
        publicRows = mixedRows.slice(from, from + perPage);
    } else {
        publicRows = await applyMemberPrivacySettings(supabase, publicRows);
    }

    return NextResponse.json({
        members: publicRows.map((member) => normalizeMember(member, { canViewPhone, includeEmail: false, viewer })),
        count: publicRows.length,
        schemaReady: fullSchema || (result.count || 0) > 0,
    }, {
        headers: { 'Cache-Control': cacheControl },
    });
}


function profileLabelFromPreference(preference) {
    const value = String(preference || '').toLowerCase();
    if (value.startsWith('sugar_mummy')) return 'sugar_mummy';
    if (value.startsWith('sugar_daddy')) return 'sugar_daddy';
    if (value.startsWith('mistress')) return 'mistress';
    if (value.startsWith('toyboy') || value.startsWith('sugar_guy')) return 'toyboy';
    return 'sugar_mummy';
}

function lookingForFromPreference(preference) {
    const label = profileLabelFromPreference(preference);
    return defaultLookingFor(label) || 'Sugar Guy / Toyboy';
}

function isValidLookingFor(lookingFor, profileLabel) {
    // Verify that the looking_for text is consistent with the profile_label
    // e.g. sugar_mummy should look for Sugar Guy / Toyboy, NOT Sugar Mummy
    if (!lookingFor || !profileLabel) return true; // can't validate, allow it
    const lower = lookingFor.toLowerCase().replace(/[\s/]+/g, ' ');
    // A member should NOT be looking for their own type
    if (profileLabel === 'sugar_mummy' && (lower.includes('sugar mum') || lower.includes('sugar mummy'))) return false;
    if (profileLabel === 'sugar_daddy' && (lower.includes('sugar dad') || lower.includes('sugar daddy'))) return false;
    if (profileLabel === 'mistress' && lower.includes('mistress')) return false;
    if (profileLabel === 'toyboy' && (lower.includes('toyboy') || lower.includes('sugar guy'))) return false;
    return true;
}

function cleanDisplayName(value, email = '') {
    const emailText = String(email || '').trim().toLowerCase();
    const localPart = emailText.split('@')[0] || '';
    let name = String(value || '').trim().replace(/\s+/g, ' ').slice(0, 80);
    if (!name || name.includes('@') || name.toLowerCase() === emailText || name.toLowerCase() === localPart) {
        name = localPart
            ? localPart.replace(/[._-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()).slice(0, 40)
            : 'GS Member';
    }
    if (!name || name.includes('@')) name = 'GS Member';
    return name;
}

function makeUsername(value, fallback = 'member') {
    const raw = String(value || fallback || 'member')
        .trim()
        .toLowerCase()
        .replace(/@.*/, '')
        .replace(/[^a-z0-9_]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 24);
    return raw || 'member';
}

async function uniqueUsername(supabase, desired, existingId = null) {
    const base = makeUsername(desired);
    for (let index = 0; index < 30; index++) {
        const suffix = index === 0 ? '' : `_${index + 1}`;
        const candidate = `${base.slice(0, Math.max(3, 24 - suffix.length))}${suffix}`;
        const result = await supabase
            .from('users')
            .select('id')
            .eq('username', candidate)
            .limit(1)
            .maybeSingle();
        if (result.error && ['42703', 'PGRST204', 'PGRST205'].includes(result.error.code)) return candidate;
        if (result.error && result.error.code !== 'PGRST116') return candidate;
        if (!result.data?.id || result.data.id === existingId) return candidate;
    }
    const tag = String(existingId || Date.now()).replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toLowerCase();
    return `${base.slice(0, 17)}_${tag || 'user'}`;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function ensureTargetAvailable(supabase, memberId) {
    if (!UUID_PATTERN.test(String(memberId || ''))) return { ok: true, member: null };
    let result = await supabase
        .from('users')
        .select('id, is_banned, is_suspended, account_deleted_at')
        .eq('id', memberId)
        .maybeSingle();
    if (result.error && ['42703', 'PGRST204'].includes(result.error.code)) {
        result = await supabase
            .from('users')
            .select('id, is_banned, is_suspended')
            .eq('id', memberId)
            .maybeSingle();
    }
    if (result.error) return { ok: false, error: result.error.message, status: 500 };
    if (!result.data?.id || isAccountRestricted(result.data)) {
        return { ok: false, error: 'This member is unavailable.', status: 404 };
    }
    return { ok: true, member: result.data };
}

// resolvePayloadId() was removed with the Supabase Auth cutover. It let the client
// choose the primary key of a new account row, and generated a random uuid otherwise
// — which is why users.id never matched auth.uid() and the RLS policies never applied.
// New rows are now keyed to the Supabase Auth user id at insert time.

function accountPayload(body, { fullSchema = true } = {}) {
    const email = String(body.email || '').trim().toLowerCase();
    const preferenceLabel = profileLabelFromPreference(body.preference);
    const profileLabel = body.preference ? preferenceLabel : (body.profile_label || preferenceLabel);
    const lookingFor = defaultLookingFor(profileLabel) || body.looking_for || lookingForFromPreference(body.preference);
    const photos = Array.isArray(body.photos) ? body.photos.filter(Boolean).slice(0, 6) : [];
    const avatar = body.avatar_url || photos[0] || '';
    const phone = String(body.phone || body.phone_number || '').slice(0, 40);
    const profileComplete = Boolean(avatar && body.bio && body.age && body.location && phone);
    const base = {
        email,
        display_name: cleanDisplayName(body.display_name, email),
        avatar_url: avatar,
        photos,
        bio: String(body.bio || '').slice(0, 1200),
        description: String(body.description || body.bio || '').slice(0, 1200),
        age: body.age ? Number(body.age) : null,
        location: String(body.location || '').slice(0, 120),
        country: String(body.country || '').slice(0, 80),
        city: String(body.city || body.location || '').slice(0, 120),
        phone,
        phone_number: phone,
        profile_label: profileLabel,
        member_category: profileLabel,
        looking_for: defaultLookingFor(profileLabel) || lookingFor,
        subscription_tier: 'free',
        verified: false,
        verification_status: body.verification_submitted_at ? 'pending_admin' : 'unsubmitted',
        show_in_public: body.show_in_public !== false,
        is_banned: false,
        is_suspended: false,
        last_seen_at: new Date().toISOString(),
        last_seen: new Date().toISOString(),
    };

    if (!fullSchema) return base;

    return {
        ...base,
        username: makeUsername(body.username || body.display_name || email),
        member_category: profileLabel,
        auth_user_id: body.auth_user_id || body.supabase_auth_id || null,
        looking_for: lookingFor,
        intent_summary: body.intent_summary || defaultIntentSummary(profileLabel, lookingFor),
        wants: String(body.wants || '').slice(0, 500),
        needed_qualities: String(body.needed_qualities || '').slice(0, 500),
        age_range_preference: String(body.age_range_preference || '').slice(0, 80),
        hobbies: Array.isArray(body.hobbies) ? body.hobbies.slice(0, 12) : [],
        interests: Array.isArray(body.interests) ? body.interests.slice(0, 12) : [],
        admin_approved: true,
        phone_reveal_plan: 'silver',
        package_locked: false,
        ...(Number.isFinite(Number(body.latitude)) ? { latitude: Number(body.latitude) } : {}),
        ...(Number.isFinite(Number(body.longitude)) ? { longitude: Number(body.longitude) } : {}),
        ...(body.geo_updated_at ? { geo_updated_at: body.geo_updated_at } : {}),
        verification_selfie_url: String(body.verification_selfie_url || '').slice(0, 2000000),
        verification_document_url: String(body.verification_document_url || '').slice(0, 2000000),
        verification_document_type: String(body.verification_document_type || '').slice(0, 40),
        verification_phone: String(body.verification_phone || body.phone_number || body.phone || '').slice(0, 40),
        verification_submitted_at: body.verification_submitted_at || null,
        verification_rejection_reason: '',
        is_seed_profile: false,
        // Passwords are never stored on this row. Supabase Auth is the sole
        // credential store; the auth identity is provisioned by the caller.
        ...(body.password ? { password_updated_at: new Date().toISOString() } : {}),
    };
}

function accountCompletionError(body) {
    const phone = String(body.phone || body.phone_number || '').replace(/\D/g, '');
    const age = Number(body.age);
    const name = cleanDisplayName(body.display_name, body.email);
    if (!name || name === 'GS Member') return 'A real profile name is required before creating an account.';
    if (!Number.isInteger(age) || age < 18 || age > 80) return 'Age must be between 18 and 80.';
    if (String(body.location || '').trim().length < 2) return 'City or area is required before creating an account.';
    if (phone.length < 7) return 'A valid phone number is required before creating an account.';
    if (String(body.bio || '').trim().length < 12) return 'A short bio is required before creating an account.';
    return '';
}

async function uploadProfilePhoto(supabase, rawUrl, ownerId, index = 0) {
    const value = String(rawUrl || '').trim();
    if (!value || !value.startsWith('data:')) return value;
    const parsed = parseDataUrl(value);
    if (!parsed || !parsed.contentType.startsWith('image/') || parsed.buffer.length > 7 * 1024 * 1024) return value;
    const extMap = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
    const ext = extMap[parsed.contentType] || 'webp';
    const cleanOwner = String(ownerId || 'member').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 80) || 'member';
    const path = `${cleanOwner}/profile-${index}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const uploaded = await supabase.storage.from('profile-media').upload(path, parsed.buffer, {
        contentType: parsed.contentType,
        upsert: false,
    });
    if (uploaded.error) throw uploaded.error;
    const { data } = supabase.storage.from('profile-media').getPublicUrl(path);
    return data?.publicUrl || value;
}

async function normalizeProfilePhotos(supabase, photos, ownerId) {
    const unique = [];
    for (const item of (Array.isArray(photos) ? photos : [])) {
        const value = String(item || '').trim();
        if (value && !unique.includes(value)) unique.push(value);
    }
    const limited = unique.slice(0, 6);
    const uploaded = [];
    for (let index = 0; index < limited.length; index++) {
        uploaded.push(await uploadProfilePhoto(supabase, limited[index], ownerId, index));
    }
    return uploaded.filter(Boolean);
}

function profileEditPayload(body = {}, existing = {}) {
    const allowed = new Set([
        'display_name',
        'username',
        'bio',
        'description',
        'age',
        'location',
        'country',
        'city',
        'phone',
        'phone_number',
        'wants',
        'needed_qualities',
        'age_range_preference',
        'looking_for',
        'intent_summary',
        'profile_label',
        'member_category',
        'preference',
    ]);
    const patch = {};
    for (const [key, rawValue] of Object.entries(body.updates || body)) {
        if (!allowed.has(key)) continue;
        if (rawValue === undefined || rawValue === null) continue;
        const value = typeof rawValue === 'string' ? rawValue.trim() : rawValue;
        if (key === 'display_name') patch.display_name = cleanDisplayName(value, existing.email || body.email || '');
        else if (key === 'username') patch.username = makeUsername(value);
        else if (key === 'age') patch.age = Number(value);
        else if (key === 'phone' || key === 'phone_number') {
            patch.phone = String(value).slice(0, 40);
            patch.phone_number = String(value).slice(0, 40);
        } else if (key === 'bio' || key === 'description') {
            patch.bio = String(value).slice(0, 1200);
            patch.description = String(value).slice(0, 1200);
        } else {
            patch[key] = String(value).slice(0, key === 'intent_summary' ? 500 : 180);
        }
    }
    if (patch.location && !patch.city) patch.city = patch.location;
    if (patch.profile_label && !patch.member_category) patch.member_category = patch.profile_label;
    if (patch.member_category && !patch.profile_label) patch.profile_label = patch.member_category;
    return patch;
}

function requiredProfileError(account = {}) {
    if (!getPrimaryPhoto(account)) return 'Upload one clear real profile photo before saving your profile.';
    const phone = String(account.phone || account.phone_number || '').replace(/\D/g, '');
    const age = Number(account.age);
    const name = cleanDisplayName(account.display_name, account.email);
    if (!name || name === 'GS Member') return 'Add your real first name or public name.';
    if (!Number.isInteger(age) || age < 18 || age > 80) return 'Age must be between 18 and 80.';
    if (String(account.location || '').trim().length < 2) return 'City or area is required.';
    if (phone.length < 7) return 'A valid phone number is required.';
    if (String(account.bio || account.description || '').trim().length < 12) return 'Write a short bio so members know you are real.';
    return '';
}

function profileCompletionError(account = {}) {
    return requiredProfileError(account);
}

function validateProfilePatch(patch = {}) {
    if (Object.prototype.hasOwnProperty.call(patch, 'display_name')) {
        const name = cleanDisplayName(patch.display_name);
        if (!name || name === 'GS Member') return 'Add your real first name or public name.';
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'age')) {
        const age = Number(patch.age);
        if (!Number.isInteger(age) || age < 18 || age > 80) return 'Age must be between 18 and 80.';
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'location') && String(patch.location || '').trim().length < 2) {
        return 'City or area is required.';
    }
    if ((Object.prototype.hasOwnProperty.call(patch, 'phone') || Object.prototype.hasOwnProperty.call(patch, 'phone_number'))
        && String(patch.phone || patch.phone_number || '').replace(/\D/g, '').length < 7) {
        return 'A valid phone number is required.';
    }
    if ((Object.prototype.hasOwnProperty.call(patch, 'bio') || Object.prototype.hasOwnProperty.call(patch, 'description'))
        && String(patch.bio || patch.description || '').trim().length < 12) {
        return 'Write a short bio so members know you are real.';
    }
    return '';
}

async function safeDeleteByColumn(supabase, table, column, value) {
    if (!value) return;
    try { await supabase.from(table).delete().eq(column, value); } catch {}
}

async function removeStorageFolder(supabase, bucket, folder) {
    if (!folder) return;
    try {
        const listed = await supabase.storage.from(bucket).list(folder, { limit: 100 });
        const names = (listed.data || []).map((item) => `${folder}/${item.name}`);
        if (names.length) await supabase.storage.from(bucket).remove(names);
    } catch {}
}

function isMissingTableError(error) {
    return ['42P01', 'PGRST205'].includes(error?.code) || String(error?.message || '').toLowerCase().includes('schema cache');
}

async function deletedAccountRecord(supabase, email) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail) return { deleted: false };
    const emailHash = hashEmail(cleanEmail);
    try {
        const result = await supabase
            .from('account_deletions')
            .select('email_hash, deleted_at')
            .eq('email_hash', emailHash)
            .maybeSingle();
        if (result.error && result.error.code !== 'PGRST116') {
            if (isMissingTableError(result.error)) return { deleted: false, missingTable: true };
            return { deleted: false, error: result.error };
        }
        return { deleted: Boolean(result.data?.email_hash), deletedAt: result.data?.deleted_at || null };
    } catch {
        return { deleted: false, missingTable: true };
    }
}

async function rememberDeletedAccount(supabase, { email, userId }) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail) return false;
    const emailHash = hashEmail(cleanEmail);
    try {
        const result = await supabase.from('account_deletions').upsert({
            email_hash: emailHash,
            user_id: userId || null,
            deleted_at: new Date().toISOString(),
        }, { onConflict: 'email_hash' });
        return !result.error;
    } catch {
        return false;
    }
}

async function deleteAuthUserForAccount(supabase, account = {}) {
    const authId = account.auth_user_id || null;
    if (authId) {
        try { await supabase.auth.admin.deleteUser(authId); return authId; } catch {}
    }
    const authUser = await findAuthUserByEmail(supabase, account.email);
    if (authUser?.id) {
        try { await supabase.auth.admin.deleteUser(authUser.id); return authUser.id; } catch {}
    }
    return null;
}

async function selectUserByEmailInsensitive(supabase, fields, email) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail) return { data: null, error: null };
    let exact = await supabase.from('users').select(fields).eq('email', cleanEmail).maybeSingle();
    if (exact.data || (exact.error && !['PGRST116'].includes(exact.error.code))) return exact;
    const fuzzy = await supabase
        .from('users')
        .select(fields)
        .ilike('email', cleanEmail)
        .order('created_at', { ascending: false })
        .limit(1);
    if (fuzzy.error) return { data: null, error: fuzzy.error };
    return { data: fuzzy.data?.[0] || null, error: null };
}

async function findAuthUserByEmail(supabase, email) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail) return null;
    try {
        for (let page = 1; page <= 20; page++) {
            const result = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
            if (result.error) return null;
            const found = (result.data?.users || []).find((user) => String(user.email || '').trim().toLowerCase() === cleanEmail);
            if (found) return found;
            if ((result.data?.users || []).length < 1000) break;
        }
    } catch {}
    return null;
}
async function syncAuthLoginAccount(supabase, authUser, email, password) {
    const authId = authUser?.id;
    if (!authId || !email) return { data: null, error: null };
    const deletedAccount = await deletedAccountRecord(supabase, email);
    if (deletedAccount.deleted) {
        const error = new Error('This account was permanently deleted. Contact support if you need it restored.');
        error.status = 410;
        error.code = 'ACCOUNT_DELETED';
        return { data: null, error };
    }
    let byAuth = await supabase.from('users').select(FULL_MEMBER_FIELDS).or(`auth_user_id.eq.${authId},id.eq.${authId}`).limit(1);
    if (byAuth.error && ['42703', 'PGRST204'].includes(byAuth.error.code)) {
        byAuth = await supabase.from('users').select(BASIC_MEMBER_FIELDS).eq('id', authId).limit(1);
    }
    if (byAuth.error) return { data: null, error: byAuth.error };
    const existing = byAuth.data?.[0] || null;
    const now = new Date().toISOString();
    if (existing?.id) {
        if (isAccountRestricted(existing)) {
            const error = new Error(accountRestrictionMessage(existing) || 'Your account cannot be used right now.');
            error.status = 403;
            error.code = 'ACCOUNT_RESTRICTED';
            return { data: existing, error };
        }
        const patch = {
            email,
            auth_user_id: authId,
            // Supabase Auth owns the credential now. Writing a scrypt hash back
            // here would recreate the second password store this migration removes.
            password_hash: null,
            password_updated_at: existing.password_hash ? now : existing.password_updated_at,
            last_seen_at: now,
            last_seen: now,
        };
        return supabase.from('users').update(patch).eq('id', existing.id).select(FULL_MEMBER_FIELDS).maybeSingle();
    }
    const displayName = cleanDisplayName(authUser.user_metadata?.full_name || authUser.user_metadata?.name, email);
    const payload = accountPayload({
        id: authId,
        email,
        display_name: displayName,
        username: await uniqueUsername(supabase, authUser.user_metadata?.username || displayName || email, authId),
        avatar_url: authUser.user_metadata?.avatar_url || '',
        photos: authUser.user_metadata?.avatar_url ? [authUser.user_metadata.avatar_url] : [],
        bio: '',
        age: '',
        location: '',
        phone: '',
        preference: 'sugar_mummy_looking_for_toyboy',
        password,
        auth_user_id: authId,
        show_in_public: false,
    }, { fullSchema: true });
    payload.id = authId;
    payload.auth_user_id = authId;
    payload.show_in_public = false;
    return supabase.from('users').insert(payload).select(FULL_MEMBER_FIELDS).maybeSingle();
}
async function incrementUserCounter(supabase, memberId, column) {
    const { data, error } = await supabase.from('users').select(column).eq('id', memberId).maybeSingle();
    if (error) return { error };
    const nextValue = (data?.[column] || 0) + 1;
    return supabase.from('users').update({ [column]: nextValue }).eq('id', memberId).select(column).maybeSingle();
}

export async function POST(request) {
    const supabase = createServerSupabaseClient({ admin: true });
    if (!supabase) {
        return NextResponse.json({ error: 'Supabase admin environment variables are not configured.' }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const action = body.action;
    const memberId = body.memberId;
    const actorKey = String(body.actorKey || 'guest').slice(0, 120);

    if (action === 'account_settings') {
        const userId = await resolveUserId();
        if (!userId) return NextResponse.json({ settings: normalizeSettings({}) });
        const settingsResult = await getUserSettings(supabase, userId);
        if (settingsResult?.error) return NextResponse.json({ error: 'User settings table is missing. Run supabase/migrations/20260626_080_user_alert_settings.sql.' }, { status: 500 });
        return NextResponse.json({ ok: true, settings: settingsResult.data || normalizeSettings({}) });
    }

    if (action === 'update_settings') {
        const userId = await resolveUserId();
        if (!userId) return NextResponse.json({ error: 'Account id or email is required.' }, { status: 400 });
        const settings = settingsPayload(body);
        const payload = { user_id: userId, ...settings };
        const result = await supabase
            .from('user_settings')
            .upsert(payload, { onConflict: 'user_id' })
            .select('*')
            .maybeSingle();
        if (result.error) return NextResponse.json({ error: 'User settings table is missing. Run supabase/migrations/20260626_080_user_alert_settings.sql.' }, { status: 500 });

        let member = null;
        try {
            const existing = await supabase
                .from('users')
                .select(FULL_MEMBER_FIELDS)
                .eq('id', userId)
                .maybeSingle();
            if (existing.data?.id) {
                const visibilityPatch = {
                    show_in_public: Boolean(settings.is_public && !existing.data.is_banned && !existing.data.is_suspended),
                    updated_at: new Date().toISOString(),
                };
                let update = await supabase
                    .from('users')
                    .update(visibilityPatch)
                    .eq('id', userId)
                    .select(FULL_MEMBER_FIELDS)
                    .maybeSingle();
                if (update.error && ['42703', 'PGRST204'].includes(update.error.code)) {
                    update = await supabase
                        .from('users')
                        .update({ show_in_public: visibilityPatch.show_in_public })
                        .eq('id', userId)
                        .select(BASIC_MEMBER_FIELDS)
                        .maybeSingle();
                }
                if (!update.error && update.data) member = normalizeMember(update.data, { canViewPhone: true, includeEmail: true });
            }
        } catch {}

        return NextResponse.json({ ok: true, settings: normalizeSettings(result.data), member });
    }

    if (action === 'push_subscription') {
        const userId = await resolveUserId();
        if (!userId) return NextResponse.json({ error: 'Account id or email is required.' }, { status: 400 });
        const subscription = body.subscription || {};
        const endpoint = String(subscription.endpoint || body.endpoint || '').slice(0, 1000);
        if (!endpoint) return NextResponse.json({ error: 'Push subscription endpoint is required.' }, { status: 400 });
        const keys = subscription.keys || {};
        const payload = {
            user_id: userId,
            endpoint,
            p256dh: String(keys.p256dh || body.p256dh || '').slice(0, 500),
            auth: String(keys.auth || body.auth || '').slice(0, 500),
            platform: String(body.platform || 'web').slice(0, 80),
            permission: String(body.permission || 'granted').slice(0, 40),
            user_agent: String(body.userAgent || '').slice(0, 500),
            updated_at: new Date().toISOString(),
        };
        const result = await supabase.from('push_subscriptions').upsert(payload, { onConflict: 'endpoint' }).select('id').maybeSingle();
        if (result.error && result.error.code !== 'PGRST205') return NextResponse.json({ error: result.error.message }, { status: 500 });
        return NextResponse.json({ ok: true, persisted: !result.error });
    }

    /*
      Mark notifications read, on the server.

      Reading was previously a local-only change: markActivityRead and
      markMessagesRead updated React state and localStorage and nothing else. No
      server action existed to record it, so all 387 notifications in this
      database are still flagged unread. The badge therefore came back in full
      on any other device, after clearing site data, or after a reinstall, and
      one member is carrying a permanent 16.

      Scoped to the signed-in member: a notification id belonging to somebody
      else is simply not matched, so passing one does nothing.
    */
    if (action === 'mark_notifications_read') {
        const userId = await resolveUserId();
        if (!userId) return NextResponse.json({ error: 'Sign in to update your notifications.' }, { status: 401 });

        const ids = Array.isArray(body.notificationIds)
            ? body.notificationIds.map((id) => String(id)).filter(Boolean).slice(0, 200)
            : [];

        let query = supabase
            .from('user_notifications')
            .update({ read: true, read_at: new Date().toISOString() })
            .eq('user_id', userId)
            .eq('read', false);

        // No ids means "mark everything read", which is what the Mark all
        // control does. With ids, only those rows are touched.
        if (ids.length) query = query.in('id', ids);

        const { error, count } = await query.select('id', { count: 'exact' });
        if (error) {
            console.error('[members] mark_notifications_read failed:', error.message);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ ok: true, marked: count ?? 0 });
    }

    if (action === 'account_inbox') {
        // Inbox is the signed-in member's own. Resolving it from a body id or a
        // bare email let anyone read another member's notifications.
        const userId = await resolveUserId();
        if (!userId) return NextResponse.json({ notifications: [] });
        let result = await supabase
            .from('user_notifications')
            .select('id, type, title, body, read, metadata, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(100);
        if (result.error && ['42703', 'PGRST204'].includes(result.error.code)) {
            result = await supabase
                .from('user_notifications')
                .select('id, type, title, body, read, created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(100);
        }
        if (result.error && result.error.code !== 'PGRST205') return NextResponse.json({ error: result.error.message }, { status: 500 });
        return NextResponse.json({ ok: true, notifications: result.data || [] });
    }

    if (action === 'account_state') {
        const userId = await resolveUserId();
        if (!userId) return NextResponse.json({ ok: true, likes: [], matches: [], passes: [], saved: [], usage: {} });
        const today = new Date().toISOString().slice(0, 10);
        const [interactionsResult, savesResult, usageResult] = await Promise.all([
            supabase
                .from('user_interactions')
                .select('profile_key, action, profile_name, profile_image, is_super_like, metadata, created_at, updated_at')
                .eq('user_id', userId)
                .order('updated_at', { ascending: false })
                .limit(500),
            supabase
                .from('member_saves')
                .select('saved_key, saved_name, saved_image, created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(250),
            supabase
                .from('user_daily_usage')
                .select('kind, count')
                .eq('user_id', userId)
                .eq('usage_date', today),
        ]);
        const rows = interactionsResult.error ? [] : (interactionsResult.data || []);
        const mapInteraction = (row) => ({
            wpId: row.profile_key,
            name: row.profile_name || row.metadata?.name || 'Profile',
            imageUrl: row.profile_image || row.metadata?.imageUrl || '',
            likedAt: row.created_at,
            savedAt: row.created_at,
            matchedAt: row.created_at,
            super: Boolean(row.is_super_like),
            score: row.metadata?.score || null,
            source: row.metadata?.source || '',
        });
        const likes = rows.filter((row) => row.action === 'like' || row.action === 'superlike').map(mapInteraction);
        /*
          Matches come from member_matches, which only the reciprocity trigger
          writes.

          This used to read rows where action = 'match' in user_interactions,
          and those rows were written by the client: discover called addMatch
          whenever a compatibility score cleared 93, and shouldMatchProfile
          rolled a hash-based dice against the score to decide. So a member could
          like somebody, be told "Matched with X, 94% compatible", and open a
          conversation with a person who had never seen their profile. The score
          is a ranking heuristic; it is not consent from the other side.

          member_matches is written only when both people have liked each other,
          enforced in the database. If it is empty, nobody has matched, and
          saying otherwise is the fabrication this rebuild has been removing
          everywhere else.
        */
        const { data: matchRows } = await supabase
            .from('member_matches')
            .select('id, user_low, user_high, is_super_match, created_at')
            .or(`user_low.eq.${userId},user_high.eq.${userId}`)
            .order('created_at', { ascending: false })
            .limit(200);

        const partnerIds = [...new Set((matchRows || []).map((row) => (row.user_low === userId ? row.user_high : row.user_low)))];
        const { data: partners } = partnerIds.length
            ? await supabase.from('users').select('id, display_name, avatar_url, photos, profile_label, verified, last_seen_at').in('id', partnerIds)
            : { data: [] };
        const partnersById = new Map((partners || []).map((row) => [row.id, row]));

        const matches = (matchRows || []).map((row) => {
            const partnerId = row.user_low === userId ? row.user_high : row.user_low;
            const partner = partnersById.get(partnerId);
            if (!partner) return null;
            return {
                wpId: partner.id,
                id: partner.id,
                name: partner.display_name || 'Member',
                imageUrl: partner.avatar_url || (Array.isArray(partner.photos) ? partner.photos[0] : '') || '',
                profileLabel: partner.profile_label || '',
                verified: Boolean(partner.verified),
                lastSeenAt: partner.last_seen_at || null,
                matchedAt: row.created_at,
                super: Boolean(row.is_super_match),
                mutual: true,
            };
        }).filter(Boolean);
        const passes = rows.filter((row) => row.action === 'pass' || row.action === 'swipe_pass').map((row) => row.profile_key);
        const interactionSaved = rows.filter((row) => row.action === 'save').map(mapInteraction);
        const tableSaved = savesResult.error ? [] : (savesResult.data || []).map((row) => ({
            wpId: row.saved_key,
            name: row.saved_name || 'Saved profile',
            imageUrl: row.saved_image || '',
            savedAt: row.created_at,
        }));
        const savedByKey = new Map([...interactionSaved, ...tableSaved].map((item) => [item.wpId, item]));
        const usage = {};
        if (!usageResult.error) (usageResult.data || []).forEach((row) => { usage[row.kind] = row.count || 0; });
        return NextResponse.json({ ok: true, likes, matches, passes, saved: Array.from(savedByKey.values()), usage });
    }

    if (action === 'account_reminders') {
        const userId = await resolveUserId();
        if (!userId) return NextResponse.json({ ok: true, created: 0 });
        const { data: account } = await supabase
            .from('users')
            .select('id, email, display_name, avatar_url, photos, bio, age, location, phone, phone_number, verified, verification_status, subscription_tier, admin_approved, package_locked')
            .eq('id', userId)
            .maybeSingle();
        if (!account?.id) return NextResponse.json({ ok: true, created: 0 });
        let created = 0;
        const hasPhoto = Boolean(account.avatar_url || (Array.isArray(account.photos) && account.photos[0]));
        const complete = Boolean(hasPhoto && account.bio && account.age && account.location && (account.phone || account.phone_number));
        if (!complete && await notifyOnceDaily(supabase, userId, {
            type: 'profile_reminder',
            title: 'Complete your GS profile',
            body: 'Add a profile photo, bio, age, location, and phone number so your account can appear properly in Members.',
        })) {
            created++;
            if (account.email) {
                await sendAndLogEmail(supabase, {
                    to: account.email,
                    subject: 'Complete your GS profile',
                    text: 'Add a profile photo, bio, age, location, and phone number so your account can appear properly in Members.',
                    html: emailHtml('Complete your GS profile', `Hello ${account.display_name || 'Member'},\n\nAdd a profile photo, bio, age, location, and phone number so your account can appear properly in Members and interact with other users.\n\nOpen your profile page to finish your account.`),
                });
            }
        }
        if (account.verification_status !== 'verified' && await notifyOnceDaily(supabase, userId, {
            type: 'verification',
            title: 'Manual verification is available',
            body: 'Request your blue badge from Account by uploading a clear selfie, ID/passport, and phone number for admin review.',
        })) created++;
        const paid = Boolean(!account.package_locked && ['basic', 'silver', 'gold', 'diamond'].includes(String(account.subscription_tier || '').toLowerCase()));
        if (!paid && await notifyOnceDaily(supabase, userId, {
            type: 'package',
            title: 'Unlock premium GS features',
            body: 'Basic unlocks unlimited messages, photo chat, 50 GS Credits, and one direct connection request after admin approval. Silver unlocks phone reveal, calls, GIFs, voice notes, activity insights, and stronger visibility.',
        })) created++;
        return NextResponse.json({ ok: true, created });
    }

    if (action === 'refresh_account') {
        // Refreshes the signed-in member's own record. The previous version would
        // return any account given its id or email.
        const userId = await resolveUserId();
        if (!userId) return NextResponse.json({ error: 'Sign in to refresh your account.' }, { status: 401 });

        let query = supabase.from('users').select(FULL_MEMBER_FIELDS).eq('id', userId);
        let result = await query.maybeSingle();

        if (result.error && ['42703', 'PGRST204'].includes(result.error.code)) {
            // `email` is not in scope here — the const declarations for it live
            // inside later action blocks, so the previous version referenced an
            // undeclared identifier and threw ReferenceError instead of falling
            // back. The id from the session is the only identity this needs
            // anyway; matching on a client-supplied email would be weaker.
            result = await supabase
                .from('users')
                .select(BASIC_MEMBER_FIELDS)
                .eq('id', userId)
                .maybeSingle();
        }
        if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
        // 404 here signs the member out on the client, so be precise about what
        // it means: the session resolved to an id that has no row. resolveUserId
        // provisions a missing profile, so reaching this is a genuine anomaly
        // rather than the routine "not signed in" case, which returns 401 above.
        if (!result.data) {
            console.error('[members] refresh_account: session resolved to id with no users row:', userId);
            return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
        }
        const normalized = normalizeMember(result.data, { canViewPhone: true, includeEmail: true });
        if (isAccountRestricted(result.data)) {
            return NextResponse.json({
                error: accountRestrictionMessage(result.data) || 'Your account cannot be used right now.',
                accountStatus: normalized.accountStatus,
                member: normalized,
            }, { status: 403 });
        }
        await supabase.from('users').update({ last_seen_at: new Date().toISOString(), last_seen: new Date().toISOString() }).eq('id', result.data.id);
        return NextResponse.json({ ok: true, member: normalized });
    }

    if (action === 'heartbeat') {
        const userId = await resolveUserId();
        if (!userId) return NextResponse.json({ ok: true, updated: false });
        const now = new Date().toISOString();
        const result = await supabase
            .from('users')
            .update({ last_seen_at: now, last_seen: now })
            .eq('id', userId)
            .select('id, last_seen_at')
            .maybeSingle();
        if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
        return NextResponse.json({ ok: true, updated: Boolean(result.data?.id), lastSeenAt: result.data?.last_seen_at || now });
    }

    if (action === 'update_profile_fields') {
        const email = String(body.email || '').trim().toLowerCase();
        const userId = await resolveUserId();
        if (!userId && !email) return NextResponse.json({ error: 'Sign in before editing your profile.' }, { status: 400 });

        let existing = userId
            ? await supabase.from('users').select(FULL_MEMBER_FIELDS).eq('id', userId).maybeSingle()
            : await supabase.from('users').select(FULL_MEMBER_FIELDS).eq('email', email).maybeSingle();
        if (existing.error && ['42703', 'PGRST204'].includes(existing.error.code)) {
            existing = userId
                ? await supabase.from('users').select(BASIC_MEMBER_FIELDS).eq('id', userId).maybeSingle()
                : await supabase.from('users').select(BASIC_MEMBER_FIELDS).eq('email', email).maybeSingle();
        }
        if (existing.error && existing.error.code !== 'PGRST116') return NextResponse.json({ error: existing.error.message }, { status: 500 });
        if (!existing.data?.id) return NextResponse.json({ error: 'Account not found. Sign in again and retry.' }, { status: 404 });

        const patch = profileEditPayload(body, existing.data);
        if (!Object.keys(patch).length) return NextResponse.json({ error: 'No profile changes were submitted.' }, { status: 400 });
        if (patch.username) patch.username = await uniqueUsername(supabase, patch.username, existing.data.id);
        const merged = { ...existing.data, ...patch };
        const validationError = body.requireCompleteProfile ? profileCompletionError(merged) : validateProfilePatch(patch);
        if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
        patch.show_in_public = Boolean(existing.data.show_in_public !== false && !existing.data.is_banned && !existing.data.is_suspended);

        let result = await supabase.from('users').update(patch).eq('id', existing.data.id).select(FULL_MEMBER_FIELDS).maybeSingle();
        if (result.error && ['42703', 'PGRST204'].includes(result.error.code)) {
            const fallbackPatch = { ...patch };
            // Remove columns that may not exist in the database schema
            delete fallbackPatch.username;
            delete fallbackPatch.member_category;
            delete fallbackPatch.intent_summary;
            delete fallbackPatch.wants;
            delete fallbackPatch.needed_qualities;
            delete fallbackPatch.age_range_preference;
            delete fallbackPatch.looking_for;
            delete fallbackPatch.profile_label;
            if (Object.keys(fallbackPatch).length > 0) {
                result = await supabase.from('users').update(fallbackPatch).eq('id', existing.data.id).select(BASIC_MEMBER_FIELDS).maybeSingle();
            } else {
                // All fields were optional/unsupported — return existing data as-is
                result = { data: existing.data, error: null };
            }
        }
        if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
        const savedMember = result.data || { ...existing.data, ...patch };
        const isComplete = Boolean(savedMember.bio && savedMember.age && savedMember.location && (savedMember.phone_number || savedMember.phone));
        return NextResponse.json({ ok: true, member: normalizeMember(savedMember, { canViewPhone: true, includeEmail: true }), profileComplete: isComplete });
    }

    if (action === 'delete_account') {
        const email = String(body.email || '').trim().toLowerCase();
        const userId = await resolveUserId();
        if (!userId && !email) return NextResponse.json({ error: 'Sign in before deleting your account.' }, { status: 400 });

        let accountResult = userId
            ? await supabase.from('users').select('id, email, auth_user_id').eq('id', userId).maybeSingle()
            : await supabase.from('users').select('id, email, auth_user_id').eq('email', email).maybeSingle();
        if (accountResult.error && ['42703', 'PGRST204'].includes(accountResult.error.code)) {
            accountResult = userId
                ? await supabase.from('users').select('id, email').eq('id', userId).maybeSingle()
                : await supabase.from('users').select('id, email').eq('email', email).maybeSingle();
        }
        if (accountResult.error && accountResult.error.code !== 'PGRST116') return NextResponse.json({ error: accountResult.error.message }, { status: 500 });
        if (!accountResult.data?.id) return NextResponse.json({ ok: true, deleted: false });

        const id = accountResult.data.id;
        const accountEmail = accountResult.data.email || email;
        await rememberDeletedAccount(supabase, { email: accountEmail, userId: id });
        await Promise.all([
            safeDeleteByColumn(supabase, 'user_settings', 'user_id', id),
            safeDeleteByColumn(supabase, 'user_notifications', 'user_id', id),
            safeDeleteByColumn(supabase, 'password_reset_codes', 'user_id', id),
            safeDeleteByColumn(supabase, 'password_reset_codes', 'email', accountEmail),
            safeDeleteByColumn(supabase, 'package_requests', 'user_id', id),
            safeDeleteByColumn(supabase, 'support_tickets', 'user_id', id),
            safeDeleteByColumn(supabase, 'ticket_responses', 'user_id', id),
            safeDeleteByColumn(supabase, 'user_interactions', 'user_id', id),
            safeDeleteByColumn(supabase, 'user_daily_usage', 'user_id', id),
            safeDeleteByColumn(supabase, 'member_saves', 'user_id', id),
            safeDeleteByColumn(supabase, 'profile_views', 'viewed_id', id),
            safeDeleteByColumn(supabase, 'profile_views', 'viewer_id', id),
            safeDeleteByColumn(supabase, 'profile_boosts', 'user_id', id),
            safeDeleteByColumn(supabase, 'user_stories', 'user_id', id),
            safeDeleteByColumn(supabase, 'story_views', 'viewer_id', id),
            safeDeleteByColumn(supabase, 'story_likes', 'user_id', id),
            safeDeleteByColumn(supabase, 'member_likes', 'liker_id', id),
            safeDeleteByColumn(supabase, 'member_likes', 'liked_id', id),
            safeDeleteByColumn(supabase, 'user_follows', 'follower_id', id),
            safeDeleteByColumn(supabase, 'user_follows', 'following_id', id),
            safeDeleteByColumn(supabase, 'member_messages', 'member_id', id),
            safeDeleteByColumn(supabase, 'member_messages', 'sender_id', id),
            safeDeleteByColumn(supabase, 'member_messages', 'receiver_id', id),
            safeDeleteByColumn(supabase, 'member_gifts', 'member_id', id),
            safeDeleteByColumn(supabase, 'member_gifts', 'sender_id', id),
            safeDeleteByColumn(supabase, 'member_gifts', 'receiver_id', id),
            safeDeleteByColumn(supabase, 'call_requests', 'member_id', id),
            safeDeleteByColumn(supabase, 'call_requests', 'caller_id', id),
            safeDeleteByColumn(supabase, 'call_requests', 'receiver_id', id),
            safeDeleteByColumn(supabase, 'conversations', 'user_one_id', id),
            safeDeleteByColumn(supabase, 'conversations', 'user_two_id', id),
            safeDeleteByColumn(supabase, 'chat_messages', 'sender_id', id),
            safeDeleteByColumn(supabase, 'chat_messages', 'receiver_id', id),
            safeDeleteByColumn(supabase, 'messages', 'sender_id', id),
            safeDeleteByColumn(supabase, 'messages', 'receiver_id', id),
            safeDeleteByColumn(supabase, 'live_streams', 'user_id', id),
            safeDeleteByColumn(supabase, 'live_viewers', 'user_id', id),
            safeDeleteByColumn(supabase, 'live_comments', 'user_id', id),
            safeDeleteByColumn(supabase, 'live_gifts', 'user_id', id),
            safeDeleteByColumn(supabase, 'wallet_transactions', 'user_id', id),
            safeDeleteByColumn(supabase, 'credit_wallet', 'user_id', id),
            safeDeleteByColumn(supabase, 'gift_wallet', 'user_id', id),
            safeDeleteByColumn(supabase, 'user_gift_inventory', 'user_id', id),
            removeStorageFolder(supabase, 'profile-media', id),
            removeStorageFolder(supabase, 'story-media', id),
            removeStorageFolder(supabase, 'verification-media', id),
        ]);

        await Promise.all([
            safeDeleteByColumn(supabase, 'conversations', 'user_one_id', id),
            safeDeleteByColumn(supabase, 'conversations', 'user_two_id', id),
            safeDeleteByColumn(supabase, 'live_streams', 'user_id', id),
            safeDeleteByColumn(supabase, 'user_stories', 'user_id', id),
            safeDeleteByColumn(supabase, 'support_tickets', 'user_id', id),
        ]);

        const deleted = await supabase.from('users').delete().eq('id', id);
        if (deleted.error) return NextResponse.json({ error: deleted.error.message }, { status: 500 });
        const deletedAuthUserId = await deleteAuthUserForAccount(supabase, { ...accountResult.data, email: accountEmail });
        try { await supabase.from('admin_logs').insert({ action: 'account_deleted', details: { userId: id, emailHash: hashEmail(accountEmail), deletedAuthUserId } }); } catch {}
        return NextResponse.json({ ok: true, deleted: true });
    }
    if (action === 'request_password_reset') {
        const email = String(body.email || '').trim().toLowerCase();
        if (!email || !email.includes('@')) return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });

        const { data: account, error: accountError } = await supabase
            .from('users')
            .select('id, email, display_name')
            .eq('email', email)
            .maybeSingle();
        if (accountError) return NextResponse.json({ error: accountError.message }, { status: 500 });

        if (!account?.id) {
            return NextResponse.json({ ok: true, message: 'If an account exists, a reset code has been sent.' });
        }

        const code = createResetCode();
        const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString();
        const payload = {
            user_id: account.id,
            email,
            code_hash: hashResetCode(email, code),
            expires_at: expiresAt,
        };
        const inserted = await supabase.from('password_reset_codes').insert(payload);
        if (inserted.error && inserted.error.code !== 'PGRST205') return NextResponse.json({ error: inserted.error.message }, { status: 500 });
        if (inserted.error?.code === 'PGRST205') return NextResponse.json({ error: 'Password reset table is missing. Run the latest SQL migration.' }, { status: 500 });

        const title = 'Reset your Genuine Sugar Mummies password';
        const text = `Your password reset code is ${code}. It expires in 20 minutes.`;
        await sendAndLogEmail(supabase, {
            to: email,
            subject: title,
            text,
            html: emailHtml(title, `<p>Use this reset code:</p><h2 style="letter-spacing:4px">${code}</h2><p>This code expires in 20 minutes.</p>`),
        });
        try { await supabase.from('admin_logs').insert({ action: 'password_reset_requested', details: { userId: account.id, email } }); } catch {}
        return NextResponse.json({ ok: true, message: 'Reset code sent to your email.' });
    }

    if (action === 'reset_password') {
        const email = String(body.email || '').trim().toLowerCase();
        const code = normalizeResetCode(body.code);
        const password = String(body.password || '');
        if (!email || !email.includes('@')) return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
        if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: 'Enter the 6-digit reset code.' }, { status: 400 });
        if (password.length < 6) return NextResponse.json({ error: 'New password must be at least 6 characters.' }, { status: 400 });

        const codeHash = hashResetCode(email, code);
        const codeResult = await supabase
            .from('password_reset_codes')
            .select('id, user_id, expires_at, used_at')
            .eq('email', email)
            .eq('code_hash', codeHash)
            .is('used_at', null)
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (codeResult.error && codeResult.error.code !== 'PGRST116') return NextResponse.json({ error: codeResult.error.message }, { status: 500 });
        if (!codeResult.data?.id) return NextResponse.json({ error: 'Invalid or expired reset code.' }, { status: 400 });

        // Reset the Supabase Auth credential, not a local hash. The account row
        // keeps only the timestamp, and any legacy hash is cleared so the old
        // password cannot still be used.
        const resetTarget = await supabase.from('users').select('id, email, auth_user_id').eq('id', codeResult.data.user_id).maybeSingle();
        if (resetTarget.error || !resetTarget.data?.id) {
            return NextResponse.json({ error: 'Account was not found for this reset code.' }, { status: 404 });
        }

        const authIdentity = await provisionAuthUser(resetTarget.data.email, password, {});
        if (authIdentity.error || !authIdentity.user) {
            return NextResponse.json({ error: 'Password reset is temporarily unavailable. Please try again shortly.' }, { status: 503 });
        }
        if (resetTarget.data.auth_user_id) {
            const admin = createServerSupabaseClient({ admin: true });
            await admin?.auth.admin.updateUserById(resetTarget.data.auth_user_id, { password }).catch(() => {});
        }

        const patch = {
            password_hash: null,
            auth_user_id: resetTarget.data.auth_user_id || authIdentity.user.id,
            password_updated_at: new Date().toISOString(),
        };
        let updated = await supabase.from('users').update(patch).eq('id', codeResult.data.user_id).select(FULL_MEMBER_FIELDS).maybeSingle();
        if (updated.error && ['42703', 'PGRST204'].includes(updated.error.code)) {
            updated = await supabase.from('users').update(patch).eq('id', codeResult.data.user_id).select(BASIC_MEMBER_FIELDS).maybeSingle();
        }
        if (updated.error) return NextResponse.json({ error: updated.error.message }, { status: 500 });
        if (!updated.data?.id) return NextResponse.json({ error: 'Account was not found for this reset code.' }, { status: 404 });
        await supabase.from('password_reset_codes').update({ used_at: new Date().toISOString() }).eq('id', codeResult.data.id);
        try { await supabase.from('user_notifications').insert({ user_id: codeResult.data.user_id, type: 'security', title: 'Password changed', body: 'Your password was reset successfully.' }); } catch {}
        return NextResponse.json({ ok: true, member: normalizeMember(updated.data, { canViewPhone: true, includeEmail: true }) });
    }
    if (action === 'login_account') {
        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');
        if (!email || !email.includes('@')) return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
        if (password.length < 6) return NextResponse.json({ error: 'Password is required.' }, { status: 400 });
        const deletedAccount = await deletedAccountRecord(supabase, email);
        if (deletedAccount.deleted) {
            return NextResponse.json({ error: 'This account was permanently deleted. Contact support if you need it restored.', accountStatus: 'deleted' }, { status: 410 });
        }

        let result = await selectUserByEmailInsensitive(supabase, FULL_MEMBER_FIELDS, email);

        if (result.error && ['42703', 'PGRST204'].includes(result.error.code)) {
            result = await selectUserByEmailInsensitive(supabase, BASIC_MEMBER_FIELDS, email);
        }

        if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });

        if (!result.data) {
            // Try Supabase Auth as fallback — user may exist in auth but not users table
            const authResult = await signInWithPassword(email, password);
            if (authResult.data?.user) {
                const synced = await syncAuthLoginAccount(supabase, authResult.data.user, email, password);
                if (!synced.error && synced.data) {
                    return NextResponse.json({ ok: true, member: normalizeMember(synced.data, { canViewPhone: true, includeEmail: true }) });
                }
                if (synced.error) return NextResponse.json({ error: synced.error.message }, { status: synced.error.status || 500 });
            }
            // There was previously a fallback here that looked the account up by
            // email via the admin API and signed it in when signInWithPassword had
            // already failed — i.e. with no password check at all. Removed: a failed
            // password must end the attempt.
            return NextResponse.json({ error: 'No account found for this email. Create an account first.' }, { status: 404 });
        }

        // Path A — already migrated to Supabase Auth. Sign in normally; this also
        // writes the session cookies that every other route now authorizes against.
        if (!result.data.password_hash) {
            const authResult = await signInWithPassword(email, password);
            if (authResult.data?.user) {
                const synced = await syncAuthLoginAccount(supabase, authResult.data.user, email, password);
                if (synced.error) return NextResponse.json({ error: synced.error.message }, { status: synced.error.status || 500 });
                return NextResponse.json({ ok: true, member: normalizeMember(synced.data, { canViewPhone: true, includeEmail: true }) });
            }
            return NextResponse.json({ error: 'Incorrect email or password. Use password reset if you cannot access this account.' }, { status: 401 });
        }

        // Path B — legacy scrypt account. Verify against the old hash first.
        if (!verifyPassword(password, result.data.password_hash)) return NextResponse.json({ error: 'Incorrect email or password.' }, { status: 401 });
        if (isAccountRestricted(result.data)) {
            return NextResponse.json({
                error: accountRestrictionMessage(result.data) || 'Your account cannot be used right now.',
                accountStatus: accountStatus(result.data),
            }, { status: 403 });
        }

        // The password is now known-good, so the Supabase Auth identity can be
        // provisioned with it and the member signed in without a password reset.
        const provisioned = await provisionAuthUser(email, password, {
            display_name: getDisplayName(result.data),
            username: result.data.username || '',
        });
        if (provisioned.error || !provisioned.user) {
            return NextResponse.json({
                error: 'Sign-in is temporarily unavailable. Please try again shortly.',
            }, { status: 503 });
        }

        const session = await signInWithPassword(email, password);
        if (session.error || !session.data?.user) {
            return NextResponse.json({
                error: 'Sign-in is temporarily unavailable. Please try again shortly.',
            }, { status: 503 });
        }

        const now = new Date().toISOString();
        // Drop the legacy hash: Supabase Auth is now the only credential store for
        // this account, so there is no second password to keep in sync.
        await supabase.from('users').update({
            email,
            auth_user_id: provisioned.user.id,
            password_hash: null,
            password_updated_at: now,
            last_seen_at: now,
            last_seen: now,
        }).eq('id', result.data.id);

        result.data.email = email;
        result.data.auth_user_id = provisioned.user.id;
        return NextResponse.json({
            ok: true,
            migratedToSupabaseAuth: true,
            member: normalizeMember(result.data, { canViewPhone: true, includeEmail: true }),
        });
    }

    if (action === 'upsert_account') {
        const email = String(body.email || '').trim().toLowerCase();
        if (!email || !email.includes('@')) return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
        const deletedAccount = await deletedAccountRecord(supabase, email);
        if (deletedAccount.deleted) {
            return NextResponse.json({ error: 'This account was permanently deleted. Contact support if you need it restored.', accountStatus: 'deleted' }, { status: 410 });
        }
        if (body.password && !body.id) {
            const completionError = accountCompletionError(body);
            if (completionError) return NextResponse.json({ error: completionError }, { status: 400 });
        }

        let existingAccount = await selectUserByEmailInsensitive(supabase, 'id, username, password_hash, avatar_url, photos, verified, verification_status, admin_approved, package_locked, subscription_tier, package_expires_at, verification_selfie_url, verification_document_url, verification_phone, verification_submitted_at, auth_user_id', email);
        if (existingAccount.error && ['42703', 'PGRST204'].includes(existingAccount.error.code)) {
            existingAccount = await selectUserByEmailInsensitive(supabase, 'id, password_hash, avatar_url, photos, verified, verification_status, admin_approved, package_locked, subscription_tier, package_expires_at, verification_selfie_url, verification_document_url, verification_phone, verification_submitted_at', email);
        }
        if (existingAccount.error && existingAccount.error.code !== 'PGRST116') return NextResponse.json({ error: existingAccount.error.message }, { status: 500 });
        const isProfileUpdate = Boolean(existingAccount.data?.id && body.id === existingAccount.data.id && !body.password);
        if (!isProfileUpdate) {
            if (String(body.password || '').length < 6) return NextResponse.json({ error: 'Create a password with at least 6 characters.' }, { status: 400 });
            // Migrated accounts have no password_hash, so auth_user_id is also a
            // signal that this email is already registered.
            if (existingAccount.data?.password_hash || existingAccount.data?.auth_user_id) {
                return NextResponse.json({ error: 'This email already has an account. Please sign in.' }, { status: 409 });
            }
            const completionError = accountCompletionError(body);
            if (completionError) return NextResponse.json({ error: completionError }, { status: 400 });
        }
        let payload = accountPayload(body, { fullSchema: true });
        payload.username = await uniqueUsername(supabase, body.username || existingAccount.data?.username || payload.username || body.display_name || email, existingAccount.data?.id || null);
        const oldProfilePhoto = getPrimaryPhoto(existingAccount.data || {});
        const newProfilePhoto = getPrimaryPhoto(payload);
        const profilePhotoChanged = Boolean(isProfileUpdate && existingAccount.data?.verified && oldProfilePhoto && oldProfilePhoto !== newProfilePhoto);
        if (isProfileUpdate) {
            if (profilePhotoChanged) {
                payload.verified = false;
                payload.verification_status = 'reverify_required';
                payload.verification_selfie_url = '';
                payload.verification_document_url = '';
                payload.verification_document_type = '';
                payload.verification_phone = '';
                payload.verification_submitted_at = null;
                payload.verification_rejection_reason = 'Profile photo changed. User must resubmit verification.';
            } else {
                delete payload.verified;
                delete payload.verification_status;
                delete payload.verification_selfie_url;
                delete payload.verification_document_url;
                delete payload.verification_phone;
                delete payload.verification_submitted_at;
            }
            delete payload.admin_approved;
            delete payload.package_locked;
            delete payload.subscription_tier;
            delete payload.package_expires_at;
        } else if (existingAccount.data?.id) {
            payload.verified = existingAccount.data.verified;
            payload.verification_status = existingAccount.data.verification_status || payload.verification_status;
            payload.admin_approved = existingAccount.data.admin_approved;
            payload.package_locked = existingAccount.data.package_locked;
            payload.subscription_tier = existingAccount.data.subscription_tier || payload.subscription_tier;
            payload.package_expires_at = existingAccount.data.package_expires_at || null;
        }
        // Use explicit INSERT or UPDATE instead of upsert (avoids issues with missing UNIQUE constraint)
        let result;
        let newAuthUserId = null;
        if (existingAccount.data?.id) {
            // UPDATE existing user
            const memberId = existingAccount.data.id;
            delete payload.email; // don't update email on existing accounts
            result = await supabase
                .from('users')
                .update(payload)
                .eq('id', memberId)
                .select(FULL_MEMBER_FIELDS)
                .maybeSingle();

            if (result.error && ['42703', 'PGRST204'].includes(result.error.code)) {
                payload = accountPayload(body, { fullSchema: false });
                delete payload.username;
                delete payload.email;
                if (isProfileUpdate) {
                    delete payload.verified;
                    delete payload.verification_status;
                }
                result = await supabase
                    .from('users')
                    .update(payload)
                    .eq('id', memberId)
                    .select(BASIC_MEMBER_FIELDS)
                    .maybeSingle();
            }
        } else {
            // INSERT new user. Create the Supabase Auth identity first so the row
            // can be keyed to it: using the auth uid as the primary key is what
            // makes the `auth.uid() = id` RLS policies apply to new accounts.
            const signup = await provisionAuthUser(email, body.password, {
                display_name: payload.display_name || '',
                username: payload.username || '',
            });
            if (signup.error || !signup.user) {
                console.error('[upsert_account] auth provisioning failed:', signup.error?.message);
                return NextResponse.json({ error: 'Account creation is temporarily unavailable. Please try again shortly.' }, { status: 503 });
            }

            newAuthUserId = signup.user.id;
            payload.id = signup.user.id;
            payload.auth_user_id = signup.user.id;
            result = await supabase
                .from('users')
                .insert(payload)
                .select(FULL_MEMBER_FIELDS)
                .maybeSingle();

            if (result.error && ['42703', 'PGRST204'].includes(result.error.code)) {
                payload = accountPayload(body, { fullSchema: false });
                payload.id = signup.user.id;
                delete payload.username;
                result = await supabase
                    .from('users')
                    .insert(payload)
                    .select(BASIC_MEMBER_FIELDS)
                    .maybeSingle();
            }
        }

        // If the profile row could not be written, roll back the auth identity we
        // just created. Leaving it behind would block the member from retrying with
        // the same email, and would leave an account with no profile.
        async function rollbackNewAuthUser() {
            if (!newAuthUserId) return;
            const admin = createServerSupabaseClient({ admin: true });
            try { await admin?.auth.admin.deleteUser(newAuthUserId); } catch {}
        }

        if (result.error) {
            console.error('[upsert_account] DB error:', result.error.code, result.error.message);
            await rollbackNewAuthUser();
            return NextResponse.json({ error: result.error.message }, { status: 500 });
        }
        if (!result.data) {
            console.error('[upsert_account] No data returned after insert/update for:', email);
            await rollbackNewAuthUser();
            return NextResponse.json({ error: 'Account could not be saved. Please try again.' }, { status: 500 });
        }
        // Establish the session for the newly created account.
        if (newAuthUserId && body.password) {
            await signInWithPassword(email, body.password);
        }
        if (profilePhotoChanged && result.data?.id) {
            try {
                await supabase.from('user_notifications').insert({
                    user_id: result.data.id,
                    type: 'verification',
                    title: 'Verification reset',
                    body: 'Your profile photo changed. Please submit a new selfie, ID/passport, and phone details for badge review.',
                });
            } catch {}
        }
        const createdAccount = !existingAccount.data?.id;
        if (createdAccount && result.data?.id) {
            try {
                await supabase.from('user_settings').upsert({
                    user_id: result.data.id,
                    notifications: true,
                    email_notifications: false,
                    dark_mode: false,
                    show_online: true,
                    show_age: true,
                    is_public: true,
                    live_location: false,
                    location_enabled: false,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'user_id' });
            } catch {}
            const welcomeTitle = 'Welcome to Genuine Sugar Mummies';
            const welcomeBody = 'Your account has been created. Complete your profile, upload a profile picture, submit manual verification, and choose a package to unlock more of the app. Basic unlocks unlimited messages, photo chat, 50 GS Credits, and one direct connection request after admin approval. Silver unlocks phone reveal, calls, GIFs, voice notes, activity insights, and stronger visibility.';
            try { await supabase.from('user_notifications').insert({ user_id: result.data.id, type: 'welcome', title: welcomeTitle, body: welcomeBody }); } catch {}
            await sendAndLogEmail(supabase, { to: email, subject: welcomeTitle, text: welcomeBody, html: emailHtml(welcomeTitle, welcomeBody) });
        }
        return NextResponse.json({ ok: true, member: normalizeMember({ ...payload, ...(result.data || {}) }, { canViewPhone: true, includeEmail: true }), createdAccount });
    }

    if (action === 'update_profile_photos') {
        const email = String(body.email || '').trim().toLowerCase();
        const userId = await resolveUserId();
        if (!userId && !email) return NextResponse.json({ error: 'Sign in before updating photos.' }, { status: 400 });

        let existing = userId
            ? await supabase.from('users').select(FULL_MEMBER_FIELDS).eq('id', userId).maybeSingle()
            : await supabase.from('users').select(FULL_MEMBER_FIELDS).eq('email', email).maybeSingle();
        if (existing.error && ['42703', 'PGRST204'].includes(existing.error.code)) {
            existing = userId
                ? await supabase.from('users').select(BASIC_MEMBER_FIELDS).eq('id', userId).maybeSingle()
                : await supabase.from('users').select(BASIC_MEMBER_FIELDS).eq('email', email).maybeSingle();
        }
        if (existing.error && existing.error.code !== 'PGRST116') return NextResponse.json({ error: existing.error.message }, { status: 500 });
        if (!existing.data?.id) return NextResponse.json({ error: 'Account not found. Sign in again and retry.' }, { status: 404 });

        let photos;
        try {
            photos = await normalizeProfilePhotos(supabase, body.photos, existing.data.id);
        } catch (error) {
            return NextResponse.json({ error: error.message || 'Photo upload failed.' }, { status: 500 });
        }
        const oldPrimary = getPrimaryPhoto(existing.data);
        const newPrimary = photos[0] || '';
        const primaryChanged = Boolean(oldPrimary !== newPrimary);
        const shouldResetVerification = Boolean(primaryChanged && (existing.data.verified || existing.data.verification_status === 'verified'));
        const patch = {
            avatar_url: newPrimary,
            photos,
            show_in_public: Boolean(existing.data.show_in_public !== false && !existing.data.is_banned && !existing.data.is_suspended),
            updated_at: new Date().toISOString(),
        };
        if (shouldResetVerification) {
            Object.assign(patch, {
                verified: false,
                verification_status: 'reverify_required',
                verification_selfie_url: '',
                verification_document_url: '',
                verification_document_type: '',
                verification_phone: '',
                verification_submitted_at: null,
                verification_rejection_reason: 'Profile photo was changed or removed. User must resubmit verification.',
            });
        }
        let result = await supabase.from('users').update(patch).eq('id', existing.data.id).select(FULL_MEMBER_FIELDS).maybeSingle();
        if (result.error && ['42703', 'PGRST204'].includes(result.error.code)) {
            const fallbackPatch = { avatar_url: newPrimary, photos, show_in_public: patch.show_in_public };
            result = await supabase.from('users').update(fallbackPatch).eq('id', existing.data.id).select(BASIC_MEMBER_FIELDS).maybeSingle();
        }
        if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
        if (shouldResetVerification) {
            try {
                await supabase.from('user_notifications').insert({
                    user_id: existing.data.id,
                    type: 'verification',
                    title: 'Verification reset',
                    body: 'Your profile photo changed or was removed. Please submit a new selfie, ID/passport, and phone details for badge review.',
                });
            } catch {}
        }
        return NextResponse.json({ ok: true, member: normalizeMember(result.data || { ...existing.data, ...patch }, { canViewPhone: true, includeEmail: true }), verificationReset: shouldResetVerification });
    }

    if (action === 'oauth_account') {
        const email = String(body.email || '').trim().toLowerCase();
        if (!email || !email.includes('@')) return NextResponse.json({ error: 'A valid Google email is required.' }, { status: 400 });
        const deletedAccount = await deletedAccountRecord(supabase, email);
        if (deletedAccount.deleted) {
            return NextResponse.json({ error: 'This account was permanently deleted. Contact support if you need it restored.', accountStatus: 'deleted' }, { status: 410 });
        }
        const displayName = cleanDisplayName(body.display_name || body.name, email);
        let existing = await supabase.from('users').select(FULL_MEMBER_FIELDS).eq('email', email).maybeSingle();
        if (existing.error && ['42703', 'PGRST204'].includes(existing.error.code)) {
            existing = await supabase.from('users').select(BASIC_MEMBER_FIELDS).eq('email', email).maybeSingle();
        }
        if (existing.error && existing.error.code !== 'PGRST116') return NextResponse.json({ error: existing.error.message }, { status: 500 });
        if (existing.data?.id) {
            if (isAccountRestricted(existing.data)) {
                return NextResponse.json({
                    error: accountRestrictionMessage(existing.data) || 'Your account cannot be used right now.',
                    accountStatus: accountStatus(existing.data),
                    member: normalizeMember(existing.data, { canViewPhone: true, includeEmail: true }),
                }, { status: 403 });
            }
            const patch = {
                last_seen_at: new Date().toISOString(),
                last_seen: new Date().toISOString(),
                ...(body.auth_user_id && !existing.data.auth_user_id ? { auth_user_id: body.auth_user_id } : {}),
            };
            const seenUpdate = await supabase.from('users').update(patch).eq('id', existing.data.id);
            if (seenUpdate.error && ['42703', 'PGRST204'].includes(seenUpdate.error.code)) {
                await supabase.from('users').update({ last_seen_at: patch.last_seen_at, last_seen: patch.last_seen }).eq('id', existing.data.id);
            }
            return NextResponse.json({ ok: true, member: normalizeMember(existing.data, { canViewPhone: true, includeEmail: true }), createdAccount: false });
        }
        const payload = accountPayload({
            email,
            display_name: displayName,
            avatar_url: body.avatar_url || '',
            photos: body.avatar_url ? [body.avatar_url] : [],
            preference: body.preference || 'toyboy_looking_for_sugar_mummy',
        }, { fullSchema: true });
        payload.username = await uniqueUsername(supabase, body.username || displayName || email);
        let result = await supabase.from('users').insert(payload).select(FULL_MEMBER_FIELDS).maybeSingle();
        if (result.error && ['42703', 'PGRST204'].includes(result.error.code)) {
            const fallbackPayload = { ...payload };
            delete fallbackPayload.auth_user_id;
            delete fallbackPayload.username;
            result = await supabase.from('users').insert(fallbackPayload).select(BASIC_MEMBER_FIELDS).maybeSingle();
        }
        if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
        try {
            await supabase.from('user_settings').upsert({
                user_id: result.data.id,
                notifications: true,
                email_notifications: false,
                dark_mode: false,
                show_online: true,
                show_age: true,
                is_public: true,
                live_location: false,
                location_enabled: false,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });
        } catch {}
        const welcomeTitle = 'Welcome to Genuine Sugar Mummies';
        const welcomeBody = 'Your Google sign-in is ready. Complete your profile, upload a profile picture, submit manual verification, and choose a package to unlock more of the app. Basic unlocks unlimited messages, photo chat, 50 GS Credits, and one direct connection request after admin approval. Silver unlocks phone reveal, calls, GIFs, voice notes, activity insights, and stronger visibility.';
        try { await supabase.from('user_notifications').insert({ user_id: result.data.id, type: 'welcome', title: welcomeTitle, body: welcomeBody }); } catch {}
        await sendAndLogEmail(supabase, { to: email, subject: welcomeTitle, text: welcomeBody, html: emailHtml(welcomeTitle, welcomeBody) });
        return NextResponse.json({ ok: true, member: normalizeMember({ ...payload, ...(result.data || {}) }, { canViewPhone: true, includeEmail: true }), createdAccount: true });
    }

    if (action === 'submit_verification') {
        const email = String(body.email || '').trim().toLowerCase();
        const selfie = String(body.verification_selfie_url || '').trim();
        const documentUrl = String(body.verification_document_url || '').trim();
        const phone = String(body.verification_phone || body.phone_number || body.phone || '').trim();
        if (!email && !memberId) return NextResponse.json({ error: 'Sign in before submitting verification.' }, { status: 400 });
        if (!selfie || !documentUrl || !phone) return NextResponse.json({ error: 'Selfie, ID/passport, and phone number are required.' }, { status: 400 });

        const patch = {
            verification_status: 'pending_admin',
            verified: false,
            verification_selfie_url: selfie.slice(0, 2000000),
            verification_document_url: documentUrl.slice(0, 2000000),
            verification_document_type: String(body.verification_document_type || 'id').slice(0, 40),
            verification_phone: phone.slice(0, 40),
            phone_number: phone.slice(0, 40),
            phone: phone.slice(0, 40),
            verification_submitted_at: new Date().toISOString(),
            verification_rejection_reason: '',
        };

        let result;
        if (memberId) result = await supabase.from('users').update(patch).eq('id', memberId).select(FULL_MEMBER_FIELDS).maybeSingle();
        else result = await supabase.from('users').update(patch).eq('email', email).select(FULL_MEMBER_FIELDS).maybeSingle();

        if (result.error && ['42703', 'PGRST204'].includes(result.error.code)) {
            const fallbackPatch = { verification_status: 'pending_admin', verified: false, phone_number: phone.slice(0, 40), phone: phone.slice(0, 40) };
            result = memberId
                ? await supabase.from('users').update(fallbackPatch).eq('id', memberId).select(BASIC_MEMBER_FIELDS).maybeSingle()
                : await supabase.from('users').update(fallbackPatch).eq('email', email).select(BASIC_MEMBER_FIELDS).maybeSingle();
        }

        if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
        try { await supabase.from('admin_logs').insert({ action: 'verification_submitted', details: { userId: memberId || result.data?.id || null, email } }); } catch {}
        return NextResponse.json({ ok: true, member: normalizeMember(result.data || patch, { canViewPhone: true, includeEmail: true }) });
    }

    if (action === 'support_ticket') {
        const service = String(body.service || 'general').slice(0, 80);
        const email = String(body.email || '').trim().toLowerCase();
        let account = null;
        if (memberId) {
            const { data } = await supabase
                .from('users')
                .select('id, email, display_name')
                .eq('id', memberId)
                .maybeSingle();
            account = data || null;
        }
        if (!account?.id && email) {
            const { data } = await supabase
                .from('users')
                .select('id, email, display_name')
                .eq('email', email)
                .maybeSingle();
            account = data || null;
        }
        const recipientId = account?.id || memberId || null;
        const recipientEmail = account?.email || email;
        const recipientName = String(account?.display_name || body.display_name || body.senderName || 'Member').slice(0, 80);
        const ticketPayload = {
            user_id: recipientId,
            subject: String(body.subject || 'Support request').slice(0, 160),
            body: String(body.message || body.body || '').slice(0, 1200),
            message: String(body.message || body.body || '').slice(0, 1200),
            service,
            status: 'open',
            priority: String(body.priority || 'normal').slice(0, 40),
        };
        if (ticketPayload.body.length < 3) return NextResponse.json({ error: 'Support message is too short.' }, { status: 400 });
        let result = await supabase.from('support_tickets').insert(ticketPayload).select('id, subject, status, created_at').maybeSingle();
        if (result.error && ['42703', 'PGRST204'].includes(result.error.code)) {
            const fallbackPayload = { ...ticketPayload };
            delete fallbackPayload.service;
            delete fallbackPayload.body;
            result = await supabase.from('support_tickets').insert(fallbackPayload).select('id, subject, status, created_at').maybeSingle();
        }
        if (result.error && ['42703', 'PGRST204'].includes(result.error.code)) {
            const fallbackPayload2 = { ...ticketPayload };
            delete fallbackPayload2.service;
            delete fallbackPayload2.message;
            result = await supabase.from('support_tickets').insert(fallbackPayload2).select('id, subject, status, created_at').maybeSingle();
        }
        if (result.error && result.error.code !== 'PGRST205') return NextResponse.json({ error: result.error.message }, { status: 500 });
        const autoResponse = buildSupportAutoResponse(service, { name: recipientName, subject: ticketPayload.subject });
        const ticketId = result.data?.id || null;
        if (ticketId) {
            try {
                await supabase.from('ticket_responses').insert({
                    ticket_id: ticketId,
                    responder: autoResponse.senderLabel,
                    body: autoResponse.body,
                });
            } catch {}
        }
        if (recipientId) {
            try {
                await supabase.from('user_notifications').insert({
                    user_id: recipientId,
                    type: 'ticket_auto_response',
                    title: autoResponse.title,
                    body: autoResponse.body,
                    metadata: {
                        ticketId,
                        service: autoResponse.service,
                        team: autoResponse.team,
                        senderLabel: autoResponse.senderLabel,
                    },
                });
            } catch {}
        }
        if (recipientEmail) {
            await sendAndLogEmail(supabase, {
                to: recipientEmail,
                subject: autoResponse.title,
                text: autoResponse.body,
                html: emailHtml(autoResponse.title, autoResponse.body, {
                    preview: autoResponse.shortStatus,
                    actionUrl: '/alerts',
                    actionLabel: 'Open GS Inbox',
                }),
            });
        }
        try { await supabase.from('admin_logs').insert({ action: 'support_ticket_submitted', details: ticketPayload }); } catch {}
        return NextResponse.json({ ok: true, ticket: result.data || ticketPayload, autoResponse, persisted: !result.error });
    }

    if (action === 'request_package') {
        const tier = String(body.tier || 'basic').toLowerCase();
        const amount = tier === 'gold' ? 3550 : tier === 'silver' ? 1200 : 650;
        const paymentReference = String(body.payment_reference || '').trim();
        if (paymentReference.length < 3) return NextResponse.json({ error: 'Payment transaction ID is required before admin can approve a package.' }, { status: 400 });
        const requestPayload = {
            user_id: memberId || null,
            email: String(body.email || '').trim().toLowerCase(),
            display_name: String(body.display_name || body.senderName || 'Member').slice(0, 120),
            tier,
            amount_ksh: amount,
            status: 'pending',
            payment_reference: paymentReference.slice(0, 120),
            note: String(body.note || '').slice(0, 500),
        };
        const result = await supabase.from('package_requests').insert(requestPayload).select('id, tier, status, amount_ksh').maybeSingle();
        if (result.error && result.error.code !== 'PGRST205') return NextResponse.json({ error: result.error.message }, { status: 500 });
        const requestTitle = 'Package request received';
        const requestBody = `Your ${tier.toUpperCase()} package request with transaction ID ${paymentReference} is waiting for admin approval.`;
        if (memberId) {
            try { await supabase.from('user_notifications').insert({ user_id: memberId, type: 'package', title: requestTitle, body: requestBody }); } catch {}
        }
        if (requestPayload.email) await sendAndLogEmail(supabase, { to: requestPayload.email, subject: requestTitle, text: requestBody, html: emailHtml(requestTitle, requestBody) });
        try { await supabase.from('admin_logs').insert({ action: 'package_requested', details: requestPayload }); } catch {}
        return NextResponse.json({ ok: true, request: result.data || requestPayload, persisted: !result.error });
    }

    if (action === 'record_interaction') {
        const actorUserId = await resolveUserId();
        const profileKey = String(body.profileKey || body.savedKey || memberId || '').slice(0, 180);
        const kind = String(body.kind || body.interaction || 'view').slice(0, 40);
        const usageKind = kind === 'superlike' ? 'superlikes' : kind === 'like' ? 'likes' : kind === 'pass' || kind === 'swipe_pass' ? 'swipes' : kind === 'message' ? 'messages' : 'views';
        const quota = await enforceDailyLimit(supabase, actorUserId, usageKind);
        if (!quota.ok) return NextResponse.json({ error: quota.message || LIMIT_NOTICE, ...quota }, { status: quota.httpStatus || 402 });
        await recordInteraction(supabase, actorUserId, profileKey, kind, {
            profileName: body.profileName,
            profileImage: body.profileImage,
            isSuperLike: kind === 'superlike',
            metadata: { source: body.source || '', score: body.score || null },
        });
        return NextResponse.json({ ok: true, quota });
    }

    if (!action || !memberId) {
        return NextResponse.json({ error: 'Missing action or memberId.' }, { status: 400 });
    }

    if (action === 'like' || action === 'superlike') {
        const actorUserId = await resolveUserId();
        if (!memberId || !actorUserId) return NextResponse.json({ error: 'Signed-in user and member are required.' }, { status: 400 });
        if (memberId === actorUserId) return NextResponse.json({ error: 'You cannot like your own profile.' }, { status: 400 });
        const targetStatus = await ensureTargetAvailable(supabase, memberId);
        if (!targetStatus.ok) return NextResponse.json({ error: targetStatus.error }, { status: targetStatus.status || 404 });
        const quota = await enforceDailyLimit(supabase, actorUserId, action === 'superlike' ? 'superlikes' : 'likes');
        if (!quota.ok) return NextResponse.json({ error: quota.message || LIMIT_NOTICE, ...quota }, { status: quota.httpStatus || 402 });

        /**
         * Two kinds of target, handled differently.
         *
         * `member_likes.liked_id` is a UUID with a foreign key to users. Seeded and
         * WordPress profiles have ids like `seed-local-004`, which is not a UUID
         * and has no row — so the previous unconditional upsert raised a type
         * error and returned a 500. Since most discoverable profiles are seeded,
         * liking was broken for the common case, which is why `member_likes` had
         * zero rows despite the daily quota being spent on every attempt.
         *
         * Real members go into member_likes, where a trigger forms a match if the
         * like is returned. Every target, real or seeded, is recorded in the
         * interaction ledger so the member's own likes list is complete.
         */
        const { matched } = await recordMemberLike(supabase, actorUserId, memberId, {
            isSuperLike: action === 'superlike',
        });

        await recordInteraction(supabase, actorUserId, `member:${memberId}`, action, {
            profileName: body.profileName,
            profileImage: body.profileImage,
            isSuperLike: action === 'superlike',
            metadata: { score: body.score || null, source: 'member' },
        });

        // The like/match notifications for real members are raised by the database
        // trigger, so they fire however the like was created. Only seeded targets
        // need nothing here — there is nobody to notify.

        return NextResponse.json({ ok: true, quota, matched });
    }

    if (action === 'swipe_pass') {
        const actorUserId = await resolveUserId();
        if (!memberId || !actorUserId) return NextResponse.json({ error: 'Signed-in user and member are required.' }, { status: 400 });
        const targetStatus = await ensureTargetAvailable(supabase, memberId);
        if (!targetStatus.ok) return NextResponse.json({ error: targetStatus.error }, { status: targetStatus.status || 404 });
        const quota = await enforceDailyLimit(supabase, actorUserId, 'swipes');
        if (!quota.ok) return NextResponse.json({ error: quota.message || LIMIT_NOTICE, ...quota }, { status: quota.httpStatus || 402 });
        // `swiped_id` is a UUID column. Seeded ids such as `seed-local-004` are
        // not, and passing one raised a type error that surfaced as a 500 — on the
        // majority of profiles in the deck. The pass is always recorded in the
        // interaction ledger; the typed table only receives real members.
        let persisted = false;
        if (UUID_PATTERN.test(String(memberId))) {
            const result = await supabase.from('member_swipes').upsert({
                swiper_id: actorUserId,
                swiped_id: memberId,
                direction: 'pass',
            }, { onConflict: 'swiper_id,swiped_id' });
            if (result.error && result.error.code !== 'PGRST205') {
                console.error('[swipe_pass] member_swipes failed:', result.error.code, result.error.message);
            }
            persisted = !result.error;
        }
        await recordInteraction(supabase, actorUserId, `member:${memberId}`, 'pass', { metadata: { source: 'member' } });
        return NextResponse.json({ ok: true, quota, persisted });
    }

    if (action === 'save_profile') {
        const saverId = await resolveUserId();
        const savedKey = String(body.savedKey || memberId || '').slice(0, 160);
        if (!saverId || !savedKey) return NextResponse.json({ error: 'Signed-in user and saved profile are required.' }, { status: 400 });
        // Same UUID constraint as likes and passes: only a real member id can go
        // in `saved_member_id`. `saved_key` carries the seeded or WordPress
        // reference, which is what the saved list actually reads.
        const result = await supabase.from('member_saves').upsert({
            user_id: saverId,
            saved_member_id: UUID_PATTERN.test(String(memberId || '')) ? memberId : null,
            saved_key: savedKey,
            saved_name: String(body.savedName || '').slice(0, 120),
            saved_image: String(body.savedImage || '').slice(0, 500),
        }, { onConflict: 'user_id,saved_key' });
        if (result.error && result.error.code !== 'PGRST205') {
            console.error('[save_profile] member_saves failed:', result.error.code, result.error.message);
            return NextResponse.json({ error: result.error.message }, { status: 500 });
        }
        await recordInteraction(supabase, saverId, savedKey, 'save', {
            profileName: body.savedName,
            profileImage: body.savedImage,
            metadata: { source: body.source || (memberId ? 'member' : 'wp') },
        });
        return NextResponse.json({ ok: true, persisted: !result.error });
    }

    if (action === 'unsave_profile') {
        const saverId = await resolveUserId();
        const savedKey = String(body.savedKey || memberId || '').slice(0, 160);
        if (!saverId || !savedKey) return NextResponse.json({ error: 'Signed-in user and saved profile are required.' }, { status: 400 });
        const result = await supabase.from('member_saves').delete().eq('user_id', saverId).eq('saved_key', savedKey);
        if (result.error && result.error.code !== 'PGRST205') return NextResponse.json({ error: result.error.message }, { status: 500 });
        try { await supabase.from('user_interactions').delete().eq('user_id', saverId).eq('profile_key', savedKey).eq('action', 'save'); } catch {}
        return NextResponse.json({ ok: true, persisted: !result.error });
    }
    if (action === 'view') {
        const viewerId = await resolveUserId();
        if (String(memberId || '').startsWith('seed-local-')) {
            // Local seed profiles have no view ledger. Report nothing rather than
            // inventing a count — a made-up number is a popularity claim.
            return NextResponse.json({ ok: true, recorded: false, totalProfileViews: null });
        }
        const targetStatus = await ensureTargetAvailable(supabase, memberId);
        if (!targetStatus.ok) return NextResponse.json({ error: targetStatus.error }, { status: targetStatus.status || 404 });
        if (viewerId) {
            const quota = await enforceDailyLimit(supabase, viewerId, 'views');
            if (!quota.ok) return NextResponse.json({ error: quota.message || LIMIT_NOTICE, ...quota }, { status: quota.httpStatus || 402 });
            await recordInteraction(supabase, viewerId, `member:${memberId}`, 'view', { metadata: { source: 'member' } });
            try {
                await supabase.from('profile_views').insert({
                    viewed_id: memberId,
                    viewer_id: viewerId,
                    viewer_key: viewerId,
                    source: 'member',
                });
            } catch {}
        }
        const result = await incrementUserCounter(supabase, memberId, 'total_profile_views');
        if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
        return NextResponse.json({ ok: true, totalProfileViews: result.data?.total_profile_views || 0 });
    }

    if (action === 'follow') {
        const targetStatus = await ensureTargetAvailable(supabase, memberId);
        if (!targetStatus.ok) return NextResponse.json({ error: targetStatus.error }, { status: targetStatus.status || 404 });
        const existing = await supabase
            .from('member_follows')
            .select('id')
            .eq('follower_key', actorKey)
            .eq('followed_id', memberId)
            .maybeSingle();

        if (existing.data?.id) {
            await supabase.from('member_follows').delete().eq('id', existing.data.id);
            const { data: member } = await supabase.from('users').select('followers_count').eq('id', memberId).maybeSingle();
            const nextCount = Math.max(0, (member?.followers_count || 0) - 1);
            await supabase.from('users').update({ followers_count: nextCount }).eq('id', memberId);
            return NextResponse.json({ ok: true, following: false, followersCount: nextCount });
        }

        const inserted = await supabase.from('member_follows').insert({ follower_key: actorKey, followed_id: memberId });
        if (inserted.error && inserted.error.code !== 'PGRST205') return NextResponse.json({ error: inserted.error.message }, { status: 500 });
        const result = await incrementUserCounter(supabase, memberId, 'followers_count');
        return NextResponse.json({ ok: true, following: true, followersCount: result.data?.followers_count || 0, persisted: !inserted.error });
    }

    if (action === 'message') {
        const text = String(body.message || '').trim();
        let attachmentUrl = String(body.attachmentUrl || body.attachment_url || '').trim();
        const attachmentType = String(body.attachmentType || body.attachment_type || '').trim().toLowerCase().slice(0, 40);
        const attachmentName = String(body.attachmentName || body.attachment_name || '').trim().slice(0, 120);
        let voiceUrl = String(body.voiceUrl || body.voice_url || '').trim();
        if (text.length < 2 && !attachmentUrl && !voiceUrl) return NextResponse.json({ error: 'Message is too short.' }, { status: 400 });
        const senderUserId = await resolveUserId();
        const senderName = String(body.senderName || 'Member').slice(0, 80);
        const targetStatus = await ensureTargetAvailable(supabase, memberId);
        if (!targetStatus.ok) return NextResponse.json({ error: targetStatus.error }, { status: targetStatus.status || 404 });
        let senderTier = await getPackageTier(supabase, 'free');
        if (senderUserId) {
            const { data: sender } = await supabase
                .from('users')
                .select('id, subscription_tier, admin_approved, package_locked, is_banned, is_suspended, account_deleted_at')
                .eq('id', senderUserId)
                .maybeSingle();
            if (!sender?.id) return NextResponse.json({ error: 'Signed-in user was not found.' }, { status: 404 });
            if (isAccountRestricted(sender)) return NextResponse.json({ error: accountRestrictionMessage(sender), redirectTo: '/auth/login' }, { status: 403 });
            senderTier = await getPackageTier(supabase, activeTierId(sender));
        }
        if (attachmentUrl && attachmentType === 'image' && !canUseFeature(senderTier, 'images')) {
            return NextResponse.json({ error: 'Image sharing requires Basic package or higher.', redirectTo: '/packages' }, { status: 402 });
        }
        if (attachmentUrl && attachmentType === 'gif' && !canUseFeature(senderTier, 'gifs')) {
            return NextResponse.json({ error: 'GIF sharing requires Silver package or higher.', redirectTo: '/packages' }, { status: 402 });
        }
        if (attachmentUrl && !['image', 'gif'].includes(attachmentType) && !canUseFeature(senderTier, 'voiceNotes')) {
            return NextResponse.json({ error: 'Media sharing requires Silver package or higher.', redirectTo: '/packages' }, { status: 402 });
        }
        if (voiceUrl && !canUseFeature(senderTier, 'voiceNotes')) {
            return NextResponse.json({ error: 'Voice notes require Silver package or higher.', redirectTo: '/packages' }, { status: 402 });
        }
        const quota = await enforceDailyLimit(supabase, senderUserId, 'messages');
        if (!quota.ok) return NextResponse.json({ error: quota.message || LIMIT_NOTICE, ...quota }, { status: quota.httpStatus || 402 });
        attachmentUrl = await uploadMessageAsset(supabase, attachmentUrl, { ownerId: senderUserId || actorKey, type: attachmentType || 'attachment', name: attachmentName });
        voiceUrl = await uploadMessageAsset(supabase, voiceUrl, { ownerId: senderUserId || actorKey, type: 'voice_note', name: attachmentName || 'voice-note' });
        const messagePayload = {
            member_id: memberId,
            sender_key: actorKey,
            sender_name: senderName,
            body: (text || (voiceUrl ? 'Voice note' : attachmentType === 'image' ? 'Image message' : attachmentType === 'gif' ? `GIF: ${attachmentName || 'reaction'}` : 'Media message')).slice(0, 600),
            attachment_url: attachmentUrl.slice(0, 2000000),
            attachment_type: attachmentType,
            attachment_name: attachmentName,
            voice_url: voiceUrl.slice(0, 2000000),
        };
        let result = await supabase.from('member_messages').insert(messagePayload);
        if (result.error && ['42703', 'PGRST204'].includes(result.error.code)) {
            const fallbackPayload = { ...messagePayload };
            delete fallbackPayload.attachment_url;
            delete fallbackPayload.attachment_type;
            delete fallbackPayload.attachment_name;
            delete fallbackPayload.voice_url;
            result = await supabase.from('member_messages').insert(fallbackPayload);
        }
        if (result.error && result.error.code !== 'PGRST205') return NextResponse.json({ error: result.error.message }, { status: 500 });
        try {
            await supabase.from('user_notifications').insert({
                user_id: memberId,
                type: 'member_message',
                title: voiceUrl ? `New voice note from ${senderName}` : attachmentUrl ? `New media message from ${senderName}` : `New message from ${senderName}`,
                body: messagePayload.body,
                metadata: { senderUserId, senderKey: actorKey, attachmentType, attachmentName, hasVoice: Boolean(voiceUrl) },
            });
        } catch {}
        await recordInteraction(supabase, senderUserId, `member:${memberId}`, 'message', { profileName: body.profileName, metadata: { source: 'member', attachmentType, hasVoice: Boolean(voiceUrl) } });
        return NextResponse.json({ ok: true, quota, persisted: !result.error });
    }

    if (action === 'call_request') {
        const targetStatus = await ensureTargetAvailable(supabase, memberId);
        if (!targetStatus.ok) return NextResponse.json({ error: targetStatus.error }, { status: targetStatus.status || 404 });
        const callType = String(body.callType || 'voice').slice(0, 20);
        const requesterName = String(body.senderName || 'Member').slice(0, 80);
        const result = await supabase.from('call_requests').insert({
            member_id: memberId,
            requester_key: actorKey,
            requester_name: requesterName,
            call_type: callType,
            status: 'pending',
            note: String(body.note || '').slice(0, 240),
        });
        if (result.error && result.error.code !== 'PGRST205') return NextResponse.json({ error: result.error.message }, { status: 500 });
        try {
            await supabase.from('user_notifications').insert({
                user_id: memberId,
                type: 'call_request',
                title: `${callType === 'video' ? 'Video' : 'Voice'} call request`,
                body: `${requesterName} requested a ${callType} call. Admin can review the request.`,
                metadata: { requesterKey: actorKey },
            });
        } catch {}
        return NextResponse.json({ ok: true, persisted: !result.error });
    }

    if (action === 'gift') {
        const targetStatus = await ensureTargetAvailable(supabase, memberId);
        if (!targetStatus.ok) return NextResponse.json({ error: targetStatus.error }, { status: targetStatus.status || 404 });
        const giftName = String(body.giftName || 'Rose').slice(0, 80);
        const emoji = String(body.emoji || ':rose:').slice(0, 40);
        const senderName = String(body.senderName || 'Member').slice(0, 80);
        const result = await supabase.from('member_gifts').insert({
            member_id: memberId,
            sender_key: actorKey,
            gift_name: giftName,
            emoji,
            message: String(body.message || '').slice(0, 240),
        });
        if (result.error && result.error.code !== 'PGRST205') return NextResponse.json({ error: result.error.message }, { status: 500 });
        try {
            await supabase.from('user_notifications').insert({
                user_id: memberId,
                type: 'gift',
                title: `${senderName} sent a ${giftName}`,
                body: `${emoji} ${String(body.message || 'You received a gift.').slice(0, 240)}`,
                metadata: { senderKey: actorKey, giftName },
            });
        } catch {}
        const counter = await incrementUserCounter(supabase, memberId, 'gifts_received_count');
        return NextResponse.json({ ok: true, giftsReceivedCount: counter.data?.gifts_received_count || 0, persisted: !result.error });
    }

    return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
}
