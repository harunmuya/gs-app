/**
 * The tap to send openers, in one place.
 *
 * These lived twice, once on the member profile and once in the chat thread,
 * and the two copies had already drifted: the profile offered Hello, Sweet,
 * Interested and the thread offered Hello, Interested, Sweet. Nobody chose
 * that. It is what happens when the same list is typed out in two files and
 * somebody reorders one of them.
 *
 * The order matters more than it looks. These sit in a horizontal strip and
 * most people never scroll it, so whichever three come first are the ones that
 * get sent. Deciding that once, here, is the point.
 */

export const QUICK_REPLIES = [
    { label: 'Hello', text: 'Hello, I would like to know you better.' },
    { label: 'Interested', text: 'I am interested in your profile.' },
    { label: 'Sweet', text: 'You look sweet and interesting.' },
    { label: 'Coffee', text: 'A coffee date sounds nice.' },
    { label: 'Thanks', text: 'Thank you for replying.' },
    { label: 'Call?', text: 'Can we plan a voice call when you are free?' },
];

export const REACTION_REPLIES = [
    { name: 'Sparkle', text: 'You have a bright profile.' },
    { name: 'Heart', text: 'I like your profile.' },
    { name: 'Smile', text: 'Your profile made me smile.' },
];
