/**
 * Can a member reach support from wherever they are standing?
 *
 * The Telegram handle was printed at the foot of the policy pages and nowhere
 * else. Those are the pages nobody opens. A member stuck on a payment, a stalled
 * verification, or a profile they think is fake was on some other screen with no
 * way to reach anyone, and support that cannot be found reads as support that
 * does not exist.
 *
 * Two things are checked. That every screen has a route to support, and that the
 * handle itself lives in exactly one file, because six hand copied handles is
 * how one of them ends up stale.
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

const files = walk('src');
const read = (f) => readFileSync(f, 'utf8');

console.log('\nOne source of truth for the handle');

// The handle may appear only in SupportContact. Anywhere else is a copy that
// will be missed the day it changes.
{
    const holders = files.filter((f) => /GSADMINMARYGAGENCY|t\.me\//.test(read(f)));
    const stray = holders.filter((f) => !f.endsWith(join('lib', 'support.js')));
    check('the Telegram handle lives in lib/support only',
        stray.length === 0,
        stray.length ? stray.map((f) => relative('src', f)).join(', ') : '');
}
{
    const holders = files.filter((f) => /wa\.me\/|254738871048/.test(read(f)));
    const stray = holders.filter((f) => !f.endsWith(join('lib', 'support.js')));
    check('the WhatsApp number lives in lib/support only',
        stray.length === 0,
        stray.length ? stray.map((f) => relative('src', f)).join(', ') : '');
}

console.log('\nReach');

const mainLayout = read(join('src', 'app', '(main)', 'layout.js'));
check('the signed-in shell mounts the support launcher', /<SupportLauncher \/>/.test(mainLayout));
check('the launcher is imported', /import SupportLauncher from '@\/components\/SupportLauncher'/.test(mainLayout));

// Every signed-in page must sit inside that shell, or it is not covered.
{
    const pages = files.filter((f) => f.endsWith('page.js') && !f.includes(join('app', 'api')));
    const signedIn = pages.filter((f) => f.includes('(main)'));
    const outside = pages.filter((f) => !f.includes('(main)')).map((f) => relative(join('src', 'app'), f));
    check('every signed-in page sits inside the shell', signedIn.length > 0, `${signedIn.length} pages covered`);
    console.log(`        outside the shell: ${outside.join(', ')}`);
}

// The pages outside the shell each need their own route to support.
{
    const launcher = read(join('src', 'components', 'SupportLauncher.js'));
    check('the launcher stays off the call and live screens',
        /\/\^\\\/calls\\\//.test(launcher) || /\^\\\/calls\\\//.test(launcher),
        'so it never covers End Call');

    const policyShell = read(join('src', 'components', 'PolicyPage.js'));
    check('every policy page closes with the support block', /<SupportContact/.test(policyShell));

    const login = read(join('src', 'app', 'auth', 'login', 'page.js'));
    check('the login page offers support', /SUPPORT\.telegram\.url/.test(login),
        'the one screen a locked out member can reach');

    const contact = read(join('src', 'app', 'contact', 'page.js'));
    check('the contact page offers support', /SupportContact|SUPPORT\./.test(contact));
}

console.log('\nThe sheet itself');
{
    const launcher = read(join('src', 'components', 'SupportLauncher.js'));
    check('the trigger has an accessible name', /aria-label="Contact support"/.test(launcher));
    check('the sheet is a labelled dialog', /role="dialog"/.test(launcher) && /aria-modal="true"/.test(launcher));
    check('escape closes it', /event\.key === 'Escape'/.test(launcher));
    check('the backdrop closes it', /aria-label="Close support"[\s\S]{0,200}absolute inset-0/.test(launcher));
    check('it closes on navigation', /useEffect\(\(\) => \{ setOpen\(false\); \}, \[pathname\]\)/.test(launcher));
    check('the close control meets the 44px target', /h-11 w-11 items-center justify-center rounded-full/.test(launcher));
    check('it clears the bottom navigation', /bottom-24/.test(launcher));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
