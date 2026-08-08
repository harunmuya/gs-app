/**
 * Check that story media never lands in the database as base64.
 *
 * Imports the real uploadStoryMedia from src/lib/storyMedia and passes it a stub
 * bucket. An earlier version of this script re-implemented the function, which
 * would have kept passing after the real one changed — the whole reason the
 * logic was moved into its own module.
 */
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const { uploadStoryMedia, STORY_MEDIA_LIMIT_BYTES } = await import(
    pathToFileURL(resolve('src/lib/storyMedia.js')).href
);

const workingBucket = {
    upload: async () => ({ error: null }),
    getPublicUrl: (p) => ({ data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/story-media/${p}` } }),
};
const brokenBucket = {
    upload: async () => ({ error: { message: 'bucket unavailable' } }),
    getPublicUrl: () => ({ data: null }),
};
const throwingBucket = {
    upload: async () => { throw new Error('network down'); },
    getPublicUrl: () => ({ data: null }),
};

const b64 = (bytes) => `data:image/jpeg;base64,${Buffer.alloc(bytes, 0x41).toString('base64')}`;

let pass = 0;
let fail = 0;
function check(label, ok, detail = '') {
    if (ok) { pass++; console.log(`  ok    ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`); }
}

const cases = [
    ['small image uploads and returns an https url', workingBucket, b64(1024), (r) => r.ok && r.url.startsWith('https://')],
    ['9MB file is refused', workingBucket, b64(9 * 1024 * 1024), (r) => !r.ok && /8MB/.test(r.error)],
    ['exactly at the limit is accepted', workingBucket, b64(STORY_MEDIA_LIMIT_BYTES), (r) => r.ok],
    ['malformed data url is refused', workingBucket, 'data:image/jpeg;base64', (r) => !r.ok],
    ['storage error is refused, not stored', brokenBucket, b64(1024), (r) => !r.ok],
    ['storage throwing is refused, not stored', throwingBucket, b64(1024), (r) => !r.ok],
    ['empty media is fine (text story)', workingBucket, '', (r) => r.ok && r.url === ''],
    ['already-hosted https url passes through', workingBucket, 'https://cdn.example/x.jpg', (r) => r.ok && r.url === 'https://cdn.example/x.jpg'],
    ['successful upload reports a path for rollback', workingBucket, b64(1024), (r) => r.ok && typeof r.path === 'string' && r.path.length > 0],
];

console.log(`uploadStoryMedia (imported from src/lib/storyMedia.js, limit ${STORY_MEDIA_LIMIT_BYTES / 1024 / 1024}MB)\n`);
const results = [];
for (const [label, bucket, input, predicate] of cases) {
    const result = await uploadStoryMedia(bucket, input, { ownerId: 'abc-123', mediaType: 'image' });
    results.push([label, result]);
    check(label, predicate(result), JSON.stringify({ ok: result.ok, url: String(result.url || '').slice(0, 44), error: result.error }));
}

console.log('\nthe invariant: no code path ever returns a data: url');
for (const [label, result] of results) {
    const leaked = typeof result.url === 'string' && result.url.startsWith('data:');
    check(label, !leaked, leaked ? `leaked ${result.url.length} chars of base64` : '');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
