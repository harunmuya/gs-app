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
/*
  The digest, and the nudge.

  Everything above fires on a single event, which means a member who gets three
  likes and two views in a day either receives five separate emails or, if the
  event templates are throttled, none at all. Neither is what brings somebody
  back. A digest says what happened while they were away, once, with real
  numbers taken from their own rows.

  The nudge is for the member with nothing waiting. There is no honest event to
  report, so it does not invent one. It says what is on the app right now and
  leaves it there.

  Both are separate from EMAILABLE on purpose. That set governs event mail,
  which is triggered by another member's action. These are sent by us, and the
  rules for that are stricter: never to a member who has been active recently,
  never more than the cadence in the digest route, and never with a number that
  is not real.
*/

/** "3 likes, 2 profile views" from a counts object, skipping the zeroes. */
function countLine(counts = {}) {
    const parts = [];
    const add = (n, one, many) => { if (n > 0) parts.push(`${n} ${n === 1 ? one : many}`); };
    add(counts.messages, 'unread message', 'unread messages');
    add(counts.likes, 'like', 'likes');
    add(counts.views, 'profile view', 'profile views');
    add(counts.matches, 'new match', 'new matches');
    add(counts.followers, 'new follower', 'new followers');
    if (!parts.length) return '';
    if (parts.length === 1) return parts[0];
    return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

export const DIGEST_TEMPLATES = {
    /**
     * What happened while they were away. Only sent when something did.
     */
    activityDigest: ({ recipientName, counts = {}, topLikerName = '' }) => {
        const summary = countLine(counts);
        if (!summary) return null;
        return {
            subject: `You have ${summary} waiting`,
            preview: 'Here is what happened while you were away.',
            title: 'While you were away',
            body: [
                `Hello ${firstName(recipientName)},`,
                '',
                `You have ${summary} on Genuine Sugar Mummies.`,
                topLikerName ? `\n${topLikerName} is one of the people who liked your profile.` : '',
                '',
                'Everything is waiting in your account. Nobody can see that you read this.',
            ].filter(Boolean).join('\n'),
            actionLabel: 'See what is waiting',
            actionUrl: '/alerts',
        };
    },
};

/*
  The nudges.

  Five of them, rotated so a member who goes quiet for a month does not get the
  same sentence four times. Each one is a true statement about the app rather
  than a claim about them: none of these says somebody is waiting, or that they
  have been missed, or invents a number. A dating product that lies to get an
  open is a product people stop trusting the moment they open it.
*/
export const NUDGE_TEMPLATES = [
    ({ recipientName }) => ({
        subject: 'New members joined near you',
        preview: 'Profiles in your area have changed since you last looked.',
        title: 'New members near you',
        body: [
            `Hello ${firstName(recipientName)},`,
            '',
            'People have joined and updated their profiles since you last opened the app.',
            'Nearby shows who is closest to you, and the distances update as members set their towns.',
        ].join('\n'),
        actionLabel: 'See who is nearby',
        actionUrl: '/discover',
    }),
    ({ recipientName }) => ({
        subject: 'Your profile works harder when it is complete',
        preview: 'A photo and a few lines change how often you are seen.',
        title: 'Finish your profile',
        body: [
            `Hello ${firstName(recipientName)},`,
            '',
            'Profiles with a clear photo and a few honest lines get seen more often than ones without.',
            'It takes about a minute, and you can change it whenever you want.',
        ].join('\n'),
        actionLabel: 'Update my profile',
        actionUrl: '/profile',
    }),
    ({ recipientName }) => ({
        subject: 'Get the verified badge on your profile',
        preview: 'Verification tells other members you are real.',
        title: 'Verification is open',
        body: [
            `Hello ${firstName(recipientName)},`,
            '',
            'Verified profiles carry a badge that tells other members somebody checked they are real.',
            'It is a single photo, reviewed by our team, and it stays on your profile once approved.',
        ].join('\n'),
        actionLabel: 'How verification works',
        actionUrl: '/verification',
    }),
    ({ recipientName }) => ({
        subject: 'Calls and live streaming are on Silver and Gold',
        preview: 'What the paid packages open up.',
        title: 'What the packages open',
        body: [
            `Hello ${firstName(recipientName)},`,
            '',
            'Voice calls, video calls and going live are on the Silver and Gold packages.',
            'Both are paid once and stay on the account. There is no monthly charge.',
        ].join('\n'),
        actionLabel: 'See the packages',
        actionUrl: '/packages',
    }),
    ({ recipientName }) => ({
        subject: 'A reminder about staying safe here',
        preview: 'Nobody genuine will ask you to send money.',
        title: 'Staying safe',
        body: [
            `Hello ${firstName(recipientName)},`,
            '',
            'Nobody genuine will ask you to send money, and we never ask for your PIN or your password.',
            'If someone does, report the profile. Our team acts on those.',
        ].join('\n'),
        actionLabel: 'Read the safety guidance',
        actionUrl: '/safety',
    }),
];

/**
 * Pick a nudge that is not the one this member last received.
 *
 * Rotating by a stored index rather than at random is deliberate. Random
 * repeats: over five sends there is better than a two in three chance of seeing
 * the same one twice, and a member who gets the same sentence twice reads the
 * whole thing as automated and stops opening it.
 */
export function buildNudgeEmail(data = {}, lastIndex = -1) {
    /*
      `Number(lastIndex) || -1` looks equivalent and is not: 0 is falsy, so a
      member who last received nudge 0 was read as having received none, and got
      nudge 0 again. Forever. The rotation never left the first template.
    */
    const previous = Number.isInteger(Number(lastIndex)) ? Number(lastIndex) : -1;
    const next = (previous + 1) % NUDGE_TEMPLATES.length;
    try {
        return { index: next, email: NUDGE_TEMPLATES[next](data) };
    } catch {
        return null;
    }
}

export function buildDigestEmail(type, data) {
    const template = DIGEST_TEMPLATES[type];
    if (!template) return null;
    try {
        return template(data || {});
    } catch {
        return null;
    }
}

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
