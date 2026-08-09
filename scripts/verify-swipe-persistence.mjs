/**
 * Prove that a like, a pass and a mutual like actually persist.
 *
 * Run before the migration and all three fail. Run after and they succeed, which
 * is what stops the discover deck showing the same profiles after every reload.
 *
 * Every row created here is deleted in the finally block.
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

let pass = 0;
let fail = 0;
const check = (label, error, extra = '') => {
    if (error) { fail++; console.log(`  FAIL  ${label}\n        ${error.message || error}`); }
    else { pass++; console.log(`  ok    ${label}${extra ? `  ${extra}` : ''}`); }
};

const made = { likes: [], interactions: [], matchPair: null };

try {
    const { data: members } = await db.from('users').select('id, display_name').eq('is_seed_profile', false).is('account_deleted_at', null).limit(2);
    if ((members || []).length < 2) throw new Error('Need two real members.');
    const [a, b] = members;
    console.log(`Acting as: ${a.display_name} and ${b.display_name}\n`);

    // --- a pass, which is what keeps a profile out of the deck ---
    const passRow = await db.from('user_interactions').upsert({
        user_id: a.id, profile_key: `member:${b.id}`, action: 'pass',
    }, { onConflict: 'user_id,profile_key,action' }).select('id').maybeSingle();
    check('record a pass in user_interactions', passRow.error);
    if (passRow.data?.id) made.interactions.push(passRow.data.id);

    // --- the same pass twice must not duplicate ---
    const repeat = await db.from('user_interactions').upsert({
        user_id: a.id, profile_key: `member:${b.id}`, action: 'pass',
    }, { onConflict: 'user_id,profile_key,action' }).select('id').maybeSingle();
    check('repeating a pass does not duplicate', repeat.error,
        repeat.data?.id === passRow.data?.id ? '(same row)' : '(NEW ROW — constraint missing)');

    // --- a one sided like ---
    const like1 = await db.from('member_likes').upsert(
        { liker_id: a.id, liked_id: b.id, is_super_like: false },
        { onConflict: 'liker_id,liked_id' },
    ).select('id').maybeSingle();
    check('record a like in member_likes', like1.error);
    if (like1.data?.id) made.likes.push(like1.data.id);

    // --- a super like on the same pair must update, not insert ---
    const superLike = await db.from('member_likes').upsert(
        { liker_id: a.id, liked_id: b.id, is_super_like: true },
        { onConflict: 'liker_id,liked_id' },
    ).select('id, is_super_like').maybeSingle();
    check('upgrading a like to a super like updates in place', superLike.error,
        superLike.data?.is_super_like ? '(is_super_like true)' : '');

    // --- the return like, which should create the match ---
    const like2 = await db.from('member_likes').upsert(
        { liker_id: b.id, liked_id: a.id, is_super_like: false },
        { onConflict: 'liker_id,liked_id' },
    ).select('id').maybeSingle();
    check('record the return like', like2.error);
    if (like2.data?.id) made.likes.push(like2.data.id);

    const [low, high] = [a.id, b.id].sort();
    made.matchPair = { low, high };
    const match = await db.from('member_matches').select('id').eq('user_low', low).eq('user_high', high).maybeSingle();
    check('a mutual like creates a match', match.error);
    if (!match.error) {
        if (match.data?.id) { pass++; console.log('  ok    the match row exists (trigger fired)'); }
        else { fail++; console.log('  FAIL  no match row — the trigger from 070 has not been created'); }
    }
} catch (err) {
    fail++;
    console.log(`\nAborted: ${err.message}`);
} finally {
    console.log('\ncleanup');
    if (made.matchPair) await db.from('member_matches').delete().eq('user_low', made.matchPair.low).eq('user_high', made.matchPair.high);
    if (made.likes.length) await db.from('member_likes').delete().in('id', made.likes);
    if (made.interactions.length) await db.from('user_interactions').delete().in('id', made.interactions);
    console.log('  test rows removed');
    console.log(`\n${pass} passed, ${fail} failed`);
    if (fail) {
        console.log('\nRun supabase/migrations/20260809_010_swipe_persistence_and_like_constraint.sql');
        console.log('and 20260808_070_real_interactions_and_mutual_matches.sql for the match trigger.');
    }
    process.exit(fail ? 1 : 0);
}
