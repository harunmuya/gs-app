/**
 * Exercise every write the calls and live routes now perform, against the real
 * database, then delete everything created.
 *
 * This is the check that matters for the column-name fixes: a route can only be
 * proven correct here by actually inserting the shape it inserts. Every row is
 * removed in the finally block, and the script refuses to run if it cannot find
 * two distinct real members to act as the pair.
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

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

const created = { call: null, signal: null, event: null, stream: null, comment: null, gift: null, notes: [] };
let pass = 0;
let fail = 0;

function check(label, error) {
    if (error) { fail++; console.log(`  FAIL  ${label}\n        ${error.code || ''} ${error.message}`); }
    else { pass++; console.log(`  ok    ${label}`); }
}

try {
    const { data: members } = await db
        .from('users')
        .select('id, display_name')
        .is('account_deleted_at', null)
        .eq('is_seed_profile', false)
        .limit(2);
    if ((members || []).length < 2) throw new Error('Need two real members to test with.');
    const [a, b] = members;
    console.log(`Acting as: ${a.display_name} -> ${b.display_name}\n`);

    console.log('=== calls ===');
    const call = await db.from('call_sessions').insert({
        caller_id: a.id, receiver_id: b.id, call_type: 'video', status: 'ringing',
        metadata: { verification: true },
    }).select('*').maybeSingle();
    check('insert call_session (ringing)', call.error);
    created.call = call.data?.id;

    if (created.call) {
        // The exact patch shape the status action now writes.
        const now = new Date();
        const accept = await db.from('call_sessions')
            .update({ status: 'accepted', started_at: now.toISOString(), accepted_at: now.toISOString() })
            .eq('id', created.call).select('*').maybeSingle();
        check('update call_session -> accepted (no updated_at)', accept.error);

        const end = await db.from('call_sessions')
            .update({ status: 'ended', ended_at: new Date().toISOString(), duration_seconds: 42 })
            .eq('id', created.call).select('*').maybeSingle();
        check('update call_session -> ended with duration', end.error);

        const evt = await db.from('call_events').insert({
            call_session_id: created.call, user_id: a.id, event_type: 'started', metadata: { verification: true },
        }).select('id').maybeSingle();
        check('insert call_events with user_id', evt.error);
        created.event = evt.data?.id;

        const sig = await db.from('call_signals').insert({
            call_session_id: created.call, sender_id: a.id, receiver_id: b.id,
            type: 'offer', signal_type: 'offer', payload: { type: 'offer', sdp: 'v=0' },
        }).select('id').maybeSingle();
        check('insert call_signals with type + signal_type', sig.error);
        created.signal = sig.data?.id;
    }

    console.log('\n=== live ===');
    const stream = await db.from('live_streams').insert({
        host_id: a.id, title: 'verification stream', is_active: true,
        viewer_count: 0, total_gifts: 0, total_coins: 0, total_likes: 0, total_comments: 0, total_views: 0,
    }).select('*').maybeSingle();
    check('insert live_stream', stream.error);
    created.stream = stream.data?.id;

    if (created.stream) {
        const comment = await db.from('live_comments').insert({
            stream_id: created.stream, user_id: b.id, body: 'verification comment',
        }).select('id').maybeSingle();
        check('insert live_comments with body', comment.error);
        created.comment = comment.data?.id;

        const { data: gift } = await db.from('gift_catalog').select('id, name, credit_cost').limit(1).maybeSingle();
        if (gift?.id) {
            const lg = await db.from('live_gifts').insert({
                stream_id: created.stream, sender_id: b.id,
                gift_id: gift.id, gift_name: gift.name, credit_cost: gift.credit_cost || 0,
            }).select('id').maybeSingle();
            check('insert live_gifts with gift_id/credit_cost', lg.error);
            created.gift = lg.data?.id;
        }
    }

    console.log('\n=== notifications the new alerts write ===');
    for (const type of ['story', 'story_like', 'followed_live', 'incoming_call', 'call_status']) {
        const n = await db.from('user_notifications').insert({
            user_id: a.id, type, title: `verification ${type}`, body: 'verification',
            metadata: { verification: true },
        }).select('id').maybeSingle();
        check(`insert user_notifications type=${type}`, n.error);
        if (n.data?.id) created.notes.push(n.data.id);
    }
} catch (err) {
    fail++;
    console.log(`\nAborted: ${err.message}`);
} finally {
    console.log('\n=== cleanup ===');
    if (created.notes.length) await db.from('user_notifications').delete().in('id', created.notes);
    if (created.gift) await db.from('live_gifts').delete().eq('id', created.gift);
    if (created.comment) await db.from('live_comments').delete().eq('id', created.comment);
    if (created.stream) await db.from('live_streams').delete().eq('id', created.stream);
    if (created.signal) await db.from('call_signals').delete().eq('id', created.signal);
    if (created.event) await db.from('call_events').delete().eq('id', created.event);
    if (created.call) await db.from('call_sessions').delete().eq('id', created.call);
    console.log('  every test row removed');
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
}
