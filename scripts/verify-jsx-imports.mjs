/**
 * Catch JSX components used but never imported or defined.
 *
 * `npm run build` compiles <GsTrust /> to _jsx(GsTrust, {}) without checking
 * that GsTrust resolves — the failure is a ReferenceError at render time, on
 * whichever page happens to use it. A build that says "Compiled successfully"
 * is therefore not evidence the icon swaps worked, which is exactly how a
 * missing import reached ContactButtons.
 *
 * Heuristic but useful: collects capitalised JSX tags per file and checks each
 * against imports, local declarations and destructured names in that file.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir, out = []) {
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full, out);
        else if (/\.jsx?$/.test(name)) out.push(full);
    }
    return out;
}

/** Names that are always available or are handled by the runtime. */
const GLOBALS = new Set(['Fragment', 'React', 'Suspense', 'Image', 'Link', 'Math', 'Object', 'Array', 'Date', 'JSON', 'Number', 'String', 'Boolean', 'Promise', 'Set', 'Map', 'Intl', 'Error']);

let problems = 0;
let scanned = 0;

for (const file of walk('src')) {
    const text = readFileSync(file, 'utf8');
    if (!text.includes('<')) continue;
    scanned++;

    const declared = new Set(GLOBALS);

    // import X, { A, B as C } from '...'
    for (const m of text.matchAll(/import\s+([^;]+?)\s+from\s+['"][^'"]+['"]/g)) {
        const clause = m[1];
        const def = clause.match(/^\s*([A-Za-z_$][\w$]*)\s*(?:,|$)/);
        if (def) declared.add(def[1]);
        const braces = clause.match(/\{([^}]*)\}/);
        if (braces) {
            for (const part of braces[1].split(',')) {
                const asName = part.includes(' as ') ? part.split(' as ')[1] : part;
                const clean = asName.trim();
                if (clean) declared.add(clean);
            }
        }
        const ns = clause.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
        if (ns) declared.add(ns[1]);
    }

    // function Foo(), const Foo = , class Foo
    for (const m of text.matchAll(/(?:function|class)\s+([A-Z][\w$]*)/g)) declared.add(m[1]);
    for (const m of text.matchAll(/(?:const|let|var)\s+([A-Z][\w$]*)\s*=/g)) declared.add(m[1]);
    // destructured props: { icon: Icon }, { icon: ActionIcon }
    for (const m of text.matchAll(/:\s*([A-Z][\w$]*)\s*[,}]/g)) declared.add(m[1]);
    // array destructure in a callback: .map(([label, value, Icon]) => ...)
    for (const m of text.matchAll(/\[([^\]\n]*)\]\s*\)?\s*=>/g)) {
        for (const part of m[1].split(',')) {
            const clean = part.trim();
            if (/^[A-Z][\w$]*$/.test(clean)) declared.add(clean);
        }
    }
    // bare destructure { Icon }
    for (const m of text.matchAll(/\{\s*([A-Z][\w$]*)\s*[,}]/g)) declared.add(m[1]);

    const used = new Set();
    for (const m of text.matchAll(/<([A-Z][\w$]*)[\s/>]/g)) used.add(m[1]);

    const missing = [...used].filter((name) => !declared.has(name) && !name.includes('.'));
    if (missing.length) {
        problems += missing.length;
        console.log(`  ${file.replace(/\\/g, '/')}`);
        missing.forEach((n) => console.log(`      <${n}> is used but not imported or defined`));
    }
}

console.log(problems
    ? `\n${problems} unresolved JSX component(s) across ${scanned} files`
    : `\nno unresolved JSX components (${scanned} files scanned)`);
process.exit(problems ? 1 : 0);
