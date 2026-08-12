/**
 * What members actually get stuck on, and what to tell them first.
 *
 * Support was a list of four contact channels. That is a phone number, not
 * help: it hands every question to Admin Mary G, including the ones with a
 * fixed answer she has already given a hundred times, and it makes the member
 * wait for a reply to something they could have solved in ten seconds.
 *
 * Each topic here leads with the answer. Only if that does not settle it does
 * the member go on to raise a ticket or open Telegram, which means the messages
 * that do reach Admin Mary G are the ones that genuinely need her.
 *
 * `service` matches the keys the support_tickets table already uses, so a
 * ticket raised from here is routed and auto answered exactly like one raised
 * from the profile menu.
 */

export const HELP_TOPICS = [
    {
        id: 'package_unlock',
        service: 'package_unlock',
        label: 'I paid but my package is still locked',
        blurb: 'Unlocks are approved by hand, so there is a short wait.',
        steps: [
            'Payments are checked against the M-Pesa reference before anything is unlocked. That check is done by a person, not automatically, so allow a little time after paying.',
            'Open your Wallet and confirm the payment shows there. If it does not, the reference has not reached us yet.',
            'Have the M-Pesa message ready. The reference code, the amount, and the number you paid from are the three things needed to match it to your account.',
        ],
        resolveLabel: 'Open my wallet',
        resolveHref: '/wallet',
        escalateHint: 'Include your M-Pesa reference and the package you paid for.',
        subject: 'Package still locked after payment',
    },
    {
        id: 'payment_issue',
        service: 'payment_issue',
        label: 'Something went wrong with a payment',
        blurb: 'Money taken, wrong amount, or a payment you do not recognise.',
        steps: [
            'Check your Wallet first. Every payment that reached us appears there with its reference and the date.',
            'We never ask for your M-Pesa PIN, and we never ask you to pay a personal number that did not come from inside this app. If someone did, that was not us. Report it as a safety issue.',
            'If the amount is wrong or the payment is missing from your Wallet, raise it below with the reference so Billing can trace it.',
        ],
        resolveLabel: 'Open my wallet',
        resolveHref: '/wallet',
        escalateHint: 'Include the M-Pesa reference, the amount, and the date.',
        subject: 'Payment problem',
    },
    {
        id: 'upgrade',
        service: 'package_unlock',
        label: 'I want to upgrade my package',
        blurb: 'What each package opens, and how to move up.',
        steps: [
            'Packages are lifetime, not monthly. You pay once and the features stay open on your account.',
            'Silver and Gold are what unlock voice calls, video calls, and going live. Messaging limits lift with them too.',
            'Choose the package first, then pay. Ask Admin Mary G for the current payment number before you send anything, because the number is confirmed per payment and never posted publicly.',
        ],
        resolveLabel: 'See the packages',
        resolveHref: '/packages',
        escalateHint: 'Say which package you want and Admin Mary G will send the payment number.',
        subject: 'Package upgrade',
    },
    {
        id: 'verification',
        service: 'verification',
        label: 'My verification has not come through',
        blurb: 'What is checked, and how long it takes.',
        steps: [
            'Verification compares the photo you submitted against the photos on your profile. A blurred, dark, or heavily filtered photo is the usual reason one is sent back.',
            'The badge appears on your profile as soon as it is approved. You do not need to do anything else.',
            'If it has been longer than a couple of days, or your submission was rejected and you do not know why, ask below.',
        ],
        resolveLabel: 'How verification works',
        resolveHref: '/verification',
        escalateHint: 'Say the date you submitted your photo.',
        subject: 'Verification not approved yet',
    },
    {
        id: 'safety_report',
        service: 'safety_report',
        label: 'I want to report someone',
        blurb: 'A fake profile, a scam, or someone behaving badly.',
        steps: [
            'Report the profile from the profile itself. That attaches the account to the report, which is faster than describing it.',
            'Never send money to anyone you met here, whatever reason they give. Nobody genuine will ask you to.',
            'If money has already changed hands, say so below. That changes how urgently it is handled.',
        ],
        resolveLabel: 'Read the safety guidance',
        resolveHref: '/safety',
        escalateHint: 'Give the profile name or the link, and what happened.',
        subject: 'Report a member',
    },
    {
        id: 'account_profile',
        service: 'account_profile',
        label: 'I cannot change something on my profile',
        blurb: 'Photos, details, or settings that will not save.',
        steps: [
            'Changes save when you press Save at the bottom of the section you edited. Moving away before that discards them.',
            'A photo that will not upload is usually too large. Anything under 8MB goes through.',
            'If a change saves and then comes back, tell us which field below.',
        ],
        resolveLabel: 'Open my profile',
        resolveHref: '/profile',
        escalateHint: 'Say which field, and what happens when you save it.',
        subject: 'Profile change will not save',
    },
    {
        id: 'direct_connection',
        service: 'direct_connection',
        label: 'I want help connecting with someone',
        blurb: 'How introductions work, and what they are not.',
        steps: [
            'You choose the person. Nobody is assigned to you, and anyone promising to pick someone for you is not working for us.',
            'Some listings are introductions our team made rather than accounts that sign in. Those are marked, and you reach them through us rather than by messaging directly.',
            'Ask below with the profile you have in mind and Admin Mary G will tell you what is possible.',
        ],
        resolveLabel: 'How introductions work',
        resolveHref: '/facilitation',
        escalateHint: 'Name the profile you are interested in.',
        subject: 'Help with an introduction',
    },
    {
        id: 'general',
        service: 'general',
        label: 'Something else',
        blurb: 'Anything the topics above do not cover.',
        steps: [
            'Tell us what you were trying to do and what happened instead. Those two things answer most questions on their own.',
            'If it is about an account, include the email you signed up with.',
        ],
        escalateHint: 'The more specific, the faster the reply.',
        subject: 'Support request',
    },
];

/** The shortcuts worth reaching without going through a topic at all. */
export const HELP_SHORTCUTS = [
    { id: 'packages', label: 'Upgrade package', href: '/packages', hint: 'Silver and Gold' },
    { id: 'wallet', label: 'Wallet and payments', href: '/wallet', hint: 'Credits and history' },
    { id: 'verification', label: 'Get verified', href: '/verification', hint: 'How it works' },
    { id: 'safety', label: 'Safety centre', href: '/safety', hint: 'Staying safe' },
];

export function topicById(id) {
    return HELP_TOPICS.find((topic) => topic.id === id) || null;
}
