/**
 * Is mail actually reaching anybody?
 *
 * Every email the app sends is written to email_outbox with a status, and
 * nothing anywhere reads that status back. So when delivery broke, it broke
 * completely and silently: 102 emails sent cleanly up to 8 August 2026, then
 * every single one from 9 August onward failed, and nobody found out for four
 * days. The app kept generating them, kept logging them, and kept reporting
 * success to the code that asked.
 *
 * The provider had been saying exactly what was wrong the whole time, in the
 * provider_response column of every failed row:
 *
 *   "The associated domain with your API key is not verified."
 *
 * That is a dashboard problem rather than a code one, which is precisely why a
 * check belongs here. Nothing in the codebase can fix it, and nothing in the
 * codebase was noticing it.
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

const DAY = 24 * 60 * 60 * 1000;
const since = new Date(Date.now() - 7 * DAY).toISOString();

console.log('\nDelivery over the last seven days');

const { data: recent, error } = await db
    .from('email_outbox')
    .select('subject, status, provider_response, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false });

if (error) {
    console.log(`\nCould not read email_outbox: ${error.message}`);
    process.exit(1);
}

const rows = recent || [];
const sent = rows.filter((r) => r.status === 'sent').length;
const failed = rows.filter((r) => r.status === 'failed').length;
const queued = rows.filter((r) => r.status === 'queued').length;

console.log(`        ${rows.length} attempts: ${sent} sent, ${failed} failed, ${queued} queued`);

/*
  History is not the same as current state, and this cannot tell them apart.

  After the DNS records went live this still reported "82% failing", because
  every row in the window predated the fix by half an hour and nothing new had
  been attempted since. The numbers were true and the impression was wrong.

  There is no way for a script reading a log to know when somebody changed a
  DNS record, so it does not guess. It prints the timestamp of the newest
  attempt in UTC, which is the one fact needed to decide whether these results
  say anything about now, and points at the endpoint that asks the provider
  directly rather than inferring from history.
*/
const newest = rows[0]?.created_at ? new Date(rows[0].created_at) : null;
if (newest) {
    console.log(`        newest attempt: ${newest.toISOString().slice(0, 16)} UTC`);
    console.log('        if that predates your last fix, these numbers are history, not now');
}

if (!rows.length) {
    console.log('        nothing attempted, so there is nothing to judge');
} else {
    /*
      Judge the present, and report the week as context.

      An earlier version failed on the seven day rate, which meant that after
      the August outage was fixed it went on reporting "78% failing" from a
      window still dominated by the fourteen failures that caused all this. A
      check that stays red for a week after the fix teaches people to ignore it,
      and an ignored check is worse than no check.

      What matters is whether mail is going out now. The most recent attempts
      answer that; the week only says how much damage was done.
    */
    const RECENT = 5;
    const recent = rows.slice(0, RECENT);
    const recentFailed = recent.filter((r) => r.status === 'failed').length;

    check('the most recent attempt succeeded', rows[0].status === 'sent',
        rows[0].status === 'sent' ? '' : `it ${rows[0].status}`);
    check(`the last ${recent.length} attempts are not all failing`, recentFailed < recent.length,
        `${recent.length - recentFailed} of ${recent.length} delivered`);

    if (failed) {
        console.log(`        for context, ${failed} of ${rows.length} failed across the whole week`);
    }
}

// Whatever the provider said, said back plainly.
if (failed) {
    const reasons = new Map();
    for (const row of rows.filter((r) => r.status === 'failed')) {
        let message = 'unknown';
        try { message = JSON.parse(row.provider_response || '{}').message || 'unknown'; } catch { /* not json */ }
        reasons.set(message, (reasons.get(message) || 0) + 1);
    }
    console.log('\n        why they failed:');
    for (const [message, count] of [...reasons].sort((a, b) => b[1] - a[1])) {
        console.log(`          ${count}x  ${message.slice(0, 110)}`);
    }
}

console.log('\nConfiguration');
{
    // A missing key is not a failure here, because it is normal locally. It is
    // reported so that a run with no key is not mistaken for a healthy one.
    const hasKey = Boolean(env.RESEND_API_KEY);
    console.log(`        RESEND_API_KEY in .env.local: ${hasKey ? 'present' : 'absent, this machine cannot send'}`);
    console.log(`        RESEND_FROM_EMAIL: ${env.RESEND_FROM_EMAIL || '(not set, falls back to feedback@genuinesugarmummies.co.ke)'}`);

    if (hasKey) {
        const res = await fetch('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` } });
        const data = await res.json().catch(() => ({}));
        if (Array.isArray(data.data)) {
            const verified = data.data.filter((d) => d.status === 'verified');
            check('at least one sending domain is verified', verified.length > 0,
                data.data.map((d) => `${d.name}=${d.status}`).join(', ') || 'no domains registered');
        } else {
            check('the API key is accepted by the provider', false, data.message || `HTTP ${res.status}`);
        }
    }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) {
    console.log('\nThis window contains failures. Whether they describe now depends on the');
    console.log('timestamp above. To ask the provider directly, which sends nothing:');
    console.log('\n  curl -H "Authorization: Bearer $CRON_SECRET" \\');
    console.log('    https://genuine-sugarmummies-app.vercel.app/api/diag/email\n');
    console.log('The Resend key is only on the deployment, so that is the one place that can');
    console.log('answer whether the domain is verified and the key is scoped to it.');
}
/*
  Set the exit code rather than calling process.exit.

  process.exit tears the process down immediately, and if an undici socket from
  the fetch above is still closing, Node aborts with
  'Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)' on Windows. That
  happens after every check has already passed, so the runner saw a non-zero
  exit and reported FAIL directly beneath '0 failed'. Letting Node exit on its
  own lets the socket finish closing first.
*/
process.exitCode = fail ? 1 : 0;