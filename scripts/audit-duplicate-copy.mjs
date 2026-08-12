/**
 * The same sentence, written down twice.
 *
 * The facilitation notice existed in three places: the shared constant, a
 * hardcoded fallback on the members grid, and another on the profile. When the
 * wording was rewritten, two of the three changed. The third kept showing the
 * old sentence, and nothing failed, because a duplicated string is not a bug
 * until somebody edits one copy.
 *
 * That is the whole failure mode. It is silent, it is invisible in review, and
 * it always surfaces as "why does this screen still say the old thing".
 *
 * This finds member facing sentences that appear in more than one file, and
 * separately finds near duplicates: strings that differ only by punctuation or
 * case, which is what a hand copy looks like after somebody tidies one of them.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

function walk(dir, out = []) {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full, out);
        else if (/\.(js|jsx)$/.test(entry)) out.push(full);
    }
    return out;
}

const files = walk('src');

/*
  A member facing sentence, as opposed to a class name or an identifier.

  Long enough to be prose, contains a space and a lowercase run, and is not a
  path, a className, a CSS value or an import specifier. Comments are stripped
  first: a comment quoting the old wording is documentation, not a duplicate.
*/
/*
  Telling prose from a Tailwind class list.

  A first pass filtered on a few known prefixes and was swamped: "text-xl
  font-black text-text-primary" survived it, and class lists drowned out every
  real finding. Counting the tokens is what actually separates them. A class
  list is almost entirely hyphenated words and colon variants; a sentence is
  almost entirely plain words with some punctuation.
*/
function looksLikeClassList(value) {
    const tokens = value.split(/\s+/).filter(Boolean);
    if (tokens.length < 2) return false;
    const classy = tokens.filter((t) => /^[a-z][\w[\]]*(-[\w[\].%/]+)+$/.test(t) || t.includes(':') || /^(flex|grid|block|absolute|relative|truncate|shrink-0)$/.test(t));
    return classy.length / tokens.length > 0.5;
}

function sentences(source) {
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    return [...code.matchAll(/'([^'\n]{25,})'|"([^"\n]{25,})"|`([^`\n$]{25,})`/g)]
        .map((m) => (m[1] || m[2] || m[3]).trim())
        // Four words or more, so it is a sentence rather than a label.
        .filter((s) => s.split(/\s+/).length >= 4)
        .filter((s) => / [a-z]/.test(s))
        .filter((s) => !/^[\w./@-]+$/.test(s))
        .filter((s) => !/(var\(--|https?:|\/api\/|@\/|rgba?\(|\d+px )/.test(s))
        /*
          Code, not copy.

          Quotes do not always balance the way this matcher assumes, so
          fragments of source leak in: `)) return NextResponse.json({ error:`
          appeared four times and is not a sentence anybody reads. Anything
          carrying code punctuation is dropped.
        */
        .filter((s) => !/[{}<>]|=>|\breturn\b|\bconst\b|:\s*(true|false|\d)|_id\b|\+\+/.test(s))
        .filter((s) => !looksLikeClassList(s));
}

const byString = new Map();
for (const file of files) {
    for (const line of sentences(readFileSync(file, 'utf8'))) {
        if (!byString.has(line)) byString.set(line, new Set());
        byString.get(line).add(relative('src', file));
    }
}

const exact = [...byString.entries()]
    .filter(([, where]) => where.size > 1)
    .sort((a, b) => b[1].size - a[1].size);

console.log(`\nScanned ${files.length} files.\n`);
console.log(`Exact duplicates across files: ${exact.length}`);
for (const [line, where] of exact.slice(0, 20)) {
    console.log(`\n  "${line.slice(0, 96)}${line.length > 96 ? '…' : ''}"`);
    for (const file of where) console.log(`      ${file}`);
}
if (exact.length > 20) console.log(`\n  ... and ${exact.length - 20} more`);

/*
  Near duplicates. Normalised to letters and spaces only, so two strings that
  differ by a full stop, a dash, or capitalisation collapse together. This is
  what a copy looks like after one side has been edited and the other has not.
*/
const byShape = new Map();
for (const [line, where] of byString.entries()) {
    const shape = line.toLowerCase().replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (shape.length < 25) continue;
    if (!byShape.has(shape)) byShape.set(shape, new Map());
    byShape.get(shape).set(line, where);
}

const near = [...byShape.values()].filter((variants) => variants.size > 1);
console.log(`\n\nNear duplicates (same sentence, different punctuation): ${near.length}`);
for (const variants of near.slice(0, 10)) {
    console.log('');
    for (const [line, where] of variants) {
        console.log(`  "${line.slice(0, 88)}${line.length > 88 ? '…' : ''}"`);
        console.log(`      ${[...where].join(', ')}`);
    }
}

console.log(`\n${exact.length + near.length} findings total`);
