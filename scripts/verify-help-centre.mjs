/**
 * Does a ticket raised from the help sheet actually land?
 *
 * The sheet posts the same action the profile menu does, so the risk is not the
 * endpoint but the payload: a service key the templates do not know falls back
 * to 'general', which quietly routes a payment problem to the wrong team and
 * sends the wrong auto response. That is invisible from the member's side, so
 * it has to be checked against the table and the template map rather than read.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
    readFileSync('.env.local', 'utf8')
        .split(/\r?\n/)
        .filter((l) => l && !l.startsWith('#') && l.includes('='))
        .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

let pass = 0;
let fail = 0;
const check = (label, ok, detail = '') => {
    if (ok) { pass++; console.log(`  ok    ${label}${detail ? `  ${detail}` : ''}`); }
    else { fail++; console.log(`  FAIL  ${label}${detail ? `  ${detail}` : ''}`); }
};

const topics = readFileSync('src/lib/helpTopics.js', 'utf8');
const route = readFileSync('src/app/api/members/route.js', 'utf8');
const sheet = readFileSync('src/components/HelpCentre.js', 'utf8');

console.log('\nRouting');

// Every service the sheet can send must exist in the template map, or the
// member gets the generic reply for a specific problem.
const templateKeys = [...route.slice(
    route.indexOf('const SUPPORT_RESPONSE_TEMPLATES'),
    route.indexOf('function buildSupportAutoResponse'),
).matchAll(/^    (\w+): \{/gm)].map((m) => m[1]);

const used = [...topics.matchAll(/service: '(\w+)'/g)].map((m) => m[1]);
const unknown = [...new Set(used)].filter((s) => !templateKeys.includes(s));
check('every topic maps to a real support team', unknown.length === 0,
    unknown.length ? `unknown: ${unknown.join(', ')}` : `${new Set(used).size} services across ${used.length} topics`);

// Every internal link a topic offers has to be a route that exists.
{
    const hrefs = [...topics.matchAll(/(?:resolveHref|href): '([^']+)'/g)].map((m) => m[1]);
    const routes = ['/packages', '/wallet', '/profile', '/verification', '/safety', '/facilitation', '/discover', '/matches', '/members', '/messages', '/alerts', '/live'];
    const broken = hrefs.filter((h) => !routes.includes(h));
    check('every link in the help content resolves', broken.length === 0,
        broken.length ? broken.join(', ') : `${hrefs.length} links`);
}

console.log('\nThe table accepts what the sheet sends');
{
    // The exact shape the endpoint builds from the sheet's body.
    const { data: member } = await db.from('users').select('id, email, display_name').eq('is_seed_profile', false).limit(1).maybeSingle();
    check('a real member exists to attribute the ticket to', Boolean(member?.id));

    let ticketId = null;
    if (member?.id) {
        const payload = {
            user_id: member.id,
            subject: 'Package still locked after payment',
            body: 'verification probe, please ignore',
            message: 'verification probe, please ignore',
            service: 'package_unlock',
            status: 'open',
            priority: 'normal',
        };
        const { data, error } = await db.from('support_tickets').insert(payload).select('id, service, status').maybeSingle();
        check('the ticket inserts with the sheet payload', !error, error?.message || '');
        check('the service is stored, not dropped', data?.service === 'package_unlock', data?.service || '');
        check('it opens rather than arriving closed', data?.status === 'open', data?.status || '');
        ticketId = data?.id || null;
    }
    if (ticketId) {
        await db.from('support_tickets').delete().eq('id', ticketId);
        console.log('        probe ticket removed');
    }
}

console.log('\nThe sheet itself');
check('it posts the support_ticket action', /action: 'support_ticket'/.test(sheet));
check('it sends the topic service, not a fixed one', /service: topic\?\.service \|\| 'general'/.test(sheet));
check('it shows the auto response rather than a generic thank you', /data\.autoResponse/.test(sheet));
check('a failed send still offers Telegram', /That did not send[\s\S]{0,80}Telegram/.test(sheet));
check('the answer comes before the ticket form', sheet.indexOf("view === 'topic'") < sheet.indexOf("view === 'escalate'"));
check('it stays off the call and live screens', /const IMMERSIVE = \[\/\^\\\/calls\\\//.test(sheet));
check('it resets when reopened', /setView\('menu'\);[\s\S]{0,120}setSent\(null\)/.test(sheet));
check('the dialog is labelled', /role="dialog"/.test(sheet) && /aria-modal="true"/.test(sheet));
check('the trigger has an accessible name', /aria-label="Get help"/.test(sheet));

console.log('\nBack links follow the reader');
{
    const back = readFileSync('src/components/PolicyBackLink.js', 'utf8');
    check('the destination depends on sign in state', /signedIn \? '\/profile' : '\/auth\/login'/.test(back));
    const pages = ['terms', 'privacy', 'safety', 'community-guidelines', 'contact'];
    const stale = pages.filter((p) => /Back to login/.test(readFileSync(`src/app/${p}/page.js`, 'utf8')));
    check('no page still sends a signed in member to login', stale.length === 0, stale.join(', '));
    const shell = readFileSync('src/components/PolicyPage.js', 'utf8');
    check('the shared policy shell uses it too', /<PolicyBackLink \/>/.test(shell));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
