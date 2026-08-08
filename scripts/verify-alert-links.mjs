/**
 * Check that every notification the app writes carries a usable in-app link.
 *
 * The alerts screen now navigates on metadata.actionLink. A notification without
 * one dead-ends on a detail card, which is the behaviour this replaced — so the
 * useful assertion is that each type the code emits sets a link the router can
 * follow, and that the link points at a route that exists.
 */
import { readFileSync, existsSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const APP = 'src/app';

/** Every actionLink literal the API routes write. */
function collectActionLinks() {
    const found = [];
    function walk(dir) {
        for (const name of readdirSync(dir)) {
            const full = join(dir, name);
            if (statSync(full).isDirectory()) { walk(full); continue; }
            if (!/\.js$/.test(name)) continue;
            const text = readFileSync(full, 'utf8');
            const re = /actionLink:\s*[`'"]([^`'"]+)[`'"]/g;
            let m;
            while ((m = re.exec(text))) found.push({ file: full.replace(/\\/g, '/'), link: m[1] });
        }
    }
    walk('src/app/api');
    return found;
}

/** Turn `/calls/${x}?session=...` into the route segment it targets. */
function routeOf(link) {
    return link.split('?')[0].replace(/\$\{[^}]*\}/g, ':param');
}

/** Does a Next route exist for this path? */
function routeExists(path) {
    const parts = path.split('/').filter(Boolean);
    let dir = join(APP, '(main)');
    if (!existsSync(dir)) dir = APP;
    for (const part of parts) {
        const literal = join(dir, part);
        if (existsSync(literal)) { dir = literal; continue; }
        const dynamic = readdirSync(dir).find((n) => /^\[.+\]$/.test(n));
        if (dynamic) { dir = join(dir, dynamic); continue; }
        return false;
    }
    return existsSync(join(dir, 'page.js'));
}

const links = collectActionLinks();
const seen = new Map();
for (const { file, link } of links) {
    const route = routeOf(link);
    if (!seen.has(route)) seen.set(route, { route, link, files: new Set() });
    seen.get(route).files.add(file.split('/').slice(-3).join('/'));
}

let fail = 0;
console.log(`${links.length} actionLink literals across ${seen.size} distinct routes\n`);
for (const { route, link } of [...seen.values()].sort((a, b) => a.route.localeCompare(b.route))) {
    const relative = link.startsWith('/') && !link.startsWith('//');
    const exists = routeExists(route);
    const ok = relative && exists;
    if (!ok) fail++;
    console.log(`  ${ok ? 'ok   ' : 'FAIL '} ${route.padEnd(34)} ${relative ? '' : '(not an in-app path) '}${exists ? '' : '(no such route)'}`);
}

// The alerts screen refuses anything that is not a same-origin path.
const rejected = links.filter(({ link }) => !link.startsWith('/') || link.startsWith('//'));
console.log(`\nlinks the alerts screen would refuse to follow: ${rejected.length}`);
for (const r of rejected) console.log(`   ${r.link}  (${r.file})`);

console.log(fail ? `\n${fail} route(s) unusable` : '\nevery notification link resolves to a real in-app route');
process.exit(fail ? 1 : 0);
