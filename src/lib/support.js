/**
 * How to reach Admin Mary G. One definition, used everywhere.
 *
 * The Telegram handle was written by hand into seven files, including two email
 * bodies in an API route, so changing it meant finding all seven and any one
 * missed would quietly send members somewhere that no longer answers.
 *
 * This lives in lib rather than beside the component because the server needs it
 * too: the package unlock and connection request emails both name the handle,
 * and a route cannot import from a 'use client' module without dragging the
 * whole component across the boundary.
 */

export const SUPPORT = {
    telegram: {
        handle: 'GSADMINMARYGAGENCY',
        url: 'https://t.me/GSADMINMARYGAGENCY',
        label: 'Telegram',
        detail: 'Fastest reply, usually within the hour',
    },
    whatsapp: {
        number: '+254738871048',
        url: 'https://wa.me/254738871048',
        label: 'WhatsApp',
        detail: 'For payments and account questions',
    },
    email: {
        address: 'support@genuinesugarmummies.co.ke',
        url: 'mailto:support@genuinesugarmummies.co.ke',
        label: 'Email',
        detail: 'For anything that needs a record',
    },
    sms: {
        number: '+254738871048',
        url: 'sms:+254738871048',
        label: 'SMS',
        detail: 'If you have no data',
    },
};

// The form used inside prose and email bodies.
export const TELEGRAM_MENTION = `@${SUPPORT.telegram.handle}`;
