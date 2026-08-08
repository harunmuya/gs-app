/**
 * How many Vercel edge requests the client's timers generate per open tab.
 *
 * The free tier is 1,000,000 edge requests a month and it is exhausted, so this
 * is not a theoretical exercise: every interval below is a recurring request
 * against a route, and the ones that run on the members and discover screens run
 * for as long as the tab is open whether or not anything is happening.
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

/** Timers that do not make a network call — they only re-render. */
const LOCAL_ONLY = /tick|setSeconds|cycle|update\b/;

/** Resolve the named intervals in lib/usePolling so POLL.x reads as a number. */
const pollSource = readFileSync('src/lib/usePolling.js', 'utf8');
const POLL_VALUES = {};
for (const m of pollSource.matchAll(/^\s{4}(\w+):\s*([\d_]+),/gm)) {
    POLL_VALUES[m[1]] = Number(m[2].replace(/_/g, ''));
}

const found = [];
for (const file of walk('src')) {
    if (file.replace(/\\/g, '/').endsWith('lib/usePolling.js')) continue;
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/setInterval\(\s*([A-Za-z_$][\w$.]*)\s*,\s*(\d+|POLL\.\w+|[A-Z_]+)\s*\)/g)) {
        const [, fn, msRaw] = m;
        let ms;
        if (/^\d+$/.test(msRaw)) ms = Number(msRaw);
        else if (msRaw.startsWith('POLL.')) ms = POLL_VALUES[msRaw.slice(5)];
        else {
            // A local const such as ACTIVE_MS — resolve it within the same file.
            const local = text.match(new RegExp(`${msRaw}\\s*=\\s*(POLL\\.(\\w+)|\\d+)`));
            if (local) ms = local[2] ? POLL_VALUES[local[2]] : Number(local[1]);
        }
        if (!ms) continue;
        found.push({
            file: file.replace(/\\/g, '/').replace('src/app/', '').replace('src/', ''),
            fn,
            ms,
            network: !LOCAL_ONLY.test(fn),
        });
    }
}

/** Which of these are mounted on an ordinary browsing screen. */
const ALWAYS_ON = [
    /contexts\/AuthContext/,
    /components\/IncomingCallManager/,
    /components\/LiveNowStrip/,
    /components\/BoostedMembersStrip/,
    /components\/StoriesStrip/,
];

const network = found.filter((f) => f.network).sort((a, b) => a.ms - b.ms);

console.log('network timers\n');
console.log('  every    per hour   file');
let idleTotal = 0;
for (const f of network) {
    const perHour = Math.round(3_600_000 / f.ms);
    const alwaysOn = ALWAYS_ON.some((re) => re.test(f.file));
    if (alwaysOn) idleTotal += perHour;
    console.log(`  ${String(f.ms / 1000 + 's').padStart(7)}  ${String(perHour).padStart(8)}   ${f.file}:${f.fn}${alwaysOn ? '   <- runs on every screen' : ''}`);
}

const MONTH = 1_000_000;
console.log(`\nan idle VISIBLE tab on a browsing screen: ~${idleTotal} requests/hour`);
console.log(`the 1,000,000/month free tier is one such tab open for ${Math.round(MONTH / idleTotal)} hours`);
console.log(`spread over 148 accounts that is ${(MONTH / idleTotal / 148).toFixed(0)} hours each, per month`);
console.log('\nA hidden tab now polls nothing at all, so a tab left open in the');
console.log('background — the case that actually accumulates — costs zero.');
console.log('\nNote: Supabase Realtime runs over a websocket straight to Supabase.');
console.log('It does not pass through Vercel, so it costs zero edge requests —');
console.log('which is why migration 090 is now a billing fix, not an optimisation.');
