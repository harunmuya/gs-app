/**
 * Does any member facing sentence read as machine written?
 *
 * Two tells, both asked for explicitly and both easy to reintroduce without
 * noticing.
 *
 * The dash. An em dash, an en dash, or a spaced hyphen used where a full stop
 * belongs. It survived in the location permission sheet long after the rest of
 * the app had been cleaned, because that copy lives in a spec object in lib
 * rather than in the component that shows it, so a sweep of the components
 * missed it entirely.
 *
 * The exclamation mark. One survived in the welcome message for the same
 * reason: it was written once in the API and once in AuthContext, and only one
 * copy got fixed.
 *
 * Comments are excluded. A comment explaining why a dash was removed has to be
 * able to contain one.
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

/*
  The files that hold sentences a member reads. API routes are included because
  a good deal of the copy is error text and email bodies written there.
*/
const files = walk('src').filter((f) => !f.includes(join('lib', 'wordpress.js')));

function memberFacingStrings(source) {
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    return [...code.matchAll(/'([^'\n]{20,})'|"([^"\n]{20,})"|`([^`\n]{20,})`/g)]
        .map((m) => (m[1] || m[2] || m[3]).trim())
        // Prose, not a class list, a path, a query or a column list.
        .filter((s) => s.split(/\s+/).length >= 4)
        .filter((s) => / [a-z]/.test(s))
        .filter((s) => !/(className|rounded-|grid-|px-|py-|bg-|text-\[|var\(--|https?:|\/api\/|@\/|select\(|\.eq\(|[{}<>]|=>)/.test(s))
        /*
          A Supabase select is not prose.

          The first run reported sixteen exclamation marks that were all foreign
          key hints, because PostgREST spells a relationship as
          `user:users!story_likes_user_id_fkey(...)`. The same strings tripped
          the dash check as comma separated column lists. Neither is a sentence
          and neither is read by anybody.
        */
        .filter((s) => !/_fkey|\w+:\w+!|^[\w\s,]+$/.test(s))
        .filter((s) => /[.?]|[a-z] [a-z]/.test(s))
        // Unbalanced brackets or operators mean this is a slice of an
        // expression rather than a sentence somebody reads.
        .filter((s) => !/\|\||&&|\bin navigator\b|\btypeof\b|\)\s*$/.test(s));
}

const dashHits = [];
const bangHits = [];

for (const file of files) {
    for (const line of memberFacingStrings(readFileSync(file, 'utf8'))) {
        // An em dash, an en dash, or a hyphen doing a full stop's job.
        if (/—|–| - /.test(line)) dashHits.push([relative('src', file), line]);
        if (/!/.test(line) && !/!==|!=/.test(line)) bangHits.push([relative('src', file), line]);
    }
}

console.log('\nNo dashes standing in for punctuation');
check('none in member facing copy', dashHits.length === 0, `${dashHits.length} found`);
for (const [file, line] of dashHits.slice(0, 12)) {
    console.log(`        ${file}\n          "${line.slice(0, 110)}"`);
}

console.log('\nNo exclamation marks');
check('none in member facing copy', bangHits.length === 0, `${bangHits.length} found`);
for (const [file, line] of bangHits.slice(0, 12)) {
    console.log(`        ${file}\n          "${line.slice(0, 110)}"`);
}

console.log('\nThe permission sheet specifically');
{
    // This is the one the member sees when choosing precise or approximate
    // location, and it is the one that kept its dashes longest.
    const spec = readFileSync(join('src', 'lib', 'permissions.js'), 'utf8');
    const sheet = readFileSync(join('src', 'components', 'PermissionSheet.js'), 'utf8');
    const copy = [...memberFacingStrings(spec), ...memberFacingStrings(sheet)];
    check('the location rationale is clean', !copy.some((s) => /—|–| - /.test(s)));
    check('every permission still explains itself',
        ['location', 'microphone', 'camera', 'notifications'].every((k) => new RegExp(`${k}: \\{[\\s\\S]{0,600}?why:`).test(spec)));
    check('the accuracy choice is still offered',
        /Approximate area/.test(sheet) && /Precise location/.test(sheet));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
