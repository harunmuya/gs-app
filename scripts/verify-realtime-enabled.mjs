/**
 * Is Supabase Realtime actually delivering changes for the call and live tables?
 *
 * Both features subscribe to postgres_changes and fall back to polling. Polling
 * works, but it decides whether a call negotiates in under a second or in a
 * second and a bit, and whether a live comment appears instantly or up to eight
 * seconds later. The only reliable answer is to subscribe and insert.
 *
 * Subscribes with the ANON key, because that is what the browser uses — a table
 * in the publication but blocked by RLS delivers nothing to a real client, and
 * testing with the service role would hide that.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
    readFileSync('.env.local', 'utf8')
        .split(/\r?\n/)
        .filter((line) => line && !line.startsWith('#') && line.includes('='))
        .map((line) => {
            const i = line.indexOf('=');
            return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
        })
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;

const listener = createClient(url, anon, { auth: { persistSession: false } });
const writer = createClient(url, service, { auth: { persistSession: false } });

const WAIT_MS = 6000;

async function testTable(table, makeRow, cleanup) {
    return new Promise(async (resolve) => {
        let received = false;
        let createdId = null;

        const channel = listener
            .channel(`probe-${table}-${Date.now()}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table }, () => { received = true; })
            .subscribe(async (state) => {
                if (state !== 'SUBSCRIBED') return;
                const row = await makeRow();
                createdId = row?.id || null;
                if (!row) {
                    console.log(`  ????  ${table.padEnd(15)} could not insert a probe row`);
                    await listener.removeChannel(channel);
                    return resolve(null);
                }
                setTimeout(async () => {
                    await listener.removeChannel(channel);
                    if (createdId) await cleanup(createdId);
                    console.log(`  ${received ? 'LIVE ' : 'off  '} ${table.padEnd(15)} ${received ? 'realtime delivers to the anon client' : 'no event in 6s — falls back to polling'}`);
                    resolve(received);
                }, WAIT_MS);
            });
    });
}

const { data: members } = await writer.from('users').select('id').eq('is_seed_profile', false).is('account_deleted_at', null).limit(2);
const [a, b] = members || [];
if (!a?.id || !b?.id) { console.error('Need two real members.'); process.exit(1); }

// One scratch call session and stream to hang the child rows off.
const { data: call } = await writer.from('call_sessions').insert({ caller_id: a.id, receiver_id: b.id, call_type: 'voice', status: 'ringing' }).select('id').maybeSingle();
const { data: stream } = await writer.from('live_streams').insert({ host_id: a.id, title: 'realtime probe', is_active: true, started_at: new Date().toISOString(), updated_at: new Date().toISOString() }).select('id').maybeSingle();

console.log('Probing realtime with the anon key (what the browser uses)\n');

const results = {};
results.call_signals = await testTable(
    'call_signals',
    async () => (await writer.from('call_signals').insert({ call_session_id: call.id, sender_id: a.id, receiver_id: b.id, type: 'ice', signal_type: 'ice', payload: {} }).select('id').maybeSingle()).data,
    async (id) => { await writer.from('call_signals').delete().eq('id', id); },
);
results.call_sessions = await testTable(
    'call_sessions',
    async () => (await writer.from('call_sessions').insert({ caller_id: b.id, receiver_id: a.id, call_type: 'voice', status: 'ringing' }).select('id').maybeSingle()).data,
    async (id) => { await writer.from('call_sessions').delete().eq('id', id); },
);
results.live_comments = await testTable(
    'live_comments',
    async () => (await writer.from('live_comments').insert({ stream_id: stream.id, user_id: b.id, body: 'realtime probe' }).select('id').maybeSingle()).data,
    async (id) => { await writer.from('live_comments').delete().eq('id', id); },
);
results.live_gifts = await testTable(
    'live_gifts',
    async () => {
        const { data: gift } = await writer.from('gift_catalog').select('id, name, credit_cost').limit(1).maybeSingle();
        return (await writer.from('live_gifts').insert({ stream_id: stream.id, sender_id: b.id, gift_id: gift.id, gift_name: gift.name, credit_cost: 0 }).select('id').maybeSingle()).data;
    },
    async (id) => { await writer.from('live_gifts').delete().eq('id', id); },
);

await writer.from('live_streams').delete().eq('id', stream.id);
await writer.from('call_sessions').delete().eq('id', call.id);
await writer.from('users').update({ is_live: false }).eq('id', a.id);

const off = Object.entries(results).filter(([, v]) => v === false).map(([k]) => k);
console.log('\nprobe rows removed');
if (off.length) {
    console.log(`\n${off.length} of ${Object.keys(results).length} tables are NOT on realtime: ${off.join(', ')}`);
    console.log('These features still work — they fall back to polling — but updates arrive on the poll interval.');
} else {
    console.log('\nEvery table delivers realtime to the anon client.');
}
process.exit(0);
