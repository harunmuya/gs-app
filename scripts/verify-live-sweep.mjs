/**
 * Prove that a live stream whose host stopped reporting in gets closed.
 *
 * Plants a stream with a stale heartbeat and a host flagged is_live, hits the
 * public /api/live, and checks the sweep closed the row, cleared the host flag,
 * removed the viewers and dropped it from the listing. Everything is deleted
 * afterwards whether or not the assertions hold.
 *
 * Requires the dev server on :3000.
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

let pass = 0;
let fail = 0;
function check(label, ok, detail = '') {
    if (ok) { pass++; console.log(`  ok    ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}${detail ? `\n        ${detail}` : ''}`); }
}

const made = { stale: null, fresh: null, hostId: null, viewerId: null };

try {
    const { data: members } = await db.from('users').select('id, display_name').eq('is_seed_profile', false).is('account_deleted_at', null).limit(2);
    const [host, viewer] = members || [];
    if (!host?.id || !viewer?.id) throw new Error('Need two real members.');
    made.hostId = host.id;
    made.viewerId = viewer.id;

    const longAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    const stale = await db.from('live_streams').insert({
        host_id: host.id, title: 'sweep probe (stale)', is_active: true,
        started_at: longAgo, updated_at: longAgo,
    }).select('id').maybeSingle();
    if (stale.error) throw new Error(`could not plant stale stream: ${stale.error.message}`);
    made.stale = stale.data.id;

    const fresh = await db.from('live_streams').insert({
        host_id: viewer.id, title: 'sweep probe (fresh)', is_active: true,
        started_at: now, updated_at: now,
    }).select('id').maybeSingle();
    if (fresh.error) throw new Error(`could not plant fresh stream: ${fresh.error.message}`);
    made.fresh = fresh.data.id;

    await db.from('users').update({ is_live: true }).eq('id', host.id);
    await db.from('live_viewers').upsert({ stream_id: made.stale, user_id: viewer.id, joined_at: longAgo }, { onConflict: 'stream_id,user_id' });

    console.log('planted one stale stream (5 min silent) and one fresh stream\n');

    const res = await fetch('http://localhost:3000/api/live', { cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    check('GET /api/live responded 200', res.ok, `HTTP ${res.status}`);

    const listedIds = (body.streams || []).map((s) => s.id);
    check('stale stream dropped from Live Now', !listedIds.includes(made.stale));
    check('fresh stream still listed', listedIds.includes(made.fresh));

    const { data: after } = await db.from('live_streams').select('id, is_active, status, ended_at').in('id', [made.stale, made.fresh]);
    const staleRow = (after || []).find((r) => r.id === made.stale);
    const freshRow = (after || []).find((r) => r.id === made.fresh);
    check('stale stream marked is_active=false', staleRow?.is_active === false, `got ${staleRow?.is_active}`);
    check('stale stream marked status=ended', staleRow?.status === 'ended', `got ${staleRow?.status}`);
    check('stale stream got an ended_at', Boolean(staleRow?.ended_at));
    check('fresh stream left alone', freshRow?.is_active === true, `got ${freshRow?.is_active}`);

    const { data: hostAfter } = await db.from('users').select('is_live').eq('id', host.id).maybeSingle();
    check('host is_live cleared', hostAfter?.is_live === false, `got ${hostAfter?.is_live}`);

    const { count } = await db.from('live_viewers').select('*', { count: 'exact', head: true }).eq('stream_id', made.stale);
    check('viewers of the dead stream removed', count === 0, `got ${count}`);
} catch (err) {
    fail++;
    console.log(`\nAborted: ${err.message}`);
} finally {
    console.log('\ncleanup');
    if (made.stale) await db.from('live_viewers').delete().eq('stream_id', made.stale);
    if (made.fresh) await db.from('live_viewers').delete().eq('stream_id', made.fresh);
    if (made.stale) await db.from('live_streams').delete().eq('id', made.stale);
    if (made.fresh) await db.from('live_streams').delete().eq('id', made.fresh);
    if (made.hostId) await db.from('users').update({ is_live: false }).eq('id', made.hostId);
    if (made.viewerId) await db.from('users').update({ is_live: false }).eq('id', made.viewerId);
    console.log('  probe rows removed');
    console.log(`\n${pass} passed, ${fail} failed`);
    // Not process.exit: it tears down while an undici socket from the fetch
    // above may still be closing, which aborts Node on Windows after the
    // checks have already passed. See verify-email-delivery for the detail.
    process.exitCode = fail ? 1 : 0;
}
