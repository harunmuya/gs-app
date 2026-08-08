import { apiError, apiOk, ERROR_CODES } from '@/lib/apiContract';
import { createServerSupabaseClient } from '@/lib/supabaseAdmin';
import { accountRestrictionMessage, canUseFeature, dailyLimitForFeature, evaluateFeatureAccess, getUserPackageAccess, isAccountRestricted } from '@/lib/packageAccess';
import { requireMember } from '@/lib/authSession';

export const dynamic = 'force-dynamic';

const USER_FIELDS = 'id, subscription_tier, package_locked, package_expires_at, is_banned, is_suspended, account_deleted_at, admin_approved';

async function loadUser(supabase, userId) {
    if (!userId) return null;
    const { data } = await supabase
        .from('users')
        .select(USER_FIELDS)
        .eq('id', userId)
        .maybeSingle();
    return data || null;
}

function accessPayload(access) {
    const tier = access.tier || {};
    return {
        tierId: access.tierId,
        approved: access.approved,
        features: {
            messages: true,
            phone: Boolean(tier.phone_reveal),
            calls: Boolean(tier.voice_video_access),
            voiceNotes: Boolean(tier.can_send_voice_notes),
            images: Boolean(tier.can_send_images),
            gifs: canUseFeature(tier, 'gifs'),
            live: Boolean(tier.can_go_live),
            gifts: Boolean(tier.can_send_gifts),
            nearby: Boolean(tier.can_use_nearby),
            whoLiked: Boolean(tier.can_see_who_liked),
            whoViewed: Boolean(tier.can_see_who_viewed),
            priorityVisibility: Boolean(tier.priority_visibility),
            international: Boolean(tier.international_access),
        },
        dailyLimits: {
            messages: dailyLimitForFeature(tier, 'messages'),
            gifts: dailyLimitForFeature(tier, 'gifts'),
            likes: dailyLimitForFeature(tier, 'likes'),
            superlikes: dailyLimitForFeature(tier, 'superlikes'),
            swipes: dailyLimitForFeature(tier, 'swipes'),
            views: dailyLimitForFeature(tier, 'views'),
        },
    };
}

export async function GET(request) {
    const supabase = createServerSupabaseClient({ admin: true });
    if (!supabase) return apiError(ERROR_CODES.SERVER_MISCONFIGURED, 'Supabase admin env missing.', 503);
    // Entitlements are reported for the signed-in member only. Accepting ?userId=
    // let anyone read another member's package state.
    const { member, response } = await requireMember();
    if (response) return response;
    const userId = member.id;
    const user = await loadUser(supabase, userId);
    if (!user?.id) return apiError(ERROR_CODES.NOT_FOUND, 'User was not found.', 404);
    if (isAccountRestricted(user)) return apiError('ACCOUNT_RESTRICTED', accountRestrictionMessage(user), 403, { redirectTo: '/auth/login' });
    const access = await getUserPackageAccess(supabase, user);
    return apiOk({ userId, entitlement: accessPayload(access) });
}

export async function POST(request) {
    const supabase = createServerSupabaseClient({ admin: true });
    if (!supabase) return apiError(ERROR_CODES.SERVER_MISCONFIGURED, 'Supabase admin env missing.', 503);
    const body = await request.json().catch(() => ({}));
    const { member, response } = await requireMember();
    if (response) return response;
    const userId = member.id;
    const feature = body.feature;
    if (!feature) return apiError(ERROR_CODES.BAD_REQUEST, 'feature is required.', 400);
    const user = await loadUser(supabase, userId);
    if (!user?.id) return apiError(ERROR_CODES.NOT_FOUND, 'User was not found.', 404);
    const result = await evaluateFeatureAccess(supabase, user, feature);
    if (!result.allowed) {
        const status = result.code === 'ACCOUNT_RESTRICTED' ? 403 : 402;
        return apiError(result.code, result.message, status, {
            redirectTo: result.redirectTo,
            tierId: result.tierId,
            feature,
        });
    }
    return apiOk({ userId, feature, allowed: true, tierId: result.tierId });
}
