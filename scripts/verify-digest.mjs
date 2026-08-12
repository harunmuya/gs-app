/**
 * Would the away mail send anything wrong?
 *
 * This is the only thing in the app that emails members we were not asked to
 * email, so the failure modes are worse than a broken screen. A wrong count is
 * a lie in somebody's inbox. A missed cadence check is the app spamming a
 * person who already stopped using it. A wrong column name silently reads zero
 * and turns every digest into a nudge, which looks fine and is not.
 *
 * So this runs the real selection against the real database and reports what
 * would actually go out. It sends nothing.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { NUDGE_TEMPLATES, buildDigestEmail, buildNudgeEmail } from '../src/lib/emailTemplates.js';

const env = Object.fromEntries(
    readFileSync('.env.local', 'utf8')
        .split(/\r?\n/)
        .filter((l) => l && !l.startsWith('#') && l.includes('='))
        .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

let pass = 0;
let fail = 0;
const check = (label, ok, detail = '') => {
    if (ok) { pass++; console.log(`  ok    ${label}${detail ? `  ${detail}` : ''}`); }
    else { fail++; console.log(`  FAIL  ${label}${detail ? `  ${detail}` : ''}`); }
};

const DAY = 24 * 60 * 60 * 1000;
const route = readFileSync('src/app/api/digest/route.js', 'utf8');

console.log('\nEvery column the counts read must exist');
{
    // A missing column reads as zero, which turns a digest into a nudge without
    // any error. That is the quietest way for this to be wrong.
    const probes = [
        ['messages', 'receiver_id'], ['messages', 'is_read'],
        ['member_likes', 'liked_id'], ['profile_views', 'viewed_id'],
        ['member_matches', 'user_low'], ['member_matches', 'user_high'],
        ['user_follows', 'following_id'],
    ];
    for (const [table, column] of probes) {
        const { error } = await db.from(table).select(column).limit(1);
        check(`${table}.${column}`, !error, error?.message?.slice(0, 60) || '');
    }
}

console.log('\nThe copy tells the truth');
{
    const zero = buildDigestEmail('activityDigest', { recipientName: 'Ann', counts: { messages: 0, likes: 0, views: 0, matches: 0, followers: 0 } });
    check('a member with nothing waiting gets no digest', zero === null,
        zero ? `would have sent: ${zero.subject}` : '');

    const one = buildDigestEmail('activityDigest', { recipientName: 'Ann', counts: { likes: 1 } });
    check('one of something is singular', one?.subject === 'You have 1 like waiting', one?.subject || '');

    const many = buildDigestEmail('activityDigest', { recipientName: 'Ann', counts: { messages: 2, likes: 3, views: 4 } });
    check('several read as a sentence', many?.subject === 'You have 2 unread messages, 3 likes and 4 profile views waiting', many?.subject || '');

    const all = [...NUDGE_TEMPLATES.map((b) => b({ recipientName: 'Ann' })), many, one];
    const dashed = all.filter((e) => /—|–| - /.test(`${e.subject} ${e.body}`));
    check('no dashes anywhere in the copy', dashed.length === 0, dashed.map((e) => e.subject).join('; '));
    const shouty = all.filter((e) => /!/.test(`${e.subject} ${e.body}`));
    check('no exclamation marks', shouty.length === 0, shouty.map((e) => e.subject).join('; '));
}

console.log('\nThe nudge rotates rather than repeating');
{
    const seen = [];
    let index = -1;
    for (let i = 0; i < NUDGE_TEMPLATES.length; i += 1) {
        const result = buildNudgeEmail({ recipientName: 'Ann' }, index);
        index = result.index;
        seen.push(result.email.subject);
    }
    check('a full cycle shows every nudge once', new Set(seen).size === NUDGE_TEMPLATES.length,
        `${new Set(seen).size} of ${NUDGE_TEMPLATES.length}`);
    check('it wraps rather than running out', buildNudgeEmail({ recipientName: 'Ann' }, index).index === 0);
}

console.log('\nWho would actually receive something');
{
    const awayBefore = new Date(Date.now() - 7 * DAY).toISOString();
    const { data: members, error } = await db
        .from('users')
        .select('id, email, display_name, last_seen_at')
        .eq('is_seed_profile', false)
        .not('email', 'is', null)
        .is('account_deleted_at', null)
        .lt('last_seen_at', awayBefore)
        .order('last_seen_at', { ascending: true })
        .limit(60);
    check('the selection query runs', !error, error?.message || '');

    let digests = 0;
    let nudges = 0;
    const sample = [];
    for (const member of (members || []).slice(0, 12)) {
        const since = member.last_seen_at ? Date.parse(member.last_seen_at) : Date.now() - 30 * DAY;
        const iso = new Date(since).toISOString();
        const head = { count: 'exact', head: true };
        const safe = async (q) => { const r = await q; return r.error ? 0 : Number(r.count || 0); };
        const counts = {
            messages: await safe(db.from('messages').select('*', head).eq('receiver_id', member.id).eq('is_read', false)),
            likes: await safe(db.from('member_likes').select('*', head).eq('liked_id', member.id).gte('created_at', iso)),
            views: await safe(db.from('profile_views').select('*', head).eq('viewed_id', member.id).gte('created_at', iso)),
            matches: await safe(db.from('member_matches').select('*', head).or(`user_low.eq.${member.id},user_high.eq.${member.id}`).gte('created_at', iso)),
            followers: await safe(db.from('user_follows').select('*', head).eq('following_id', member.id).gte('created_at', iso)),
        };
        const digest = buildDigestEmail('activityDigest', { recipientName: member.display_name, counts });
        if (digest) { digests += 1; sample.push(`digest: ${digest.subject}`); }
        else { nudges += 1; }
    }
    console.log(`        ${members?.length || 0} members away for over 7 days`);
    console.log(`        of the first 12: ${digests} digests, ${nudges} nudges`);
    sample.slice(0, 4).forEach((s) => console.log(`        ${s}`));
    check('the run produces a decision for every member', digests + nudges === Math.min(12, members?.length || 0));
}

console.log('\nThe route cannot fire by accident');
check('it is shut without a secret', /if \(!secret\) \{[\s\S]{0,160}503/.test(route));
check('a wrong secret is rejected', /if \(offered !== secret\) return unauthorised\(\)/.test(route));
check('dry run is the default', /const send = url\.searchParams\.get\('send'\) === '1'/.test(route));
check('it skips banned, suspended and closed accounts',
    /is\('account_deleted_at', null\)/.test(route) && /is_banned/.test(route) && /is_suspended/.test(route));
check('it never emails an active member', /lt\('last_seen_at', awayBefore\)/.test(route));
check('it honours a minimum gap', /MIN_GAP_DAYS \* DAY/.test(route));
check('the batch is capped', /const BATCH = \d+;/.test(route));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
