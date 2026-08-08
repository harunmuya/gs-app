/**
 * Establishes a weight ladder tied to text size.
 *
 * The interface used `font-black` (900) 305 times against 113 bold and 26 medium.
 * Weight 900 on 10px metadata is the specific thing that makes an interface read
 * as machine-generated: every element competes, so none leads.
 *
 * Typographic convention is that weight should fall as size falls — large text
 * carries weight comfortably, small text needs less of it to read as emphasised.
 * This applies that rule mechanically:
 *
 *   micro   (9-11px, text-[10px], text-xs)  font-black -> font-semibold
 *   small   (text-sm)                       font-black -> font-bold
 *   display (text-lg and larger, headings)  left alone
 *
 * Only the weight token changes, so layout is untouched apart from a fractional
 * difference in glyph width.
 *
 *   node scripts/fix-type-weights.mjs --dry
 *   node scripts/fix-type-weights.mjs
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const SRC = join(process.cwd(), 'src');
const DRY = process.argv.includes('--dry');

// Size tokens that count as "small enough that 900 is too heavy".
const MICRO = /text-\[(?:8|9|10|11)px\]|text-xs/;
const SMALL = /text-sm/;
// Anything at this size or above keeps its weight.
const DISPLAY = /text-(?:base|lg|xl|2xl|3xl|4xl|5xl)|text-\[(?:1[6-9]|[2-9]\d)px\]|type-(?:display|title|heading)/;

async function walk(dir) {
    const out = [];
    for (const entry of await readdir(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) out.push(...await walk(full));
        else if (['.js', '.jsx'].includes(extname(entry.name))) out.push(full);
    }
    return out;
}

/**
 * Rewrites font-black inside a single className string, deciding by the size
 * token present in that same string. Operating per-attribute rather than
 * per-line keeps unrelated elements on the same line independent.
 */
function rewriteClassName(value) {
    if (!value.includes('font-black')) return { value, micro: 0, small: 0 };
    if (DISPLAY.test(value)) return { value, micro: 0, small: 0 };

    if (MICRO.test(value)) {
        return { value: value.replace(/font-black/g, 'font-semibold'), micro: 1, small: 0 };
    }
    if (SMALL.test(value)) {
        return { value: value.replace(/font-black/g, 'font-bold'), micro: 0, small: 1 };
    }
    return { value, micro: 0, small: 0 };
}

let microTotal = 0;
let smallTotal = 0;
let filesTouched = 0;

for (const file of await walk(SRC)) {
    const text = await readFile(file, 'utf8');
    if (!text.includes('font-black')) continue;

    let micro = 0;
    let small = 0;

    // Matches className="..." and className={`...`}
    const updated = text.replace(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g, (match, dq, tpl) => {
        const raw = dq !== undefined ? dq : tpl;
        const result = rewriteClassName(raw);
        micro += result.micro;
        small += result.small;
        if (result.value === raw) return match;
        return dq !== undefined ? `className="${result.value}"` : `className={\`${result.value}\`}`;
    });

    if (!micro && !small) continue;

    if (!DRY) await writeFile(file, updated, 'utf8');
    microTotal += micro;
    smallTotal += small;
    filesTouched += 1;
    console.log(`${DRY ? '[dry] ' : ''}${file.replace(process.cwd(), '.')}  micro:${micro} small:${small}`);
}

console.log(`\n${DRY ? 'Would change' : 'Changed'} ${filesTouched} files.`);
console.log(`  font-black -> font-semibold (micro): ${microTotal}`);
console.log(`  font-black -> font-bold     (small): ${smallTotal}`);
console.log('  display sizes left untouched.');
