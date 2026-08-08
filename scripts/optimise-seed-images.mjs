/**
 * Re-encode the seed photography as WebP at display size.
 *
 * 303 JPEGs, 41.4MB, averaging 140KB and peaking at 654KB — all served from
 * public/ through Vercel, where every request counts against the edge-request
 * allowance that is now exhausted, and every byte against bandwidth.
 *
 * 800px at quality 74 was chosen by measuring four settings on a 25-image
 * sample: 900/78 gave 19.2MB, 800/74 gave 14.2MB, 720/72 gave 11.7MB and 640/70
 * gave 9.4MB. 800 keeps the full-bleed profile hero acceptable — 900 was already
 * below what a 3x phone would want for it — while the card grid needs barely 520.
 *
 * They are also far larger than anything the app draws. A member card is an
 * aspect-3/4 tile in a two-column grid: about 180x240 CSS pixels, so 540x720
 * covers a 3x display with room to spare. Everything above that is downloaded
 * and thrown away by the scaler.
 *
 * Originals are left in place. Nothing is deleted by this script — it writes
 * .webp beside each .jpg, and the roster is repointed separately, so a bad
 * conversion is reverted by pointing back at the .jpg.
 *
 *   node scripts/optimise-seed-images.mjs            # report only
 *   node scripts/optimise-seed-images.mjs --write    # actually convert
 */
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import sharp from 'sharp';

const WRITE = process.argv.includes('--write');
const FORCE = process.argv.includes('--force');
const MAX_EDGE = 800;
const QUALITY = 74;
const DIRS = ['sugarmums', 'sugar-dads', 'mistresses', 'Toboys or Sugarguys'];
const ROOT = join('public', 'seed');

const kb = (n) => `${(n / 1024).toFixed(0)}KB`;
const mb = (n) => `${(n / 1048576).toFixed(1)}MB`;

let originalBytes = 0;
let newBytes = 0;
let converted = 0;
let skipped = 0;
let failed = 0;

console.log(WRITE ? 'converting\n' : 'DRY RUN — pass --write to convert\n');

for (const dir of DIRS) {
    const base = join(ROOT, dir);
    if (!existsSync(base)) continue;
    for (const name of readdirSync(base)) {
        if (!/\.(jpe?g|png)$/i.test(name)) continue;
        const source = join(base, name);
        const target = join(base, `${basename(name, extname(name))}.webp`);
        const sourceSize = statSync(source).size;
        originalBytes += sourceSize;

        if (existsSync(target) && !FORCE) {
            newBytes += statSync(target).size;
            skipped++;
            continue;
        }

        if (!WRITE) {
            // Estimate without writing: read the metadata to see how much of the
            // file is resolution we never use.
            try {
                const meta = await sharp(source).metadata();
                const scale = Math.min(1, MAX_EDGE / Math.max(meta.width || MAX_EDGE, meta.height || MAX_EDGE));
                // WebP at q78 lands around 35% of an equivalent JPEG, before the resize.
                newBytes += Math.round(sourceSize * scale * scale * 0.35);
                converted++;
            } catch {
                failed++;
            }
            continue;
        }

        try {
            const info = await sharp(source)
                .rotate() // honour EXIF orientation before stripping it
                .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
                .webp({ quality: QUALITY, effort: 5 })
                .toFile(target);
            newBytes += info.size;
            converted++;
            if (converted % 50 === 0) console.log(`  ${converted} converted…`);
        } catch (err) {
            failed++;
            console.error(`  failed: ${source} — ${err.message}`);
        }
    }
}

console.log('\n---');
console.log(`originals      ${mb(originalBytes)}  across ${converted + skipped} images`);
console.log(`webp           ${mb(newBytes)}${WRITE ? '' : '  (estimated)'}`);
const saved = originalBytes - newBytes;
console.log(`saved          ${mb(saved)}  (${((saved / originalBytes) * 100).toFixed(0)}%)`);
console.log(`mean per image ${kb(originalBytes / Math.max(1, converted + skipped))} -> ${kb(newBytes / Math.max(1, converted + skipped))}`);
if (skipped) console.log(`skipped        ${skipped} already had a .webp`);
if (failed) console.log(`failed         ${failed}`);

if (WRITE) {
    console.log('\nNext: regenerate the roster so it points at the .webp files —');
    console.log('  node scripts/generate-seed-members.mjs');
    console.log('The .jpg originals are untouched; delete them only once the app looks right.');
}
