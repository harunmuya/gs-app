/**
 * Do the daily limits actually hold, and do they lift when a package unlocks?
 *
 * Two questions that only matter together. A limit that never blocks is not a
 * limit; a limit that blocks after payment is worse than no limit at all,
 * because somebody paid to remove it.
 *
 * This drives the real consumeQuota against a real account, one call at a time,
 * and reports where it actually stops. Every usage row it creates is deleted.
 */
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
    readFileSync('.env.local', 'utf8')
        .split(/\r?\n/)
        .filter((l) => l && !l.startsWith('#') && l.includes('='))
        .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

const { consumeQuota } = await import(pathToFileURL(resolve('src/lib/entitlementGuard.js')).href);
const { getPackageTier, dailyLimitForFeature } = await import(pathToFileURL(resolve('src/lib/packageAccess.js')).href);

const today = new Date().toISOString().slice(0, 10);
let pass = 0;
let fail = 0;
const check = (label, ok, detail = '') => {
    if (ok) { pass++; console.log(`  ok    ${label}${detail ? `  ${detail}` : ''}`); }
    else { fail++; console.log(`  FAIL  ${label}${detail ? `  ${detail}` : ''}`); }
};

/** Wipe today's usage for one account so each scenario starts clean. */
async function resetUsage(userId) {
    await db.from('user_daily_usage').delete().eq('user_id', userId).eq('usage_date', today);
}

/** Call consumeQuota until it refuses, and report how many got through. */
async function drain(subject, kind, tier, ceiling = 60) {
    let allowed = 0;
    for (let i = 0; i < ceiling; i++) {
        const result = await consumeQuota(db, subject, kind, { tier });
        if (!result.allowed) return { allowed, blockedAt: i + 1, message: result.message || '' };
        allowed++;
    }
    return { allowed, blockedAt: null, message: '' };
}

const { data: account } = await db
    .from('users')
    .select('id, display_name, subscription_tier')
    .eq('is_seed_profile', false)
    .is('account_deleted_at', null)
    .limit(1)
    .maybeSingle();

if (!account?.id) {
    console.error('No account to test with.');
    process.exit(1);
}

console.log(`Testing against ${account.display_name} (usage rows are removed afterwards)\n`);

try {
    for (const tierId of ['free', 'basic', 'silver', 'gold']) {
        const tier = await getPackageTier(db, tierId);
        console.log(`--- ${tierId}`);

        for (const kind of ['likes', 'swipes', 'messages', 'gifts']) {
            const configured = dailyLimitForFeature(tier, kind);
            await resetUsage(account.id);
            const subject = { id: account.id, subscription_tier: tierId, admin_approved: true };
            const ceiling = configured === null ? 12 : configured + 3;
            const { allowed, blockedAt } = await drain(subject, kind, tier, ceiling);

            if (configured === null) {
                // Unlimited. Nothing should refuse within a reasonable run.
                check(`${kind.padEnd(9)} unlimited`, blockedAt === null, `${allowed} allowed, never blocked`);
            } else {
                check(
                    `${kind.padEnd(9)} limit ${configured}`,
                    allowed === configured,
                    `${allowed} allowed${blockedAt ? `, blocked on ${blockedAt}` : ', NEVER BLOCKED'}`,
                );
            }
        }
        console.log('');
    }

    // The question that matters after payment: does an upgrade actually lift it?
    console.log('--- unlock behaviour');
    const freeTier = await getPackageTier(db, 'free');
    const silverTier = await getPackageTier(db, 'silver');
    const freeLimit = dailyLimitForFeature(freeTier, 'likes');

    await resetUsage(account.id);
    const asFree = { id: account.id, subscription_tier: 'free', admin_approved: true };
    const drained = await drain(asFree, 'likes', freeTier, freeLimit + 2);
    // Blocking on the very first call means consumeQuota fell back to its
    // fail-closed path, not that the limit was reached. Reporting that as a pass
    // would hide a total outage behind a green tick.
    const reachedLimit = drained.allowed > 0 && drained.blockedAt !== null;
    check('free account is blocked once its likes run out', reachedLimit,
        drained.allowed === 0 ? 'blocked on the FIRST call — the quota RPC is missing, not a limit' : `${drained.allowed} allowed, blocked on ${drained.blockedAt}`);

    // Same account, same day, same used-up counter, now on Silver.
    const asSilver = { id: account.id, subscription_tier: 'silver', admin_approved: true };
    const afterUpgrade = await consumeQuota(db, asSilver, 'likes', { tier: silverTier });
    check('the same account can like again after upgrading', afterUpgrade.allowed,
        afterUpgrade.allowed ? '(limit lifted without clearing usage)' : `(still blocked: ${afterUpgrade.message})`);

    // And an unapproved paid account must not get paid limits.
    await resetUsage(account.id);
    const unapproved = { id: account.id, subscription_tier: 'silver', admin_approved: false };
    const unapprovedDrain = await drain(unapproved, 'likes', freeTier, freeLimit + 2);
    check('an unapproved Silver is still held to free limits',
        unapprovedDrain.allowed > 0 && unapprovedDrain.blockedAt !== null,
        unapprovedDrain.allowed === 0 ? 'blocked on the FIRST call — quota RPC missing' : `${unapprovedDrain.allowed} allowed, blocked on ${unapprovedDrain.blockedAt}`);
} finally {
    await resetUsage(account.id);
    console.log('\n  usage rows removed');
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
}
