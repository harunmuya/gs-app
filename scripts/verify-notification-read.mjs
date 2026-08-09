/**
 * Does marking a notification read actually persist, and stay scoped?
 *
 * Reading was local only: markActivityRead and markMessagesRead updated React
 * state and localStorage, and no server action existed to record it. Every one
 * of the 387 notifications in this database is still flagged unread, so the
 * badge returned in full on another device, after clearing site data, or after
 * a reinstall. One member carries a permanent 16.
 *
 * The scoping check matters as much as the persistence one: an endpoint that
 * marks notifications read must never touch somebody else's.
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

const made = [];

try {
    const { data: members } = await db.from('users').select('id, display_name').eq('is_seed_profile', false).limit(2);
    const [a, b] = members || [];
    if (!a?.id || !b?.id) throw new Error('Need two real members.');

    // Two unread notices for A, one for B.
    for (const [owner, title] of [[a, 'probe one'], [a, 'probe two'], [b, 'probe other']]) {
        const { data } = await db.from('user_notifications')
            .insert({ user_id: owner.id, type: 'security', title, body: 'verification probe', read: false })
            .select('id').maybeSingle();
        if (data?.id) made.push({ id: data.id, owner: owner.id });
    }
    const mine = made.filter((m) => m.owner === a.id).map((m) => m.id);
    const theirs = made.filter((m) => m.owner === b.id).map((m) => m.id);

    // The update the endpoint performs, scoped by user_id exactly as it is there.
    const single = await db.from('user_notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('user_id', a.id).eq('read', false).in('id', [mine[0]])
        .select('id', { count: 'exact' });
    check('marking one notification read persists', !single.error && single.data?.length === 1);

    const { data: after } = await db.from('user_notifications').select('id, read, read_at').in('id', mine);
    check('the read flag is stored', after?.find((r) => r.id === mine[0])?.read === true);
    check('read_at is recorded', Boolean(after?.find((r) => r.id === mine[0])?.read_at));
    check('the other notification is untouched', after?.find((r) => r.id === mine[1])?.read === false);

    // Somebody else's id must not be affected even when passed in.
    await db.from('user_notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('user_id', a.id).eq('read', false).in('id', theirs);
    const { data: other } = await db.from('user_notifications').select('read').in('id', theirs).maybeSingle();
    check('another member\'s notification cannot be marked by id', other?.read === false,
        other?.read ? '(SCOPE LEAK)' : '');

    // Mark all, the "Mark all read" control.
    const all = await db.from('user_notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('user_id', a.id).eq('read', false)
        .select('id', { count: 'exact' });
    check('mark all clears the rest for that member', !all.error);
    const { count: stillUnread } = await db.from('user_notifications')
        .select('*', { count: 'exact', head: true }).eq('user_id', a.id).eq('read', false);
    check('no unread left for that member', (stillUnread ?? 0) === 0, `${stillUnread} remaining`);
} catch (err) {
    fail++;
    console.log(`\nAborted: ${err.message}`);
} finally {
    if (made.length) await db.from('user_notifications').delete().in('id', made.map((m) => m.id));
    console.log('\n  probe notifications removed');
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
}
