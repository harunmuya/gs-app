/**
 * Four faults that all looked like something else.
 *
 * A member reported four separate problems: chat saying the session had ended,
 * profile photos not uploading, admin package changes vanishing, and a Silver
 * account told to upgrade before going live. Three of them turned out to share
 * a cause and the fourth was hiding in plain sight.
 *
 * The session. The browser client kept its session in local storage while sign
 * in wrote to cookies, so the browser client had never held a session at all
 * and every refreshSession call resolved with nothing. Any 401 then looked
 * permanent.
 *
 * The entitlements cache. A failed lookup was cached exactly like a good one
 * and never expired, so one bad request left a paying member on the free tier
 * until they reloaded, and an admin granting a package never reached them.
 *
 * The uploads. Every image picker decoded with an img.onload handler and no
 * onerror beside it. A HEIC from an iPhone, which is the default camera format
 * on iOS, produced no error and no status. Nothing happened at all.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

let pass = 0;
let fail = 0;
const check = (label, ok, detail = '') => {
    if (ok) { pass++; console.log(`  ok    ${label}${detail ? `  ${detail}` : ''}`); }
    else { fail++; console.log(`  FAIL  ${label}${detail ? `  ${detail}` : ''}`); }
};

function walk(dir, out = []) {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full, out);
        else if (/\.(js|jsx)$/.test(entry)) out.push(full);
    }
    return out;
}

const read = (f) => readFileSync(f, 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('\nOne session, shared by client and server');
{
    const client = strip(read(join('src', 'lib', 'supabaseClient.js')));
    check('the browser client reads the cookie session',
        /createBrowserClient/.test(client) && /@supabase\/ssr/.test(client));
    check('it is no longer the local storage client',
        !/from '@supabase\/supabase-js'/.test(client),
        'local storage and cookies are different places');
}

console.log('\nEntitlements do not cache a failure');
{
    const hook = read(join('src', 'lib', 'useEntitlements.js'));
    const code = strip(hook);
    check('a failed lookup is reported but not remembered', /remember: false/.test(code));
    check('a good answer expires', /const TTL_MS = /.test(code));
    check('the cache is keyed by member', /cache\.userId !== userId/.test(code));
    check('returning to the tab re-checks', /visibilitychange/.test(code));
    // refreshEntitlements nulls the cache, so it has to read the member first.
    check('refresh reads the member before clearing',
        /const userId = cache\?\.userId;\s*\n\s*cache = null;/.test(code),
        'otherwise it reloads for nobody');
}

console.log('\nNo image picker fails silently');
{
    /*
      The specific shape that caused this: an img.onload with no onerror. Any
      file the browser cannot decode then produces no error, no status, and no
      spinner, which reads to the member as the app being broken.
    */
    /*
      The defect is an onload with no onerror, not an onload as such.

      A first pass flagged every occurrence and reported two files that both
      pair the handlers correctly on adjacent lines, which is the shape we
      actually want. What matters is whether a failure path exists, so each
      onload is checked against the surrounding lines for its onerror.
    */
    const offenders = [];
    for (const file of walk('src')) {
        const lines = strip(read(file)).split(/\r?\n/);
        lines.forEach((line, i) => {
            if (!/\bimg\.onload\s*=/.test(line)) return;
            const nearby = lines.slice(Math.max(0, i - 6), i + 25).join('\n');
            if (!/\bimg\.onerror\s*=/.test(nearby)) offenders.push(`${relative('src', file)}:${i + 1}`);
        });
    }
    check('no decode is left without a failure path', offenders.length === 0, offenders.join(', '));

    const helper = read(join('src', 'lib', 'imageFile.js'));
    check('the shared helper handles a decode failure', /img\.onerror = /.test(helper));
    check('it handles a read failure', /reader\.onerror = /.test(helper));
    check('it tries createImageBitmap first', /createImageBitmap/.test(helper),
        'that is what copes with HEIC');
    check('it names HEIC in the message a member sees', /HEIC/.test(helper));
    check('it refuses an enormous file before decoding', /MAX_SOURCE_BYTES/.test(helper));
    check('it falls back when webp is unsupported', /image\/jpeg/.test(helper));

    // Every picker has to use it, or one of them is still silent.
    for (const [name, file] of [
        ['the profile photo picker', join('src', 'app', '(main)', 'profile', 'page.js')],
        ['the signup photo picker', join('src', 'app', 'auth', 'login', 'page.js')],
        ['the chat attachment', join('src', 'app', '(main)', 'messages', '[id]', 'page.js')],
    ]) {
        check(`${name} uses the helper`, /compressImageFile/.test(read(file)));
    }

    const profile = read(join('src', 'app', '(main)', 'profile', 'page.js'));
    check('verification uploads report failure too',
        (profile.match(/\(message\) => setEditStatus\(message\)/g) || []).length >= 2,
        'the selfie and the ID photo');
}

console.log('\nA 401 on a screen is recovered, not announced');
{
    const api = strip(read(join('src', 'lib', 'apiFetch.js')));
    check('it refreshes and retries once', /refreshSessionOnce/.test(api) && /const second = await fetch/.test(api));
    check('a second 401 is treated as genuinely signed out', /sessionExpired = true/.test(api));
    check('one refresh is shared across callers', /refreshInFlight/.test(api));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
