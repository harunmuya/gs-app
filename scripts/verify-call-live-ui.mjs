/**
 * Do the call and live screens read fields that actually exist?
 *
 * The redesign made both screens depend on data rather than on decoration: the
 * call screen names the person you are speaking to, and the live chat renders
 * the comment you just typed. Both of those are only as good as the column
 * behind them, and the live chat had already been shipped reading `content`
 * while the table stores `body`, which is exactly the class of mistake reading
 * the file does not catch.
 *
 * So this checks the columns, not the markup.
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

const src = (path) => readFileSync(path, 'utf8');
const callScreen = src('src/app/(main)/calls/[id]/page.js');
const liveScreen = src('src/app/(main)/live/[id]/page.js');

console.log('\nCall screen');

// The name falls back to call_sessions.metadata. Confirm real rows carry it.
{
    const { data } = await db.from('call_sessions').select('id, metadata').not('metadata', 'is', null).limit(20);
    const named = (data || []).filter((r) => r.metadata?.callerName || r.metadata?.receiverName);
    check('call_sessions.metadata carries the participant names',
        (data || []).length === 0 || named.length > 0,
        `${named.length} of ${(data || []).length} sampled rows`);
}

// The photo comes from the members endpoint, which normalises to avatarUrl.
{
    const route = src('src/app/api/members/route.js');
    check('the members endpoint returns avatarUrl', /avatarUrl:/.test(route));
    check('the call screen reads avatarUrl, not image', /peer\?\.avatarUrl/.test(callScreen) && !/peer\?\.image/.test(callScreen));
}

check('the screen no longer shows the placeholder heading', !callScreen.includes('>GS Call<'));
check('the identity layer is hidden once remote video arrives', /\{!remoteLive && \(/.test(callScreen));
check('only a video track clears the identity layer',
    /event\.track\?\.kind === 'video'/.test(callScreen));
check('the self view is video only', /callType === 'video' && \(\s*\n\s*<video ref=\{localVideoRef\}/.test(callScreen));
check('the scrim is painted before the identity layer',
    callScreen.indexOf('bg-gradient-to-t from-black/80') < callScreen.indexOf('{!remoteLive &&'));
// Count the control buttons and make sure each one is labelled.
{
    const footerButtons = (callScreen.match(/<button\s+type="button"/g) || []).length;
    const labelled = (callScreen.match(/aria-label=/g) || []).length;
    check('control buttons are all labelled', labelled >= footerButtons, `${labelled} labels for ${footerButtons} buttons`);
}

check('role is declared before the identity derivation uses it',
    callScreen.indexOf('const role =') < callScreen.indexOf('const peerName ='));

// Tailwind has no danger/success colour registered; those are hand written
// classes, so shadow-danger/30 would silently generate nothing.
check('no shadow utility references an unregistered colour',
    !/shadow-(danger|success)\//.test(callScreen));

console.log('\nLive room');

// The comment column. This is the one that was already wrong in production.
{
    const { data, error } = await db.from('live_comments').select('id, body').limit(1);
    check('live_comments stores the text in body', !error, error?.message || '');
    const hasContent = await db.from('live_comments').select('content').limit(1);
    check('live_comments has no content column', Boolean(hasContent.error),
        hasContent.error ? '' : '(both columns exist, the screen must pick one)');
}

check('the optimistic comment writes body', /id: data\.comment\?\.id \|\| `\$\{Date\.now\(\)\}`, body,/.test(liveScreen));
check('the comment list reads body', /\{comment\.body\}/.test(liveScreen));

// The decorative wash must sit under the broadcast, not over it.
{
    const wash = liveScreen.indexOf('radial-gradient(circle_at_30%_20%');
    const video = liveScreen.indexOf('<video ref={remoteVideoRef}');
    check('the colour wash is behind the video', wash > -1 && video > -1 && wash < video,
        wash > video ? '(it tints the host picture)' : '');
}

check('the chat scrolls to the newest comment', /box\.scrollTop = box\.scrollHeight/.test(liveScreen));
check('the live badge is present', /Live<\/span>|> Live\s*\n/.test(liveScreen));
check('the counter row is no longer 10px type', !/text-\[10px\] font-semibold">\s*\n\s*\{\[/.test(liveScreen));
check('the back control meets the 44px target', /h-11 w-11 shrink-0 items-center justify-center rounded-full/.test(liveScreen));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
