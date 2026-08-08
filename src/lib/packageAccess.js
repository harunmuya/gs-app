const DEFAULT_TIERS = {
    free: {
        id: 'free',
        name: 'Free',
        price_ksh: 0,
        phone_reveal: false,
        daily_message_limit: 5,
        daily_gift_limit: 0,
        daily_like_limit: 5,
        daily_super_like_limit: 0,
        daily_swipe_limit: 10,
        daily_profile_view_limit: 10,
        priority_visibility: false,
        international_access: false,
        voice_video_access: false,
        can_see_who_liked: false,
        can_see_who_viewed: false,
        can_send_voice_notes: false,
        can_send_images: false,
        can_go_live: false,
        can_send_gifts: false,
        can_use_nearby: false,
        max_gift_tier: 0,
        starting_credits: 0,
        features: [],
    },
    basic: {
        id: 'basic',
        name: 'Basic',
        price_ksh: 650,
        phone_reveal: false,
        daily_message_limit: 0,
        daily_gift_limit: 10,
        daily_like_limit: 20,
        daily_super_like_limit: 5,
        daily_swipe_limit: 30,
        daily_profile_view_limit: 30,
        priority_visibility: false,
        international_access: false,
        voice_video_access: false,
        can_see_who_liked: false,
        can_see_who_viewed: false,
        can_send_voice_notes: false,
        can_send_images: true,
        can_go_live: false,
        can_send_gifts: true,
        can_use_nearby: false,
        max_gift_tier: 1,
        starting_credits: 50,
        features: [],
    },
    silver: {
        id: 'silver',
        name: 'Silver Recommended',
        price_ksh: 1200,
        phone_reveal: true,
        daily_message_limit: 0,
        daily_gift_limit: 50,
        daily_like_limit: 50,
        daily_super_like_limit: 100,
        daily_swipe_limit: 0,
        daily_profile_view_limit: 0,
        priority_visibility: true,
        international_access: false,
        voice_video_access: true,
        can_see_who_liked: true,
        can_see_who_viewed: true,
        can_send_voice_notes: true,
        can_send_images: true,
        can_go_live: true,
        can_send_gifts: true,
        can_use_nearby: true,
        max_gift_tier: 3,
        starting_credits: 200,
        features: [],
    },
    gold: {
        id: 'gold',
        name: 'Gold International',
        price_ksh: 3550,
        phone_reveal: true,
        daily_message_limit: 0,
        daily_gift_limit: 0,
        daily_like_limit: 0,
        daily_super_like_limit: 0,
        daily_swipe_limit: 0,
        daily_profile_view_limit: 0,
        priority_visibility: true,
        international_access: true,
        voice_video_access: true,
        can_see_who_liked: true,
        can_see_who_viewed: true,
        can_send_voice_notes: true,
        can_send_images: true,
        can_go_live: true,
        can_send_gifts: true,
        can_use_nearby: true,
        max_gift_tier: 4,
        starting_credits: 500,
        features: [],
    },
};

export const PACKAGE_ERROR_CODES = {
    ACCOUNT_RESTRICTED: 'ACCOUNT_RESTRICTED',
    PACKAGE_REQUIRED: 'PACKAGE_REQUIRED',
    PACKAGE_EXPIRED: 'PACKAGE_EXPIRED',
    FEATURE_NOT_INCLUDED: 'FEATURE_NOT_INCLUDED',
    DAILY_LIMIT_REACHED: 'DAILY_LIMIT_REACHED',
    PAYMENT_PENDING: 'PAYMENT_PENDING',
};

export function accountStatus(user = {}) {
    if (user.account_deleted_at || user.accountDeletedAt) return 'deleted';
    if (user.is_banned || user.isBanned) return 'banned';
    if (user.is_suspended || user.isSuspended) return 'suspended';
    return 'active';
}

export function isAccountRestricted(user = {}) {
    return accountStatus(user) !== 'active';
}

export function accountRestrictionMessage(user = {}) {
    const status = accountStatus(user);
    if (status === 'deleted') return 'This account has been deleted. Contact support if this was a mistake.';
    if (status === 'banned') return 'This account has been banned by admin.';
    if (status === 'suspended') return 'This account has been suspended by admin.';
    return '';
}

const FEATURE_LABELS = {
    messages: 'Messaging',
    phone: 'Phone number reveal',
    calls: 'Voice and video calls',
    voiceNotes: 'Voice notes',
    images: 'Image messages',
    gifs: 'GIF messages',
    live: 'Go Live',
    gifts: 'Gifts',
    nearby: 'Nearby discovery',
    likes: 'Likes',
    superlikes: 'Super Likes',
    swipes: 'Swipes',
    views: 'Profile views',
};

export function normalizeTierId(value) {
    const tier = String(value || 'free').toLowerCase();
    if (tier === 'diamond') return 'gold';
    return DEFAULT_TIERS[tier] ? tier : 'free';
}

export function activeTierId(user) {
    const tier = normalizeTierId(user?.subscription_tier || user?.subscriptionTier);
    if (tier === 'free') return 'free';
    const approved = user?.admin_approved ?? user?.adminApproved;
    if (approved === false) return 'free';
    const locked = Boolean(user?.package_locked || user?.packageLocked);
    if (locked) return 'free';
    const expiresAt = user?.package_expires_at || user?.packageExpiresAt;
    if (expiresAt) {
        const expiresMs = new Date(expiresAt).getTime();
        if (Number.isFinite(expiresMs) && expiresMs <= Date.now()) return 'free';
    }
    return tier;
}

