/**
 * What can be read with the publishable (anon) key right now.
 *
 * This is the only measurement that matters for the policy rebuild: not what the
 * SQL intended, but what an attacker holding the public key actually gets. Every
 * row returned here is a row `using (true)` handed over.
 *
 * Read-only. Uses the anon key exactly as a browser would.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
    readFileSync('.env.local', 'utf8')
        .split(/\r?\n/)
        .filter((l) => l && !l.startsWith('#') && l.includes('='))
        .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);

const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

/** Tables that hold something a member would consider private. */
const SENSITIVE = [
    'users', 'messages', 'conversations', 'direct_messages', 'direct_conversations',
    'message_attachments', 'voice_notes', 'user_notifications', 'notifications',
    'member_messages', 'call_sessions', 'call_signals', 'call_events', 'call_logs',
    'payment_requests', 'payment_events', 'wallet_transactions', 'credit_wallet',
    'user_settings', 'user_daily_usage', 'support_tickets', 'phone_view_requests',
    'profile_views', 'user_interactions', 'member_likes', 'member_saves',
    'story_views', 'story_likes', 'user_stories', 'live_viewers',
    'admin_logs', 'admin_attention_items', 'user_terms_acceptances',
];

/** Tables that are legitimately public reading. */
const PUBLIC_OK = ['package_tiers', 'gift_catalog', 'live_streams', 'live_comments', 'live_gifts'];

console.log('Reading with the ANON key — what the public key exposes today\n');

let exposedTables = 0;
let exposedRows = 0;
const findings = [];

for (const table of [...SENSITIVE, ...PUBLIC_OK]) {
    const isSensitive = SENSITIVE.includes(table);
    const { count: realCount } = await admin.from(table).select('*', { count: 'exact', head: true });
    if (realCount === null || realCount === undefined) continue; // table absent

    const { data, count, error } = await anon.from(table).select('*', { count: 'exact' }).limit(1);
    const readable = !error && (count ?? 0) > 0;

    if (isSensitive && readable) {
        exposedTables++;
        exposedRows += count;
        findings.push({ table, count, sample: data?.[0] });
        console.log(`  EXPOSED  ${table.padEnd(24)} ${String(count).padStart(5)} rows readable (of ${realCount})`);
    } else if (isSensitive) {
        console.log(`  locked   ${table.padEnd(24)} ${String(realCount).padStart(5)} rows, anon sees ${count ?? 0}`);
    } else {
        console.log(`  public   ${table.padEnd(24)} ${String(count ?? 0).padStart(5)} readable — intended`);
    }
}

console.log(`\n${exposedTables} sensitive table(s) readable with the public key, ${exposedRows} rows total`);

if (findings.length) {
    console.log('\nWhat is actually in reach — first row of each, field names only:');
    for (const f of findings.slice(0, 8)) {
        const keys = Object.keys(f.sample || {});
        const alarming = keys.filter((k) => /email|phone|body|content|token|password|reference|amount|secret/i.test(k));
        console.log(`  ${f.table}: ${alarming.length ? alarming.join(', ') : keys.slice(0, 6).join(', ')}`);
    }
}

console.log(exposedTables
    ? '\nThis is what the consolidated policy migration closes.'
    : '\nNothing sensitive is exposed to the public key.');
