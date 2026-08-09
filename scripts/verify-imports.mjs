/**
 * Catch identifiers used but never imported or defined.
 *
 * verify-jsx-imports covers <Component /> usage. It does not cover a plain
 * function call, which is how `notifyMember` reached three call sites in
 * api/members/route.js with no import and a clean build — the failure would have
 * been a ReferenceError the first time somebody liked a profile.
 *
 * Deliberately narrow: it checks only the shared helpers this codebase imports
 * across files, rather than attempting general scope analysis. A short list that
 * is always right beats a broad one that cries wolf and gets ignored.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Exported helpers that are imported by name across modules. */
const TRACKED = [
    'notifyMember', 'sendAndLogEmail', 'emailHtml', 'buildNotificationEmail',
    'requireMember', 'getSessionMember', 'createAdminClient', 'createRouteClient',
    'consumeQuota', 'canUseFeature', 'isAccountRestricted', 'activeTierId',
    'uploadStoryMedia', 'presenceFor', 'isListingOnly', 'permissionState',
    'requestLocation', 'requestMedia', 'wasDismissed', 'markDismissed',
    'localSeedRows', 'getLocalSeedMember', 'profileKindFor', 'facilitationFields',
];

function walk(dir, out = []) {
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full, out);
        else if (/\.jsx?$/.test(name)) out.push(full);
    }
    return out;
}

let problems = 0;
let scanned = 0;

/**
 * Strip comments and string literals before scanning.
 *
 * The first run of this flagged proxy.js for calling createRouteClient(), which
 * appears only inside a doc comment describing where route handlers get their
 * client. A checker that reports things like that stops being read.
 */
function stripNonCode(text) {
    return text
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
        .replace(/`(?:[^`\\]|\\.)*`/g, '``')
        .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
        .replace(/"(?:[^"\\\n]|\\.)*"/g, '""');
}

for (const file of walk('src')) {
    const raw = readFileSync(file, 'utf8');
    const text = stripNonCode(raw);
    scanned++;

    // What this file brings in or declares itself.
    //
    // Read from `raw`, not the stripped copy: stripNonCode blanks string
    // literals, which includes the module path, so imports become invisible and
    // every tracked helper looks unresolved. That produced 65 false positives on
    // the first attempt.
    const available = new Set();
    for (const m of raw.matchAll(/import\s+([^;]+?)\s+from\s+['"][^'"]+['"]/g)) {
        const braces = m[1].match(/\{([^}]*)\}/);
        if (braces) {
            for (const part of braces[1].split(',')) {
                const name = (part.includes(' as ') ? part.split(' as ')[1] : part).trim();
                if (name) available.add(name);
            }
        }
        const def = m[1].match(/^\s*([A-Za-z_$][\w$]*)\s*(?:,|$)/);
        if (def) available.add(def[1]);
    }
    for (const m of text.matchAll(/(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) available.add(m[1]);

    for (const name of TRACKED) {
        // Called as a function somewhere in this file?
        const used = new RegExp(`(?<![\\w.$])${name}\\s*\\(`).test(text);
        if (used && !available.has(name)) {
            problems++;
            const line = text.slice(0, text.search(new RegExp(`(?<![\\w.$])${name}\\s*\\(`))).split('\n').length;
            console.log(`  ${file.replace(/\\/g, '/')}:${line}`);
            console.log(`      ${name}() is called but never imported or defined`);
        }
    }
}

console.log(problems
    ? `\n${problems} unresolved call(s) across ${scanned} files`
    : `\nno unresolved helper calls (${scanned} files, ${TRACKED.length} helpers tracked)`);
process.exit(problems ? 1 : 0);
