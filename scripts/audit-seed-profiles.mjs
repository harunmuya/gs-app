/**
 * Audit the generated seed roster for the things that give it away:
 * repeated names, repeated photos, and a location spread no real population has.
 *
 * These profiles are not in the database — /api/members supplements the real
 * users with localSeedRows() at request time, so this file IS the roster.
 */
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const { localSeedRows } = await import(pathToFileURL(resolve('src/lib/localSeedMembers.js')).href);
const rows = localSeedRows();

console.log(`${rows.length} seeded profiles served from src/lib/localSeedMembers.js\n`);

const tally = (list) => {
    const m = new Map();
    for (const v of list) m.set(v, (m.get(v) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

// ---- names ----
const dupNames = tally(rows.map((r) => r.display_name)).filter(([, n]) => n > 1);
console.log(`=== duplicate names: ${dupNames.length} distinct names reused, covering ${dupNames.reduce((s, [, n]) => s + n, 0)} profiles`);
dupNames.slice(0, 12).forEach(([n, c]) => console.log(`   ${c}x  ${n}`));

// ---- photos ----
const dupPhotos = tally(rows.map((r) => r.avatar_url).filter(Boolean)).filter(([, n]) => n > 1);
console.log(`\n=== duplicate photos: ${dupPhotos.length} images reused, covering ${dupPhotos.reduce((s, [, n]) => s + n, 0)} profiles`);
dupPhotos.slice(0, 12).forEach(([p, c]) => console.log(`   ${c}x  ...${String(p).slice(-56)}`));

// same face, different name — the most visible tell
const byPhoto = new Map();
for (const r of rows) {
    if (!r.avatar_url) continue;
    if (!byPhoto.has(r.avatar_url)) byPhoto.set(r.avatar_url, []);
    byPhoto.get(r.avatar_url).push(r.display_name);
}
const sameFaceDifferentName = [...byPhoto.entries()].filter(([, names]) => new Set(names).size > 1);
console.log(`   the same photo under two or more different names: ${sameFaceDifferentName.length}`);
sameFaceDifferentName.slice(0, 5).forEach(([p, names]) => console.log(`      ...${String(p).slice(-40)} -> ${names.join(', ')}`));

// ---- locations ----
const byLoc = tally(rows.map((r) => r.location));
console.log(`\n=== locations: ${byLoc.length} distinct across ${rows.length} profiles`);
byLoc.forEach(([l, c]) => console.log(`   ${String(c).padStart(4)}  ${String(l).padEnd(22)} ${((c / rows.length) * 100).toFixed(1)}%`));
const counts = byLoc.map(([, c]) => c);
const spread = Math.max(...counts) - Math.min(...counts);
console.log(`   spread between most and least common: ${spread}`);
console.log(spread <= 1
    ? '   -> effectively uniform. Real populations are never this even; a round-robin assignment is visible to anyone who scrolls.'
    : '   -> uneven, which is what a real population looks like.');
const nairobi = rows.filter((r) => /nairobi/i.test(r.location || '')).length;
console.log(`   Nairobi or a Nairobi suburb: ${nairobi} (${((nairobi / rows.length) * 100).toFixed(1)}%)`);

// ---- other tells ----
console.log('\n=== other repeated content');
for (const field of ['bio', 'wants', 'needed_qualities', 'intent_summary', 'age_range_preference']) {
    const distinct = new Set(rows.map((r) => r[field])).size;
    console.log(`   ${field.padEnd(22)} ${distinct} distinct values across ${rows.length} profiles`);
}
const hobbies = new Set(rows.map((r) => JSON.stringify(r.hobbies))).size;
const interests = new Set(rows.map((r) => JSON.stringify(r.interests))).size;
console.log(`   hobbies                ${hobbies} distinct combinations`);
console.log(`   interests              ${interests} distinct combinations`);

console.log('\n=== presence fields');
console.log(`   last_seen_at set: ${rows.filter((r) => r.last_seen_at).length}`);
console.log(`   is_online set:    ${rows.filter((r) => r.is_online).length}`);
console.log(`   created_at distinct: ${new Set(rows.map((r) => r.created_at)).size}`);

console.log('\n=== category spread');
tally(rows.map((r) => r.profile_label)).forEach(([l, c]) => console.log(`   ${String(c).padStart(4)}  ${l}`));
