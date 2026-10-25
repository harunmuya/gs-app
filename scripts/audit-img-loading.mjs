/**
 * Report every <img> element that carries no `loading` attribute.
 *
 * A line-based grep gets this wrong: most of these elements are multi-line JSX,
 * so `loading="lazy"` sits several lines below the `<img`. This walks from each
 * `<img` to its closing `>`, ignoring any `>` inside a JSX expression, and tests
 * the whole element.
 *
 * Run: node scripts/audit-img-loading.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!/node_modules|\.next/.test(full)) walk(full, out);
        } else if (entry.name.endsWith('.js') || entry.name.endsWith('.jsx')) {
            out.push(full);
        }
    }
    return out;
}

const missing = [];
let total = 0;

for (const file of walk('src')) {
    const source = fs.readFileSync(file, 'utf8');
    const opener = /<img\b/g;
    let match;

    while ((match = opener.exec(source)) !== null) {
        const start = match.index;
        let depth = 0;
        let end = start;

        for (let i = start; i < source.length; i++) {
            const char = source[i];
            if (char === '{') depth++;
            else if (char === '}') depth--;
            else if (char === '>' && depth === 0) { end = i; break; }
        }

        const element = source.slice(start, end + 1);
        total++;

        if (!/\bloading\s*=/.test(element)) {
            const line = source.slice(0, start).split('\n').length;
            missing.push(`${file.split(path.sep).join('/')}:${line}`);
        }
    }
}

console.log(`total <img> elements: ${total}`);
console.log(`without a loading attribute: ${missing.length}`);
for (const entry of missing) console.log(`   ${entry}`);
