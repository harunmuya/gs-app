/**
 * The claim being tested: no profile without a real account ever gets a status dot.
 *
 * Imports lib/presence directly. Four separate copies of this logic used to exist
 * and every one of them fell through to a grey "offline" dot for seeded and
 * WordPress listings — a presence claim about something that cannot have
 * presence, in the exact spot a real member's status appears.
 */
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const { presenceFor, presenceLabel, isListingOnly } = await import(
    pathToFileURL(resolve('src/lib/presence.js')).href
);

let pass = 0;
let fail = 0;
const check = (label, ok, detail = '') => {
    if (ok) { pass++; console.log(`  ok    ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`); }
};

const ago = (ms) => new Date(Date.now() - ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

console.log('profiles that must NEVER show a dot\n');
const listings = [
    ['seed profile by id', { id: 'seed-local-004', lastSeenAt: ago(MIN) }],
    ['wordpress profile by id', { id: 'wp-1234', lastSeenAt: ago(MIN) }],
    ['flagged requiresFacilitation', { id: 'abc', requiresFacilitation: true, lastSeenAt: ago(MIN) }],
    ['is_seed_profile flag', { id: 'abc', is_seed_profile: true, lastSeenAt: ago(MIN) }],
    ['source wp', { id: 'abc', source: 'wp', lastSeenAt: ago(MIN) }],
    // The nastiest case: a listing carrying a fresh timestamp still gets nothing.
    ['seed with a fresh last_seen', { id: 'seed-local-001', lastSeenAt: new Date().toISOString(), isOnline: true }],
];
for (const [label, member] of listings) {
    check(label, presenceFor(member) === null, JSON.stringify(presenceFor(member)));
    check(`  ${label}: recognised as a listing`, isListingOnly(member) === true);
}

console.log('\nreal accounts');
check('no timestamp -> no dot (we do not know, so we do not guess)', presenceFor({ id: 'u1' }) === null);
check('unparseable timestamp -> no dot', presenceFor({ id: 'u1', lastSeenAt: 'not a date' }) === null);
check('1 min ago -> online now', presenceFor({ id: 'u1', lastSeenAt: ago(MIN) })?.label === 'Online now');
check('1 min ago -> live', presenceFor({ id: 'u1', lastSeenAt: ago(MIN) })?.live === true);
check('20 min ago -> minutes label', /min ago$/.test(presenceFor({ id: 'u1', lastSeenAt: ago(20 * MIN) })?.label || ''));
check('20 min ago -> not live', presenceFor({ id: 'u1', lastSeenAt: ago(20 * MIN) })?.live === false);
check('5 hr ago -> hours label', /hr ago$/.test(presenceFor({ id: 'u1', lastSeenAt: ago(5 * HOUR) })?.label || ''));
check('3 days ago -> days label', /d ago$/.test(presenceFor({ id: 'u1', lastSeenAt: ago(3 * DAY) })?.label || ''));
check('3 months ago -> vague label', presenceFor({ id: 'u1', lastSeenAt: ago(90 * DAY) })?.label === 'Active a while ago');
check('snake_case last_seen_at also read', presenceFor({ id: 'u1', last_seen_at: ago(MIN) })?.label === 'Online now');

console.log('\nthe line shown instead of a status');
check('listing gets a factual description, not a status',
    presenceLabel({ id: 'seed-local-002' }) === 'Introduced by our team');
check('listing honours a custom facilitation label',
    presenceLabel({ id: 'wp-9', facilitationLabel: 'Facilitation Required' }) === 'Facilitation Required');
check('listing label never says online or offline',
    !/online|offline|active/i.test(presenceLabel({ id: 'seed-local-002' })));
check('real account gets its activity label',
    presenceLabel({ id: 'u1', lastSeenAt: ago(MIN) }) === 'Online now');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
