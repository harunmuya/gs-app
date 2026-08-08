import { dailyLimitForFeature, getPackageTier, activeTierId, isAccountRestricted, accountRestrictionMessage, accountStatus } from '@/lib/packageAccess';

/**
 * The single place a daily quota is consumed.
 *
 * There were three separate implementations of this — in api/members, api/chat,
 * and api/wallet — and they had already drifted apart in their handling of zero
 * limits and of errors. Three copies of a paid-feature gate is three chances to
 * get it wrong, so they are replaced by this one.
 *
 * Two behaviours differ deliberately from what they did:
 *
 *  - **It is atomic.** The old code ran SELECT count, compared, then UPDATE. Two
 *    concurrent requests both read 4, both saw 4 < 5, and both wrote 5. Counting
 *    now happens inside `consume_daily_quota` in Postgres, which increments and
 *    checks the cap in a single guarded statement.
 *
 *  - **It fails closed.** A missing table or any query error used to return
 *    "allowed" and skip counting, so a database problem handed out unlimited paid
 *    features. Anything unexpected now denies, because wrongly refusing a member
 *    a like is recoverable and silently giving away the product is not.
 */

const LIMIT_NOTICE = 'Daily limit reached for your package. Upgrade for more, or try again tomorrow.';

/** 0 or NULL means unlimited — see the migration for why that mapping is kept. */
function isUnlimited(limit) {
    return limit === null || limit === undefined || Number(limit) <= 0;
}

export function quotaAllowed(extra = {}) {
    return { ok: true, allowed: true, limit: null, used: null, remaining: null, ...extra };
}

export function quotaDenied(message, extra = {}) {
    return {
        ok: false,
        allowed: false,
        code: 'DAILY_LIMIT_REACHED',
        message: message || LIMIT_NOTICE,
        redirectTo: '/packages',
        httpStatus: 402,
        ...extra,
    };
}

/**
 * Consume one unit of `kind` for `user`, honouring their tier's configured limit.
 *
 * `user` must be the row resolved from the session, never a client-supplied id.
 * Pass a pre-loaded `tier` when the caller already has one, to avoid re-reading
 * package_tiers on every action.
 *
 * Returns `{ ok, limit, used, remaining }` on success, or `{ ok: false, message,
 * httpStatus }` describing the refusal.
 */
export async function consumeQuota(supabase, user, kind, { tier = null } = {}) {
    if (!supabase || !user?.id || !kind) {
        return quotaDenied('Sign in to use this feature.', { code: 'UNAUTHENTICATED', httpStatus: 401 });
    }

    if (isAccountRestricted(user)) {
        return quotaDenied(accountRestrictionMessage(user) || 'Your account cannot use this feature right now.', {
            code: 'ACCOUNT_RESTRICTED',
            accountStatus: accountStatus(user),
            redirectTo: '/auth/login',
            httpStatus: 403,
        });
    }

    const resolvedTier = tier || await getPackageTier(supabase, activeTierId(user));
    const limit = dailyLimitForFeature(resolvedTier, kind);

    if (isUnlimited(limit)) {
        return quotaAllowed({ tierId: resolvedTier?.id || 'free', unlimited: true });
    }

    try {
        const { data, error } = await supabase.rpc('consume_daily_quota', {
            p_user_id: user.id,
            p_kind: kind,
            p_limit: Number(limit),
        });

        if (error) {
            // Fail closed. Previously this branch returned "allowed", so a broken
            // database was the most permissive state the system could be in.
            console.error('[consumeQuota] rpc failed:', kind, error.message);
            return quotaDenied('We could not verify your daily allowance. Please try again shortly.', {
                code: 'QUOTA_UNAVAILABLE',
                httpStatus: 503,
            });
        }

        const row = Array.isArray(data) ? data[0] : data;
        if (!row) {
            return quotaDenied('We could not verify your daily allowance. Please try again shortly.', {
                code: 'QUOTA_UNAVAILABLE',
                httpStatus: 503,
            });
        }

        if (!row.allowed) {
            return quotaDenied(LIMIT_NOTICE, {
                tierId: resolvedTier?.id || 'free',
                limit: Number(row.quota),
                used: Number(row.used),
                remaining: 0,
            });
        }

        return quotaAllowed({
            tierId: resolvedTier?.id || 'free',
            limit: Number(row.quota),
            used: Number(row.used),
            remaining: Math.max(0, Number(row.quota) - Number(row.used)),
        });
    } catch (error) {
        console.error('[consumeQuota] threw:', kind, error?.message);
        return quotaDenied('We could not verify your daily allowance. Please try again shortly.', {
            code: 'QUOTA_UNAVAILABLE',
            httpStatus: 503,
        });
    }
}

/**
 * Today's usage for a set of kinds, without consuming anything.
 * Used to show members what they have left rather than making them discover it
 * by hitting a wall.
 */
export async function peekQuotas(supabase, user, kinds = [], { tier = null } = {}) {
    if (!supabase || !user?.id) return {};
    const resolvedTier = tier || await getPackageTier(supabase, activeTierId(user));
    const out = {};

    await Promise.all(kinds.map(async (kind) => {
        const limit = dailyLimitForFeature(resolvedTier, kind);
        if (isUnlimited(limit)) {
            out[kind] = { limit: null, used: 0, remaining: null, unlimited: true };
            return;
        }
        try {
            const { data, error } = await supabase.rpc('peek_daily_quota', {
                p_user_id: user.id,
                p_kind: kind,
            });
            const used = error ? 0 : Number(data || 0);
            out[kind] = {
                limit: Number(limit),
                used,
                remaining: Math.max(0, Number(limit) - used),
                unlimited: false,
            };
        } catch {
            out[kind] = { limit: Number(limit), used: 0, remaining: Number(limit), unlimited: false };
        }
    }));

    return out;
}
