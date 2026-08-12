import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseAdmin';
import { emailHtml, sendAndLogEmail } from '@/lib/email';
import { NUDGE_TEMPLATES, buildDigestEmail, buildNudgeEmail } from '@/lib/emailTemplates';

/**
 * The away mail: a digest for members with something waiting, a nudge for the rest.
 *
 * Event mail already covers the moment somebody messages you. What it cannot do
 * is reach the member who drifted off three weeks ago and has four likes and two
 * views sitting unread, because every one of those events fired while they were
 * marked active and was correctly suppressed. That member never hears anything
 * again, which is how a dating product quietly loses the people it already has.
 *
 * Two rules shape everything here.
 *
 * Nothing is invented. The counts come from that member's own rows, and if they
 * total zero there is no digest, because "you have 0 likes waiting" is worse
 * than silence. The nudge that goes instead makes no claim about them at all.
 *
 * Nothing is sent twice. Cadence is read from email_outbox rather than a new
 * column, which means it survives a redeploy and cannot drift out of sync with
 * what was actually delivered.
 *
 * Dry run is the default. A bare call reports who would receive what and sends
 * nothing, so this can be inspected before it ever reaches an inbox. Sending
 * requires both the secret and an explicit send=1.
 */

export const dynamic = 'force-dynamic';
// Paced sending needs more than the default budget.
export const maxDuration = 60;

/** How long since a member was last seen before away mail is appropriate. */
const AWAY_AFTER_DAYS = 7;
/** The floor between any two pieces of away mail to the same address. */
const MIN_GAP_DAYS = 10;
/*
  How many to work through in one run.

  Sixty at a 600ms gap is roughly a minute of wall clock, which is the whole
  function budget with nothing spare. Twenty five leaves room, and the backlog
  is not urgent: nobody can receive away mail twice inside ten days anyway, so
  spreading the first pass over a few days costs nothing and spreads the
  sending reputation load rather than spiking it.
*/
const BATCH = 25;

const DAY = 24 * 60 * 60 * 1000;
const NUDGE_SUBJECTS = NUDGE_TEMPLATES.map((build) => build({ recipientName: 'x' }).subject);

function unauthorised() {
    return NextResponse.json({ error: 'Not authorised.' }, { status: 401 });
}

/**
 * Counts for one member, each from the table that actually holds it.
 *
 * `since` is the member's last visit, so a digest reports what happened while
 * they were away rather than restating their whole history back at them.
 */
async function countsFor(db, userId, since) {
    const iso = new Date(since).toISOString();
    const head = { count: 'exact', head: true };

    const [messages, likes, views, matches, followers] = await Promise.all([
        db.from('messages').select('*', head).eq('receiver_id', userId).eq('is_read', false),
        db.from('member_likes').select('*', head).eq('liked_id', userId).gte('created_at', iso),
        db.from('profile_views').select('*', head).eq('viewed_id', userId).gte('created_at', iso),
        // member_matches stores the pair ordered as user_low < user_high, so a
        // member can be on either side of the row.
        db.from('member_matches').select('*', head).or(`user_low.eq.${userId},user_high.eq.${userId}`).gte('created_at', iso),
        db.from('user_follows').select('*', head).eq('following_id', userId).gte('created_at', iso),
    ]);

    // A table this deployment does not have must read as zero, never as a crash
    // and never as a number carried over from another count.
    const safe = (result) => (result.error ? 0 : Number(result.count || 0));

    return {
        messages: safe(messages),
        likes: safe(likes),
        views: safe(views),
        matches: safe(matches),
        followers: safe(followers),
    };
}

/** When this address last received anything from us, and which nudge it was. */
async function historyFor(db, email) {
    const { data } = await db
        .from('email_outbox')
        .select('subject, created_at')
        .eq('to_email', email)
        .order('created_at', { ascending: false })
        .limit(25);

    const rows = data || [];
    const lastAt = rows[0]?.created_at ? Date.parse(rows[0].created_at) : 0;
    // The rotation position is read back from what was actually delivered, so a
    // redeploy or a failed run cannot make the sequence restart at the top.
    const lastNudge = rows.find((row) => NUDGE_SUBJECTS.includes(row.subject));
    const lastIndex = lastNudge ? NUDGE_SUBJECTS.indexOf(lastNudge.subject) : -1;
    return { lastAt, lastIndex };
}

