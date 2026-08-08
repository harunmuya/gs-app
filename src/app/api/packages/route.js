import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseAdmin';
import { activeTierId, defaultPackageTiers, getPackageTier, normalizePackageTier, normalizeTierId } from '@/lib/packageAccess';
import { getSessionMember } from '@/lib/authSession';
import { peekQuotas } from '@/lib/entitlementGuard';

/**
 * Package catalogue, plus — for a signed-in member — what they actually have.
 *
 * Previously this returned the catalogue alone, so the packages page could only
 * show marketing copy. A member could not see which tier they were on, what they
 * had used today, or what an upgrade would concretely change. Everything shown to
 * them was static text that had no connection to the entitlement layer enforcing
 * their account.
 *
 * The tier list comes from `package_tiers`, the same table enforcement reads, so
 * what a member is shown and what the server allows cannot drift apart.
 */

const QUOTA_KINDS = ['messages', 'likes', 'superlikes', 'swipes', 'views', 'gifts'];

export async function GET() {
    const supabase = createServerSupabaseClient({ admin: true });
    if (!supabase) {
        return NextResponse.json({ ok: true, packages: defaultPackageTiers(), current: null, usage: {} });
    }

    /**
     * Catalogue rows.
     *
     * This used to filter `.eq('is_active', true)`. Where the column is NULL —
     * which it is for rows created before `is_active` was added — that matched
     * nothing, the query returned empty, and the route silently fell back to the
     * hardcoded DEFAULT_TIERS. Enforcement meanwhile reads the same table through
     * `getPackageTier`, which has no such filter, so it used the real rows.
     *
     * The result was one endpoint reporting two different limits for the same
     * tier: the catalogue showed the built-in defaults while the quota figures
     * showed the database. A member could be shown a package that does not match
     * what they would actually get, and an administrator's edits would appear to
     * have no effect on the pricing page.
     *
     * NULL is now treated as active, and the fallback is reported rather than
     * hidden so this cannot drift again unnoticed.
     */
    let packages;
    let source = 'database';
    try {
        // First choice: filter to active tiers in configured order.
        let { data, error } = await supabase
            .from('package_tiers')
            .select('*')
            .or('is_active.is.null,is_active.eq.true')
            .in('id', ['basic', 'silver', 'gold'])
            .order('sort_order', { ascending: true });

        // Some deployments predate `is_active` / `sort_order`. Postgres reports
        // 42703 (undefined column) and the whole query fails — which previously
        // dropped the route to hardcoded defaults without a word, so the pricing
        // page and the enforcement layer disagreed indefinitely. Retry on the
        // plain columns instead of giving up on the database.
        if (error && (error.code === '42703' || /does not exist/i.test(error.message || ''))) {
            console.warn('[api/packages] package_tiers is missing is_active/sort_order; retrying without them. Run migration 20260808_040.');
            ({ data, error } = await supabase
                .from('package_tiers')
                .select('*')
                .in('id', ['basic', 'silver', 'gold']));
            if (!error && data?.length) {
                const rank = { basic: 1, silver: 2, gold: 3 };
                data = [...data].sort((a, b) => (rank[a.id] || 99) - (rank[b.id] || 99));
            }
        }

        if (error || !data?.length) {
            if (error) console.error('[api/packages] tier query failed:', error.message);
            else console.warn('[api/packages] no package_tiers rows; serving built-in defaults');
            packages = defaultPackageTiers();
            source = 'defaults';
        } else {
            packages = data.map(normalizePackageTier);
        }
    } catch (err) {
        console.error('[api/packages] tier query threw:', err?.message);
        packages = defaultPackageTiers();
        source = 'defaults';
    }

    // Anonymous callers get the catalogue only.
    const member = await getSessionMember({
        fields: 'id, subscription_tier, package_expires_at, admin_approved, package_locked, is_banned, is_suspended, account_deleted_at',
    });
    if (!member?.id) {
        return NextResponse.json({ ok: true, packages, source, current: null, usage: {} });
    }

    const effectiveTierId = activeTierId(member);
    const effectiveTier = await getPackageTier(supabase, effectiveTierId);
    const usage = await peekQuotas(supabase, member, QUOTA_KINDS, { tier: effectiveTier });

    // `requested` is what they bought; `effective` is what they are actually
    // getting. They differ when a package is unapproved, locked, or expired —
    // and a member is entitled to see which, instead of quietly getting less.
    const requestedTierId = normalizeTierId(member.subscription_tier);
    const expiresAt = member.package_expires_at || null;
    const expired = Boolean(expiresAt && new Date(expiresAt).getTime() <= Date.now());

    return NextResponse.json({
        ok: true,
        packages,
        // 'database' or 'defaults' — lets the client and logs tell a configured
        // catalogue apart from a fallback that would otherwise look identical.
        source,
        current: {
            requestedTierId,
            effectiveTierId,
            downgraded: requestedTierId !== effectiveTierId,
            reason: requestedTierId === effectiveTierId ? null
                : expired ? 'expired'
                : member.package_locked ? 'locked'
                : member.admin_approved === false ? 'awaiting_approval'
                : 'inactive',
            expiresAt,
            entitlements: {
                phoneReveal: Boolean(effectiveTier.phone_reveal),
                calls: Boolean(effectiveTier.voice_video_access),
                gifts: Boolean(effectiveTier.can_send_gifts),
                images: Boolean(effectiveTier.can_send_images),
                voiceNotes: Boolean(effectiveTier.can_send_voice_notes),
                live: Boolean(effectiveTier.can_go_live),
                whoLiked: Boolean(effectiveTier.can_see_who_liked),
                whoViewed: Boolean(effectiveTier.can_see_who_viewed),
                nearby: Boolean(effectiveTier.can_use_nearby),
                priorityVisibility: Boolean(effectiveTier.priority_visibility),
                international: Boolean(effectiveTier.international_access),
            },
        },
        usage,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
}
