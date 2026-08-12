/**
 * Does the app download actually download anything?
 *
 * vercel.json rewrote /base-release.apk to genuine-sugar-mummies-kenya.apk.
 * The file on disk is genuine-sugar-mummies.apk. No -kenya. So the link handed
 * out for installing the app returned 404, and had been doing so for as long as
 * the rewrite has existed.
 *
 * Nothing in the app links to it, which is exactly why it went unnoticed: the
 * link lives in WhatsApp messages and Telegram posts, where no test ever looks.
 *
 * A rewrite that points at a missing file is not visible in a build, a type
 * check or a page render. The only way to catch it is to resolve every rewrite
 * destination against the files that will actually be deployed.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

let pass = 0;
let fail = 0;
const check = (label, ok, detail = '') => {
    if (ok) { pass++; console.log(`  ok    ${label}${detail ? `  ${detail}` : ''}`); }
    else { fail++; console.log(`  FAIL  ${label}${detail ? `  ${detail}` : ''}`); }
};

const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
const rewrites = config.rewrites || [];

console.log(`\n${rewrites.length} rewrites, each destination resolved against public/`);

for (const rule of rewrites) {
    const destination = String(rule.destination || '');

    // Only static destinations can be checked this way. A rewrite into a route
    // is resolved by the framework, not by a file on disk.
    if (!/\.[a-z0-9]{2,5}$/i.test(destination)) {
        console.log(`        skipped, not a static file: ${destination}`);
        continue;
    }

    /*
      A destination that is itself the source of another rewrite is a chain, and
      Vercel does not follow chains. It has to resolve to a real file directly.
    */
    const onDisk = join('public', destination.replace(/^\//, ''));
    check(`${rule.source} resolves`, existsSync(onDisk), existsSync(onDisk) ? '' : `missing ${onDisk}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