function normalizePackageRow(row, tierId) {
    const fallback = DEFAULT_TIERS[tierId] || DEFAULT_TIERS.free;
    // Database values win over the built-in defaults. The defaults exist only to
    // fill columns a deployment has not configured yet.
    //
    // There used to be a line here forcing `daily_message_limit = 0` for every
    // paid tier. It silently discarded whatever an administrator had configured,
    // which is a large part of why the admin panel appeared to do nothing. The
    // limit is now whatever the row says.
    return {
        ...fallback,
        ...(row || {}),
        id: tierId,
        features: Array.isArray(row?.features) ? row.features : fallback.features,
        max_gift_tier: Number(row?.max_gift_tier ?? fallback.max_gift_tier ?? 0),
    };
}

export function normalizePackageTier(row) {
    return normalizePackageRow(row, normalizeTierId(row?.id));
}

export async function getPackageTier(supabase, tierId) {
    const normalized = normalizeTierId(tierId);
    if (!supabase) return normalizePackageRow(null, normalized);
    try {
        const { data, error } = await supabase
            .from('package_tiers')
            .select('*')
            .eq('id', normalized)
            .maybeSingle();
        if (error || !data) return normalizePackageRow(null, normalized);
        return normalizePackageRow(data, normalized);
    } catch {
        return normalizePackageRow(null, normalized);
    }
}

export async function getUserPackageAccess(supabase, user) {
    const tierId = activeTierId(user);
    const tier = await getPackageTier(supabase, tierId);
    return { tierId, tier, approved: tierId !== 'free' || normalizeTierId(user?.subscription_tier) === 'free' };
}

/**
 * The configured daily cap for a feature, or null when unlimited.
 *
 * A stored 0 or negative means unlimited — that is what the seeded rows already
 * mean (silver and gold carry 0 for unlimited messaging), so it is preserved.
 * Blocking a feature outright is expressed with the boolean flags below, not by
 * setting a limit of zero.
 */
export function dailyLimitForFeature(tier, feature) {
    const map = {
        messages: 'daily_message_limit',
        gifts: 'daily_gift_limit',
        likes: 'daily_like_limit',
        superlikes: 'daily_super_like_limit',
        swipes: 'daily_swipe_limit',
        views: 'daily_profile_view_limit',
    };
    const column = map[feature];
    if (!column) return null;
    const value = tier?.[column];
    if (value === null || value === undefined) return null;
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    return number <= 0 ? null : number;
}

export function canUseFeature(tier, feature) {
    if (!tier) return false;
    // Messaging is available to every tier; how much of it you get is the daily
    // limit's job, enforced in lib/entitlementGuard.
    //
    // This previously read `dailyLimitForFeature(tier, 'messages') !== 0`, which
    // could never be false: the helper returns null for any non-positive value
    // and never 0. It was a gate that always opened.
    if (feature === 'messages') return true;
    if (feature === 'phone') return Boolean(tier.phone_reveal);
    if (feature === 'calls') return Boolean(tier.voice_video_access);
    if (feature === 'voiceNotes') return Boolean(tier.can_send_voice_notes);
    if (feature === 'images') return Boolean(tier.can_send_images);
    if (feature === 'gifs') return Boolean(tier.can_send_voice_notes || tier.voice_video_access);
    if (feature === 'live') return Boolean(tier.can_go_live);
    if (feature === 'gifts') return Boolean(tier.can_send_gifts);
    if (feature === 'nearby') return Boolean(tier.can_use_nearby);
    return false;
}

export function featureLabel(feature) {
    return FEATURE_LABELS[feature] || 'This feature';
}

export function packageDenied(code, message, extra = {}) {
    return {
        ok: false,
        allowed: false,
        code,
        message,
        redirectTo: '/packages',
        ...extra,
    };
}

export function packageAllowed(extra = {}) {
    return {
        ok: true,
        allowed: true,
        code: null,
        message: '',
        ...extra,
    };
}

export async function evaluateFeatureAccess(supabase, user, feature) {
    if (!user?.id) {
        return packageDenied(PACKAGE_ERROR_CODES.PACKAGE_REQUIRED, 'Sign in to use this feature.');
    }
    if (isAccountRestricted(user)) {
        return packageDenied(PACKAGE_ERROR_CODES.ACCOUNT_RESTRICTED, accountRestrictionMessage(user) || 'Your account cannot use this feature right now.', { redirectTo: '/auth/login' });
    }

    const requestedTier = normalizeTierId(user?.subscription_tier || user?.subscriptionTier);
    const expiresAt = user?.package_expires_at || user?.packageExpiresAt;
    if (requestedTier !== 'free' && expiresAt) {
        const expiresMs = new Date(expiresAt).getTime();
        if (Number.isFinite(expiresMs) && expiresMs <= Date.now()) {
            return packageDenied(PACKAGE_ERROR_CODES.PACKAGE_EXPIRED, 'Your package has expired. Renew to continue.', { tierId: 'free', requestedTier });
        }
    }

    const access = await getUserPackageAccess(supabase, user);
    if (!canUseFeature(access.tier, feature)) {
        return packageDenied(
            access.tierId === 'free' ? PACKAGE_ERROR_CODES.PACKAGE_REQUIRED : PACKAGE_ERROR_CODES.FEATURE_NOT_INCLUDED,
            `${featureLabel(feature)} is not included in your current package.`,
            { tierId: access.tierId, requestedTier, feature }
        );
    }
    return packageAllowed({ tierId: access.tierId, tier: access.tier, feature });
}

export function defaultPackageTiers() {
    return [DEFAULT_TIERS.basic, DEFAULT_TIERS.silver, DEFAULT_TIERS.gold];
}

export function allDefaultPackageTiers() {
    return [DEFAULT_TIERS.free, DEFAULT_TIERS.basic, DEFAULT_TIERS.silver, DEFAULT_TIERS.gold];
}
