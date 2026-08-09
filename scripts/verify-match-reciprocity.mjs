/**
 * A match must mean both people liked each other, and nothing else.
 *
 * The app used to declare one from a compatibility score: discover called
 * addMatch whenever the score cleared 93, and shouldMatchProfile hashed the
 * profile id and rolled the result against the score. Those fabrications were
 * written into user_interactions as action = 'match' and read back as though
 * they were real, so a member could be told "Matched with X, 94% compatible"
 * about somebody who had never opened their profile.
 *
 * This drives the real tables and checks the property that matters: a one-sided
 * like produces no match, and a returned like produces exactly one.
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
const check = (label, ok, detail = '') => {
    if (ok) { pass++; console.log(`  ok    ${label}${detail ? `  ${detail}` : ''}`); }
    else { fail++; console.log(`  FAIL  ${label}${detail ? `  ${detail}` : ''}`); }
};

const countMatches = async (low, high) => {
    const { count } = await db.from('member_matches').select('*', { count: 'exact', head: true }).eq('user_low', low).eq('user_high', high);
    return count || 0;
};

const { data: members } = await db.from('users').select('id, display_name').eq('is_seed_profile', false).is('account_deleted_at', null).limit(2);
const [a, b] = members || [];
if (!a?.id || !b?.id) { console.error('Need two real members.'); process.exit(1); }
const [low, high] = [a.id, b.id].sort();

const cleanup = async () => {
    await db.from('member_matches').delete().eq('user_low', low).eq('user_high', high);
    await db.from('member_likes').delete().in('liker_id', [a.id, b.id]).in('liked_id', [a.id, b.id]);
};

try {
    await cleanup();
    console.log(`${a.display_name} and ${b.display_name}\n`);

    // One side only.
    await db.from('member_likes').insert({ liker_id: a.id, liked_id: b.id, is_super_like: false });
    check('a one sided like creates no match', await countMatches(low, high) === 0);

    // The return like.
    await db.from('member_likes').insert({ liker_id: b.id, liked_id: a.id, is_super_like: false });
    check('a returned like creates exactly one match', await countMatches(low, high) === 1);

    // Liking again must not duplicate.
    await db.from('member_likes').upsert({ liker_id: a.id, liked_id: b.id, is_super_like: true }, { onConflict: 'liker_id,liked_id' });
    check('re-liking does not create a second match', await countMatches(low, high) === 1);

    const { data: superRow } = await db.from('member_matches').select('is_super_match').eq('user_low', low).eq('user_high', high).maybeSingle();
    check('upgrading to a super like marks the match super', superRow?.is_super_match === true,
        superRow?.is_super_match ? '' : '(AFTER UPDATE trigger not firing)');

    // Unliking withdraws it. A match should not outlive the interest.
    await db.from('member_likes').delete().eq('liker_id', a.id).eq('liked_id', b.id);
    check('unliking removes the match', await countMatches(low, high) === 0);

    // And nothing else may write a match.
    const { count: fabricated } = await db.from('user_interactions')
        .select('*', { count: 'exact', head: true })
        .eq('action', 'match');
    check('no client-written match rows in user_interactions', (fabricated || 0) === 0,
        fabricated ? `${fabricated} left over from the old fabrication` : '');
} catch (err) {
    fail++;
    console.log(`\nAborted: ${err.message}`);
} finally {
    await cleanup();
    console.log('\n  test rows removed');
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
}
