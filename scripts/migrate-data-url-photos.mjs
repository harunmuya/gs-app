/**
 * Move base64 profile images out of the database and into Storage.
 *
 * 14 accounts have their avatar stored as a `data:` URL directly in
 * `users.avatar_url` (and inside `users.photos`), averaging 64 KB per row and
 * about 900 KB in total. `uploadProfilePhoto` in api/members exists to push these
 * to the `avatars` bucket and store a URL instead, but these rows predate it or
 * slipped past it.
 *
 * Why it matters beyond tidiness: every member listing that selects these columns
 * drags the full image payload out of Postgres, so one row costs as much to read
 * as hundreds of normal ones. It also means the images are not served from the
 * CDN and cannot be cached.
 *
 * DRY RUN BY DEFAULT. Nothing is written unless you pass --apply.
 *
 *   node scripts/migrate-data-url-photos.mjs           # report only
 *   node scripts/migrate-data-url-photos.mjs --apply   # perform the migration
 *
 * The original data URL is only cleared after the upload returns a URL, so a
 * failure part-way leaves the account with its picture intact.
 */

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const BUCKET = 'avatars';

const env = Object.fromEntries(
    readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#') && l.includes('='))
        .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});

function parseDataUrl(value) {
    const match = String(value || '').match(/^data:([^;,]+)(?:;[^,]*)?;base64,(.+)$/);
    if (!match) return null;
    return { contentType: match[1], buffer: Buffer.from(match[2], 'base64') };
}

function extensionFor(contentType) {
    if (/webp/i.test(contentType)) return 'webp';
    if (/png/i.test(contentType)) return 'png';
    if (/gif/i.test(contentType)) return 'gif';
    return 'jpg';
}

async function uploadOne(userId, dataUrl, index) {
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) return null;
    const path = `${userId}/migrated-${Date.now()}-${index}.${extensionFor(parsed.contentType)}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, parsed.buffer, {
        contentType: parsed.contentType,
        upsert: true,
        cacheControl: '31536000',
    });
    if (error) { console.error(`    upload failed: ${error.message}`); return null; }
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

const { data: rows, error } = await supabase
    .from('users')
    .select('id, email, avatar_url, photos')
    .limit(5000);

if (error) { console.error('query failed:', error.message); process.exit(1); }

const affected = rows.filter((r) =>
    String(r.avatar_url || '').startsWith('data:')
    || (Array.isArray(r.photos) && r.photos.some((p) => String(p).startsWith('data:'))));

console.log(`\n${APPLY ? 'APPLYING' : 'DRY RUN'} — ${affected.length} account(s) hold base64 images\n`);

let migrated = 0;
let failed = 0;
let bytesFreed = 0;

for (const row of affected) {
    const before = String(row.avatar_url || '').length
        + (Array.isArray(row.photos) ? row.photos.reduce((n, p) => n + String(p).length, 0) : 0);
    const masked = String(row.email || '').replace(/(.{3}).*(@.*)/, '$1***$2');
    console.log(`  ${masked}  ~${Math.round(before / 1024)} KB`);

    if (!APPLY) { bytesFreed += before; continue; }

    try {
        const patch = {};

        if (String(row.avatar_url || '').startsWith('data:')) {
            const url = await uploadOne(row.id, row.avatar_url, 0);
            if (!url) { failed++; console.log('    skipped (avatar upload failed)'); continue; }
            patch.avatar_url = url;
        }

        if (Array.isArray(row.photos) && row.photos.some((p) => String(p).startsWith('data:'))) {
            const next = [];
            for (let i = 0; i < row.photos.length; i++) {
                const photo = row.photos[i];
                if (!String(photo).startsWith('data:')) { next.push(photo); continue; }
                const url = await uploadOne(row.id, photo, i + 1);
                // Keep the original if the upload failed: losing a member's only
                // picture is far worse than leaving one oversized row behind.
                next.push(url || photo);
            }
            patch.photos = next;
        }

        if (!Object.keys(patch).length) continue;

        patch.updated_at = new Date().toISOString();
        const { error: updateError } = await supabase.from('users').update(patch).eq('id', row.id);
        if (updateError) { failed++; console.log(`    db update failed: ${updateError.message}`); continue; }

        migrated++;
        bytesFreed += before;
        console.log('    migrated');
    } catch (err) {
        failed++;
        console.log(`    threw: ${err?.message}`);
    }
}

console.log(`\n${APPLY ? `migrated ${migrated}, failed ${failed}` : 'no changes written'}`);
console.log(`approx ${Math.round(bytesFreed / 1024)} KB ${APPLY ? 'removed from' : 'currently held in'} the users table`);
if (!APPLY) console.log('\nRe-run with --apply to perform the migration.');
