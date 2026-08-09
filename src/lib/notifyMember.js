import { emailHtml, sendAndLogEmail } from '@/lib/email';
import { buildNotificationEmail } from '@/lib/emailTemplates';

/**
 * Write an in-app notification and, when it is worth it, email the member too.
 *
 * The app had twelve places writing to user_notifications and only three that
 * ever sent an email. So a member who closed the app was told nothing about the
 * message waiting for them, the like they received, or the match they made. For
 * a dating product that is the whole retention loop missing.
 *
 * Two rules keep this from becoming spam:
 *
 *   Only email somebody who is away. If they were active in the last few
 *   minutes they are looking at the app and the in-app notification has already
 *   done the job. Emailing on top of that is noise, and noise is what gets a
 *   sender filtered into spam, taking the messages that did matter with it.
 *
 *   Only email types worth interrupting for. A profile view or a swipe is not.
 *   EMAILABLE in lib/emailTemplates is the list.
 *
 * Email failure never blocks the notification. The in-app record is the one that
 * must exist; the email is a courtesy on top.
 */

/** Treated as "in the app right now", so no email. */
const ACTIVE_WINDOW_MS = 5 * 60 * 1000;

export async function notifyMember(supabase, {
    userId,
    type,
    title,
    body,
    metadata = {},
    email: emailSpec = null,
}) {
    if (!userId || !type) return { ok: false, reason: 'missing-target' };

    const { error } = await supabase.from('user_notifications').insert({
        user_id: userId,
        type,
        title,
        body,
        metadata,
    });
    if (error) {
        console.error('[notifyMember] notification insert failed:', error.message);
        return { ok: false, reason: 'insert-failed' };
    }

    if (!emailSpec) return { ok: true, emailed: false };

    try {
        const { data: recipient } = await supabase
            .from('users')
            .select('id, email, display_name, last_seen_at, is_banned, is_suspended, account_deleted_at')
            .eq('id', userId)
            .maybeSingle();

        if (!recipient?.email) return { ok: true, emailed: false, reason: 'no-address' };
        // Never email an account that has been closed or blocked.
        if (recipient.is_banned || recipient.is_suspended || recipient.account_deleted_at) {
            return { ok: true, emailed: false, reason: 'restricted' };
        }

        const lastSeen = recipient.last_seen_at ? Date.parse(recipient.last_seen_at) : 0;
        if (lastSeen && Date.now() - lastSeen < ACTIVE_WINDOW_MS) {
            return { ok: true, emailed: false, reason: 'active' };
        }

        const template = buildNotificationEmail(emailSpec.template, {
            recipientName: recipient.display_name || 'there',
            ...emailSpec.data,
        });
        if (!template) return { ok: true, emailed: false, reason: 'no-template' };

        await sendAndLogEmail(supabase, {
            to: recipient.email,
            subject: template.subject,
            text: template.body,
            html: emailHtml(template.title, template.body, {
                preview: template.preview,
                accountName: recipient.display_name || 'GS Member',
                accountEmail: recipient.email,
                actionLabel: template.actionLabel,
                actionUrl: template.actionUrl,
                secondaryActionLabel: 'Open Genuine Sugar Mummies',
                secondaryActionUrl: '/',
            }),
        });
        return { ok: true, emailed: true };
    } catch (err) {
        // A failed send is logged and dropped. The member still has the in-app
        // notification, which is the record that matters.
        console.error('[notifyMember] email failed:', err?.message || err);
        return { ok: true, emailed: false, reason: 'send-failed' };
    }
}
