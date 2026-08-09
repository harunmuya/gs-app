/**
 * Typed notification emails.
 *
 * The app writes in-app notifications for messages, likes, matches, calls and
 * live streams, but only three of those ever reached an inbox: verification,
 * package updates and a live alert. A member who closes the app hears nothing
 * about the message waiting for them, which is the single largest reason people
 * stop coming back to a dating product.
 *
 * Copy rules, applied throughout this file:
 *
 *   No em dashes, en dashes, or " - " used as a separator. Sentences are split
 *   with full stops. The dash habit is the clearest tell of machine written
 *   copy, and it reads as filler in an email that is trying to sound like a
 *   person.
 *
 *   No exclamation marks, no "Hey there", no invented urgency. The subject says
 *   what happened. The body says who and what to do about it.
 *
 * Every template returns { subject, preview, title, body, actionLabel,
 * actionUrl } so the caller only chooses which one to send.
 */

const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || 'there';

/** Trim a message down to something an inbox can preview without spoiling it. */
function excerpt(text, max = 90) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return '';
    return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export const EMAIL_TEMPLATES = {
    /** Somebody sent a chat message. */
    message: ({ recipientName, senderName, preview: body }) => ({
        subject: `${senderName} sent you a message`,
        preview: excerpt(body) || 'Open the app to read it.',
        title: `${senderName} sent you a message`,
        body: [
            `Hello ${firstName(recipientName)},`,
            '',
            `${senderName} has messaged you on Genuine Sugar Mummies.`,
            body ? `\n"${excerpt(body, 160)}"\n` : '',
            'Replies are private between the two of you. Nobody else can read them.',
        ].filter(Boolean).join('\n'),
        actionLabel: 'Read and reply',
        actionUrl: '/messages',
    }),

    /** A missed voice or video call. */
    missedCall: ({ recipientName, callerName, callType }) => ({
        subject: `Missed ${callType === 'video' ? 'video' : 'voice'} call from ${callerName}`,
        preview: 'They tried to reach you while you were away.',
        title: `You missed a call from ${callerName}`,
        body: [
            `Hello ${firstName(recipientName)},`,
            '',
            `${callerName} tried to reach you with a ${callType === 'video' ? 'video' : 'voice'} call and could not get through.`,
            '',
            'You can call them back from their profile, or send a message if now is not a good time.',
        ].join('\n'),
        actionLabel: 'Call them back',
        actionUrl: '/messages',
    }),

    /** Somebody liked the recipient. */
    like: ({ recipientName, likerName, isSuperLike }) => ({
        subject: isSuperLike ? `${likerName} super liked you` : `${likerName} liked your profile`,
        preview: 'Like them back to start talking.',
        title: isSuperLike ? `${likerName} super liked you` : `${likerName} liked your profile`,
        body: [
            `Hello ${firstName(recipientName)},`,
            '',
            `${likerName} ${isSuperLike ? 'super liked' : 'liked'} your profile.`,
            '',
            'If you like them back it becomes a match, and then either of you can start the conversation.',
        ].join('\n'),
        actionLabel: 'See who liked you',
        actionUrl: '/matches',
    }),

    /** Both sides liked each other. */
    match: ({ recipientName, matchName }) => ({
        subject: `You matched with ${matchName}`,
        preview: 'You both liked each other. You can message now.',
        title: `You and ${matchName} matched`,
        body: [
            `Hello ${firstName(recipientName)},`,
            '',
            `You and ${matchName} liked each other, so you can now message directly.`,
            '',
            'Most conversations that go anywhere start within a day. A short first message asking about something on their profile works better than a greeting on its own.',
        ].join('\n'),
        actionLabel: 'Say hello',
        actionUrl: '/matches',
    }),

    /** Somebody the member follows started broadcasting. */
    live: ({ recipientName, hostName, streamTitle, streamId }) => ({
        subject: `${hostName} is live now`,
        preview: streamTitle || 'Join before the stream ends.',
        title: `${hostName} is live`,
        body: [
            `Hello ${firstName(recipientName)},`,
            '',
            `${hostName} started a live stream${streamTitle ? `: ${streamTitle}` : ''}.`,
            '',
            'You can watch, comment and send gifts while they are on. Streams are not recorded, so it is only there while it runs.',
        ].join('\n'),
        actionLabel: 'Join the stream',
        actionUrl: streamId ? `/live/${streamId}` : '/live',
    }),

    /** Somebody started following. */
    follow: ({ recipientName, followerName }) => ({
        subject: `${followerName} started following you`,
        preview: 'They will see when you post a story or go live.',
        title: `${followerName} started following you`,
        body: [
            `Hello ${firstName(recipientName)},`,
            '',
            `${followerName} is now following your profile. They will see your stories and know when you go live.`,
            '',
            'You can look at their profile and follow back if you are interested.',
        ].join('\n'),
        actionLabel: 'View their profile',
        actionUrl: '/matches',
    }),

    /** A gift arrived. */
    gift: ({ recipientName, senderName, giftName }) => ({
        subject: `${senderName} sent you a gift`,
        preview: giftName ? `They sent you a ${giftName}.` : 'Open the app to see it.',
        title: `${senderName} sent you a gift`,
        body: [
            `Hello ${firstName(recipientName)},`,
            '',
            `${senderName} sent you ${giftName ? `a ${giftName}` : 'a gift'}.`,
            '',
            'Gifts show on your profile and in your wallet. A short thank you goes a long way.',
        ].join('\n'),
        actionLabel: 'See your gift',
        actionUrl: '/wallet',
    }),

    /** Somebody viewed the profile. Silver and Gold only, since only they can see who. */
    profileView: ({ recipientName, viewerCount }) => ({
        subject: viewerCount > 1 ? `${viewerCount} people viewed your profile` : 'Someone viewed your profile',
        preview: 'See who has been looking.',
        title: viewerCount > 1 ? `${viewerCount} people viewed your profile` : 'Someone viewed your profile',
        body: [
            `Hello ${firstName(recipientName)},`,
            '',
            viewerCount > 1
                ? `${viewerCount} members opened your profile recently.`
                : 'A member opened your profile recently.',
            '',
            'Your package lets you see exactly who they were.',
        ].join('\n'),
        actionLabel: 'See your viewers',
        actionUrl: '/profile?section=activity',
    }),
};

/**
 * Which notification types are worth an email.
 *
 * Deliberately not everything. A story view or a swipe is not worth an inbox
 * interruption, and an app that emails about everything gets filtered to spam,
 * taking the messages that did matter with it.
 */
export const EMAILABLE = new Set([
    'message', 'member_message', 'missedCall', 'call_status',
    'like', 'superlike', 'match', 'live', 'followed_live', 'follow', 'gift',
]);

export function buildNotificationEmail(type, data) {
    const template = EMAIL_TEMPLATES[type];
    if (!template) return null;
    try {
        return template(data || {});
    } catch {
        return null;
    }
}
