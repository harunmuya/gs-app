/**
 * What has actually been applied to the database, checked by probing for the
 * objects each migration creates rather than by reading a migrations table.
 *
 * Several migrations in this project were partially applied, superseded, or run
 * out of order, so a ledger of filenames would not have told the truth. Probing
 * for the object is the only answer that matches reality.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
    readFileSync('.env.local', 'utf8')
        .split(/\r?\n/)
        .filter((l) => l && !l.startsWith('#') && l.includes('='))
        .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

const tableExists = async (t) => {
    const { error } = await db.from(t).select('*', { head: true, count: 'exact' }).limit(1);
    return !error;
};
const columnExists = async (t, c) => {
    const { error } = await db.from(t).select(c, { head: true, count: 'exact' }).limit(1);
    return !error;
};
const rpcExists = async (fn, args) => {
    const { error } = await db.rpc(fn, args);
    return !(error && /schema cache|does not exist/i.test(error.message));
};
/** Anon must NOT be able to read these. */
const anonBlocked = async (t) => {
    const { count, error } = await anon.from(t).select('*', { count: 'exact', head: true });
    return Boolean(error) || (count ?? 0) === 0;
};

const CHECKS = [
    ['020 seed labels', 'SEED_LABELS_RECONCILED env flag', async () => 'manual'],
    ['030 seed metrics', 'seeded counters zeroed', async () => {
        const { data } = await db.from('users').select('total_profile_views,followers_count').eq('is_seed_profile', true).limit(50);
        return !data?.length || data.every((u) => !u.total_profile_views && !u.followers_count);
    }],
    ['040 entitlements', 'consume_daily_quota', () => rpcExists('consume_daily_quota', { p_user_id: '00000000-0000-0000-0000-000000000000', p_kind: 'likes', p_limit: 1 })],
    ['040 entitlements', 'peek_daily_quota', () => rpcExists('peek_daily_quota', { p_user_id: '00000000-0000-0000-0000-000000000000', p_kind: 'likes' })],
    ['040 entitlements', 'package_tiers.is_active', () => columnExists('package_tiers', 'is_active')],
    ['050 payments', 'payment_requests table', () => tableExists('payment_requests')],
    ['000 security reset', 'users closed to anon', () => anonBlocked('users')],
    ['000 security reset', 'messages closed to anon', () => anonBlocked('messages')],
    ['000 security reset', 'conversations closed to anon', () => anonBlocked('conversations')],
    ['000 security reset', 'notifications closed to anon', () => anonBlocked('notifications')],
    ['010 swipes', 'user_interactions table', () => tableExists('user_interactions')],
    ['010 swipes', 'member_matches table', () => tableExists('member_matches')],
    ['020 matches', 'member_matches.is_super_match', () => columnExists('member_matches', 'is_super_match')],
    ['080 notifications', 'legacy notifications carried over', async () => {
        const { count } = await db.from('user_notifications').select('*', { count: 'exact', head: true });
        return (count ?? 0) > 380;
    }],
];

console.log('Probing the database for what each migration creates\n');

let applied = 0;
let pending = 0;
let manual = 0;

for (const [migration, what, probe] of CHECKS) {
    const result = await probe();
    if (result === 'manual') { manual++; console.log(`  ????  ${migration.padEnd(22)} ${what}`); continue; }
    if (result) { applied++; console.log(`  yes   ${migration.padEnd(22)} ${what}`); }
    else { pending++; console.log(`  NO    ${migration.padEnd(22)} ${what}`); }
}

console.log(`\n${applied} applied, ${pending} still pending${manual ? `, ${manual} needs a manual check` : ''}`);

if (pending) {
    console.log('\nAnything marked NO above is a migration whose objects are absent.');
    console.log('See docs/audit/MIGRATION-RUNBOOK.md for the order.');
}
