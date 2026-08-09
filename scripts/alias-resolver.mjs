/**
 * The resolve hook behind alias-loader.
 *
 * Rewrites `@/x` to `<project>/src/x`, adding a `.js` extension when the
 * specifier has none, since the app's imports are extensionless and Node's ESM
 * resolver requires one.
 */
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve as resolvePath } from 'node:path';

// import.meta.dirname rather than parsing import.meta.url: on Windows the URL
// pathname is "/C:/Users/..." with a leading slash and percent-encoded spaces,
// and hand-unpicking that produced a root that did not exist, so every candidate
// missed and the hook silently fell through to Node's own resolver.
const PROJECT_ROOT = resolvePath(import.meta.dirname, '..');

export async function resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith('@/')) return nextResolve(specifier, context);

    const base = resolvePath(PROJECT_ROOT, 'src', specifier.slice(2));
    for (const candidate of [base, `${base}.js`, `${base}.mjs`, resolvePath(base, 'index.js')]) {
        if (existsSync(candidate)) {
            return { url: pathToFileURL(candidate).href, shortCircuit: true };
        }
    }
    return nextResolve(specifier, context);
}
