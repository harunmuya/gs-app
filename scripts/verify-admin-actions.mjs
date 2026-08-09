/**
 * Check that every admin action the panel sends is one the server implements,
 * and that it sends the parameters that handler reads.
 *
 * This is the failure mode that keeps recurring in this codebase: the call and
 * the handler drift apart, the request returns 200 or a vague 500, and nothing
 * says which field was wrong. `live_comments.content` vs `body` and
 * `call_events.actor_id` vs `user_id` were both this shape.
 *
 * Heuristic, so read the output rather than trusting a green tick: it reads
 * `body.<name>` references inside each handler block and compares them to the
 * keys the panel puts in the payload for that action.
 */
import { readFileSync } from 'node:fs';

const panel = readFileSync('src/app/admin/page.js', 'utf8');
const server = readFileSync('src/app/api/admin/route.js', 'utf8');

/** Every `if (body.action === 'x')` block and the body.* fields it reads. */
function serverHandlers(text) {
    const handlers = new Map();
    const re = /body\.action === '([a-z_]+)'/g;
    const starts = [];
    let m;
    while ((m = re.exec(text))) starts.push({ action: m[1], index: m.index });
    starts.forEach((s, i) => {
        const end = i + 1 < starts.length ? starts[i + 1].index : text.length;
        const block = text.slice(s.index, end);
        const fields = new Set();
        for (const f of block.matchAll(/body\.([a-zA-Z_][\w]*)/g)) {
            if (f[1] !== 'action') fields.add(f[1]);
        }
        handlers.set(s.action, fields);
    });
    return handlers;
}

/** Every adminAction({...}) payload in the panel, per action. */
function panelCalls(text) {
    const calls = [];
    const re = /adminAction\(\s*\{([\s\S]{0,400}?)\}\s*,/g;
    let m;
    while ((m = re.exec(text))) {
        const payload = m[1];
        const actions = [...payload.matchAll(/action:\s*(?:[^?]*\?\s*)?'([a-z_]+)'(?:\s*:\s*'([a-z_]+)')?/g)];
        const keys = new Set();
        // Explicit `name: value`
        for (const k of payload.matchAll(/(?:^|[,{\s])([a-zA-Z_][\w]*)\s*:/g)) {
            if (k[1] !== 'action') keys.add(k[1]);
        }
        // Shorthand `tier,` — missed by the pattern above, which is why the
        // first run of this script reported set_package as not sending `tier`
        // when it plainly does.
        for (const k of payload.matchAll(/(?:^|,)\s*([a-zA-Z_][\w]*)\s*(?=[,}]|$)/g)) {
            if (k[1] !== 'action') keys.add(k[1]);
        }
        // Spread `...ticket` — the keys come from elsewhere, so treat the
        // payload as unknown rather than as empty and flag everything.
        if (/\.\.\.\w+/.test(payload)) keys.add('*');
        for (const a of actions) {
            if (a[1]) calls.push({ action: a[1], keys });
            if (a[2]) calls.push({ action: a[2], keys });
        }
    }
    // Actions dispatched through a variable, as UserModeration does.
    const dynamic = [...text.matchAll(/onAction\(['"]([a-z_]+)['"]/g)].map((d) => d[1]);
    return { calls, dynamic };
}

const handlers = serverHandlers(server);
const { calls, dynamic } = panelCalls(panel);

// UserModeration sends { action, userId } for each of its actions.
const moderation = readFileSync('src/app/admin/UserModeration.js', 'utf8');
for (const m of moderation.matchAll(/onAction\('([a-z_]+)'/g)) {
    calls.push({ action: m[1], keys: new Set(['userId']) });
}

let problems = 0;

console.log('=== panel actions with no server handler');
const unknown = [...new Set(calls.map((c) => c.action))].filter((a) => !handlers.has(a));
if (unknown.length) { problems += unknown.length; unknown.forEach((a) => console.log(`  MISSING HANDLER  ${a}`)); }
else console.log('  none');

console.log('\n=== server handlers the panel never calls');
const called = new Set(calls.map((c) => c.action));
const unused = [...handlers.keys()].filter((a) => !called.has(a) && !dynamic.includes(a));
console.log(unused.length ? unused.map((a) => `  unreachable      ${a}`).join('\n') : '  none');

console.log('\n=== required parameters the panel may not be sending');
// Fields the handler reads without a fallback are the ones that matter.
for (const { action, keys } of calls) {
    const fields = handlers.get(action);
    if (!fields) continue;
    // A spread payload could carry anything; reporting it would be noise.
    if (keys.has('*')) continue;
    const missing = [...fields].filter((f) => {
        if (keys.has(f)) return false;
        // Ignore fields the handler guards with || or ?? — those are optional.
        const block = server.slice(server.indexOf(`body.action === '${action}'`));
        const guarded = new RegExp(`body\\.${f}\\s*(\\|\\||\\?\\?|===|!==|\\?)`).test(block.slice(0, 1500));
        return !guarded;
    });
    if (missing.length) {
        problems += missing.length;
        console.log(`  ${action}: handler reads ${missing.join(', ')} — payload sends ${[...keys].join(', ') || '(nothing)'}`);
    }
}
if (!problems) console.log('  none');

console.log(problems ? `\n${problems} issue(s) to review` : '\nno mismatches found');
process.exit(0);
