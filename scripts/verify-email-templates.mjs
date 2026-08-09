/**
 * Check every notification email renders, stays on brand, and reads like a
 * person wrote it.
 *
 * The dash check is the point of this file. Em dashes, en dashes and " - " used
 * as a separator are the clearest tell of machine written copy, and an email is
 * where that costs the most: it is the one place the product speaks to somebody
 * who has closed the app.
 */
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const { EMAIL_TEMPLATES } = await import(pathToFileURL(resolve('src/lib/emailTemplates.js')).href);

const SAMPLE = {
    recipientName: 'Grace Achieng',
    senderName: 'Peter Mwangi',
    likerName: 'Peter Mwangi',
    matchName: 'Peter Mwangi',
    followerName: 'Peter Mwangi',
    callerName: 'Peter Mwangi',
    hostName: 'Peter Mwangi',
    callType: 'video',
    giftName: 'Diamond Ring',
    streamTitle: 'Friday evening catch up',
    streamId: 'abc-123',
    viewerCount: 4,
    preview: 'Hello, I saw your profile and wanted to say hi. How is your week going?',
    isSuperLike: false,
};

let pass = 0;
let fail = 0;
const check = (label, ok, detail = '') => {
    if (ok) { pass++; } else { fail++; console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`); }
};

console.log(`${Object.keys(EMAIL_TEMPLATES).length} templates\n`);

for (const [name, build] of Object.entries(EMAIL_TEMPLATES)) {
    const out = build(SAMPLE);
    const all = `${out.subject} ${out.preview} ${out.title} ${out.body} ${out.actionLabel}`;

    check(`${name}: has a subject`, Boolean(out.subject?.trim()));
    check(`${name}: has a body`, Boolean(out.body?.trim()));
    check(`${name}: has an action`, Boolean(out.actionLabel && out.actionUrl));
    check(`${name}: action is an in-app path`, String(out.actionUrl).startsWith('/'));
    check(`${name}: subject under 78 chars`, out.subject.length <= 78, `${out.subject.length}: ${out.subject}`);

    // The copy rules.
    check(`${name}: no em or en dash`, !/[—–]/.test(all), (all.match(/[—–][^\n]{0,30}/) || [''])[0]);
    check(`${name}: no " - " separator`, !/ - /.test(all), (all.match(/.{0,20} - .{0,20}/) || [''])[0]);
    check(`${name}: no exclamation marks`, !/!/.test(all));
    check(`${name}: recipient is addressed by name`, out.body.includes('Grace'));

    console.log(`  ${name}`);
    console.log(`    subject: ${out.subject}`);
    console.log(`    action:  ${out.actionLabel} -> ${out.actionUrl}`);
}

// The shell the templates render into.
const emailSource = readFileSync('src/lib/email.js', 'utf8');
console.log('\ntemplate shell');
const offBrand = emailSource.match(/#(0f766e|99f6e4|ccfbf1|eef8f6|0f172a|64748b|f59e0b|042f2e)/gi) || [];
check('no pre-rebrand teal or slate left', offBrand.length === 0, offBrand.join(', '));
check('uses the brand primary', emailSource.includes('#C21E56'));
check('header gradient matches the app', emailSource.includes('linear-gradient(135deg,#C21E56 0%,#8B1340 100%)'));
check('no em dash in the shell copy', !/[—–]/.test(emailSource));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
