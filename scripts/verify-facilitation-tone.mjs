/**
 * Does the app warn members about its own listings?
 *
 * Profiles our team introduced used to carry a red panel headed "You cannot
 * text this profile", with a Ban icon, sitting above three action buttons each
 * wearing a red circle and a strike through symbol. Every word of it was true.
 * The effect was that the app appeared to be flagging its own content as
 * suspect, which on a dating product is the most expensive impression there is:
 * people already arrive scanning for scams, and red plus a prohibition is
 * exactly the pattern they are scanning for.
 *
 * The same fact told the other way is a service, because that is what it is.
 * Our team arranged the introduction and carries the first message.
 *
 * This checks the tone has not drifted back, and, just as importantly, that the
 * warmer wording did not start claiming things that are not true. Reassurance
 * built on a false claim is worse than the red panel was.
 */
import { readFileSync } from 'node:fs';

let pass = 0;
let fail = 0;
const check = (label, ok, detail = '') => {
    if (ok) { pass++; console.log(`  ok    ${label}${detail ? `  ${detail}` : ''}`); }
    else { fail++; console.log(`  FAIL  ${label}${detail ? `  ${detail}` : ''}`); }
};

const notice = readFileSync('src/components/FacilitationNotice.js', 'utf8');
const kind = readFileSync('src/lib/profileKind.js', 'utf8');
const profile = readFileSync('src/app/(main)/members/[id]/page.js', 'utf8');
const discover = readFileSync('src/app/(main)/discover/[id]/page.js', 'utf8');

// Only the strings a member reads, not the code comments explaining the change.
function memberFacingStrings(source) {
    const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    return [...withoutComments.matchAll(/'([^'\n]{12,})'|"([^"\n]{12,})"|`([^`\n]{12,})`/g)]
        .map((m) => m[1] || m[2] || m[3])
        .filter((s) => !/^[\w./@-]+$/.test(s) && !/className|rounded|flex |gradient|var\(--/.test(s));
}

/*
  Only the strings that appear on a facilitated profile.

  A first pass scanned the whole member profile file and flagged "Microphone is
  blocked", which is a permission message, is accurate, and has nothing to do
  with facilitation. Scoping to lines that mention the facilitation flags keeps
  the check pointed at the thing it is about.
*/
const facilitationLines = profile
    .split(/\r?\n/)
    .filter((line) => /localOnlyMember|facilitation|FacilitatedAction/i.test(line))
    .join('\n');

const copy = [
    ...memberFacingStrings(notice),
    ...memberFacingStrings(kind),
    ...memberFacingStrings(facilitationLines),
];

// Comments explain why the old wording was wrong, so they quote it. Strip them
// before looking for the old wording, or the file describing the fix fails it.
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const noticeCode = stripComments(notice);
const profileCode = stripComments(profile);

console.log('\nNothing reads as a warning');
{
    const ALARM = [
        [/\bcannot\b/i, 'cannot'],
        [/\bnot available\b/i, 'not available'],
        [/\bunavailable\b/i, 'unavailable'],
        [/\bblocked\b/i, 'blocked'],
        [/\bdenied\b/i, 'denied'],
        [/\brequired\b/i, 'required'],
        [/\bnobody is signed in\b/i, 'nobody is signed in'],
        [/would not reach/i, 'would not reach'],
        [/\bnot a member account\b/i, 'not a member account'],
    ];
    for (const [pattern, name] of ALARM) {
        const hits = copy.filter((s) => pattern.test(s));
        check(`no member facing copy says "${name}"`, hits.length === 0,
            hits.length ? hits[0].slice(0, 80) : '');
    }
}

console.log('\nThe visual language is not an error state');
check('the panel is not tinted danger', !/tint-danger|border-danger-soft/.test(noticeCode));
check('no strike through symbol on the panel', !/\bBan\b/.test(noticeCode));
check('the action buttons carry no red mark', !/\bBan\b/.test(profileCode),
    'they used to wear a danger badge on the corner');
check('the buttons are still visible rather than removed',
    (profileCode.match(/<FacilitatedAction/g) || []).length === 3,
    'hiding them makes the profile look broken instead of different');
check('the corner mark is the introduction icon', /<HeartHandshake size=\{9\}/.test(profileCode));
// Amber is the caution colour, and this chip sat under the name between two
// neutral ones, so the profile wore a warning before a word had been read.
check('the chip under the name is not amber',
    !/localOnlyMember && <span[^>]*bg-amber/.test(profileCode));

console.log('\nIt leads with what happens next');
check('the heading names the route, not the restriction',
    /Introduced by our team/.test(notice) && /Introduced by our team/.test(kind));
check('there is a way to act on it', /Ask for an introduction/.test(notice));
check('and a way to understand it', /How introductions work/.test(notice));

console.log('\nAnd it does not overclaim');
{
    // The reassurance has to be things we can keep. Anything asserting the
    // person is present, or that a reply is coming, is a claim we cannot back.
    const OVERCLAIM = [
        [/\bonline now\b/i, 'says the person is online'],
        [/\bactive now\b/i, 'says the person is active'],
        [/\bwill reply\b/i, 'promises a reply'],
        [/\bguarantee/i, 'guarantees something'],
        [/\bresponds within\b/i, 'promises a response time'],
        [/\bwaiting to hear from you\b/i, 'claims they are waiting'],
    ];
    for (const [pattern, description] of OVERCLAIM) {
        const hits = [...memberFacingStrings(notice), ...memberFacingStrings(kind)].filter((s) => pattern.test(s));
        check(`nothing ${description}`, hits.length === 0, hits[0]?.slice(0, 70) || '');
    }
    check('it still says the answer may be no', /including when the answer is no/.test(notice));
}

console.log('\nBoth profile routes use it');
check('the member profile shows the panel', /<FacilitationNotice member=\{member\}/.test(profile));
check('the discover profile passes the real profile', /<FacilitationNotice member=\{profile\}/.test(discover),
    'a stub would lose the person name');

console.log('\nNo dashes in the new copy');
{
    const dashed = copy.filter((s) => /—|–| - /.test(s));
    check('none', dashed.length === 0, dashed[0]?.slice(0, 70) || '');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
