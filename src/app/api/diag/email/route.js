import { NextResponse } from 'next/server';
import { sendAndLogEmail } from '@/lib/email';
import { createServerSupabaseClient } from '@/lib/supabaseAdmin';

/**
 * Can this deployment actually send mail, right now?
 *
 * The outbox check answers a different question. It reads history, so after a
 * DNS fix it keeps reporting the old failures until something new is attempted,
 * and there is no way to tell "still broken" from "nobody has tried since". The
 * only honest answer to whether sending works is to ask the provider.
 *
 * Two levels, because they carry different risk.
 *
 * The default asks Resend which domains it considers verified and sends
 * nothing. That is enough to answer the question after a DNS change, and it
 * cannot reach anybody's inbox.
 *
 * `?to=` sends one real email to one named address. It exists because a
 * verified domain and a working key are not quite the same thing: a key scoped
 * to a different domain passes the first check and still refuses to send. The
 * address has to be given explicitly, so this can never fan out to members.
 *
 * The Resend key lives only on the deployment, never in the repo, which is why
 * this has to run here rather than from a script.
 */

export const dynamic = 'force-dynamic';

export async function GET(request) {
    const url = new URL(request.url);
    const secret = process.env.CRON_SECRET;

    if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 503 });
    const offered = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || url.searchParams.get('key');
    if (offered !== secret) return NextResponse.json({ error: 'Not authorised.' }, { status: 401 });

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL || '(not set)';

    if (!apiKey) {
        return NextResponse.json({ ok: false, reason: 'RESEND_API_KEY is not set on this deployment.', from });
    }

    // What the provider thinks, which is the thing that actually decides.
    let domains = null;
    let keyValid = false;
    try {
        const res = await fetch('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${apiKey}` } });
        const data = await res.json().catch(() => ({}));
        keyValid = res.ok;
        domains = Array.isArray(data.data)
            ? data.data.map((d) => ({ name: d.name, status: d.status, region: d.region || null }))
            : { error: data.message || `HTTP ${res.status}` };
    } catch (error) {
        domains = { error: error.message || 'Could not reach Resend.' };
    }

    const to = String(url.searchParams.get('to') || '').trim();
    if (!to) {
        return NextResponse.json({
            ok: keyValid,
            from,
            keyValid,
            domains,
            note: 'Nothing was sent. Add ?to=you@example.com to attempt one real delivery.',
        });
    }

    if (!to.includes('@')) return NextResponse.json({ error: 'That does not look like an address.' }, { status: 400 });

    /*
      An optional sender override, which is the only way to tell two very
      different problems apart from behind a send-only key.

      Resend rejects with "the associated domain with your API key is not
      verified" both when the domain genuinely is not verified and when the key
      is scoped to some other domain. The dashboard can show verified while the
      key still points elsewhere, because verifying a domain does not
      retroactively re-associate a key that was issued against a different one.
      Sending the same message from Resend's own test sender separates them: if
      that goes through, the key works and the scope is the problem.
    */
    const fromOverride = String(url.searchParams.get('from') || '').trim();

    /*
      Logged to email_outbox like any other send.

      The first version called sendEmail directly, so a successful test left no
      trace and verify-email-delivery went on reporting the outage that had just
      been fixed. A health check that cannot see the thing proving it healthy is
      not much of a health check.
    */
    const db = createServerSupabaseClient({ admin: true });
    const attempt = await sendAndLogEmail(db, {
        to,
        subject: 'GS delivery test',
        text: 'This is a delivery test from Genuine Sugar Mummies. Nothing is wrong with your account.',
        ...(fromOverride ? { from: fromOverride } : {}),
    });

    return NextResponse.json({
        ok: Boolean(attempt.ok),
        from,
        keyValid,
        domains,
        sentTo: to,
        sentFrom: fromOverride || from,
        // Whatever the provider said, passed through rather than summarised, so
        // a scoping problem is distinguishable from a verification one.
        providerSaid: attempt.ok ? 'accepted' : (attempt.error || 'unknown'),
    });
}