export async function GET(request) {
    const url = new URL(request.url);
    const secret = process.env.CRON_SECRET;

    // Without a configured secret this endpoint stays shut. An open route that
    // emails the whole member list is not something to leave to a default.
    if (!secret) {
        return NextResponse.json({ error: 'CRON_SECRET is not configured on this deployment.' }, { status: 503 });
    }
    const offered = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || url.searchParams.get('key');
    if (offered !== secret) return unauthorised();

    const send = url.searchParams.get('send') === '1';
    const db = createServerSupabaseClient({ admin: true });
    if (!db) return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });

    const awayBefore = new Date(Date.now() - AWAY_AFTER_DAYS * DAY).toISOString();

    const { data: members, error } = await db
        .from('users')
        .select('id, email, display_name, last_seen_at')
        .eq('is_seed_profile', false)
        .not('email', 'is', null)
        .is('account_deleted_at', null)
        .or('is_banned.is.null,is_banned.eq.false')
        .or('is_suspended.is.null,is_suspended.eq.false')
        .lt('last_seen_at', awayBefore)
        .order('last_seen_at', { ascending: true })
        .limit(BATCH);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const planned = [];
    let skippedRecent = 0;

    for (const member of members || []) {
        const { lastAt, lastIndex } = await historyFor(db, member.email);
        if (lastAt && Date.now() - lastAt < MIN_GAP_DAYS * DAY) { skippedRecent += 1; continue; }

        const since = member.last_seen_at ? Date.parse(member.last_seen_at) : Date.now() - 30 * DAY;
        const counts = await countsFor(db, member.id, since);

        const digest = buildDigestEmail('activityDigest', {
            recipientName: member.display_name,
            counts,
        });

        // A digest when there is something to report, a nudge when there is not.
        const chosen = digest
            ? { kind: 'digest', email: digest }
            : { kind: 'nudge', ...buildNudgeEmail({ recipientName: member.display_name }, lastIndex, member.id) };

        if (!chosen.email) continue;
        planned.push({ member, counts, ...chosen });
    }

    if (!send) {
        return NextResponse.json({
            ok: true,
            dryRun: true,
            note: 'Nothing was sent. Add send=1 to deliver.',
            considered: members?.length || 0,
            skippedRecent,
            planned: planned.map((item) => ({
                to: item.member.email,
                kind: item.kind,
                subject: item.email.subject,
                counts: item.counts,
            })),
        });
    }

    /*
      Paced, and willing to stop.

      Resend allows two requests a second. This loop had no gap in it at all, so
      the first live batch would have run at whatever rate the network allowed
      and collected 429s for its trouble, filling the outbox with failures that
      look exactly like the outage we just spent a day on.

      It also gives up after a run of consecutive failures. If the provider
      starts refusing, working through the remaining fifty is not going to
      change its mind, and every extra attempt is another failed row obscuring
      whatever the real cause was.
    */
    const GAP_MS = 600;
    const GIVE_UP_AFTER = 5;

    let sent = 0;
    let failed = 0;
    let consecutiveFailures = 0;
    let abandoned = 0;

    for (const [index, item] of planned.entries()) {
        if (consecutiveFailures >= GIVE_UP_AFTER) {
            abandoned = planned.length - index;
            break;
        }
        if (index > 0) await new Promise((resolve) => { setTimeout(resolve, GAP_MS); });

        const result = await sendAndLogEmail(db, {
            to: item.member.email,
            subject: item.email.subject,
            text: item.email.body,
            html: emailHtml(item.email.title, item.email.body, {
                preview: item.email.preview,
                accountName: item.member.display_name || 'GS Member',
                accountEmail: item.member.email,
                actionLabel: item.email.actionLabel,
                actionUrl: item.email.actionUrl,
                secondaryActionLabel: 'Open Genuine Sugar Mummies',
                secondaryActionUrl: '/',
            }),
        });
        if (result?.ok) { sent += 1; consecutiveFailures = 0; }
        else { failed += 1; consecutiveFailures += 1; }
    }

    return NextResponse.json({
        ok: true,
        dryRun: false,
        considered: members?.length || 0,
        skippedRecent,
        sent,
        failed,
        // Non zero means the run stopped early because the provider kept refusing.
        abandoned,
    });
}
