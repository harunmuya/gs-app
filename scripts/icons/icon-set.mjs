/**
 * Genuine Sugarmummies icon set.
 *
 * House style, applied to every glyph:
 *   - 24x24 viewBox, artwork inset to a 20px live area (2px padding)
 *   - stroke-based, 1.75 stroke width, round caps and joins
 *   - stroke="currentColor", fill="none" unless a glyph is deliberately solid
 *   - geometry snapped to whole or half pixels so edges stay crisp at 16-24px
 *
 * Each entry is the inner markup of a <symbol>. Keep them free of ids, classes,
 * and hardcoded colours: the sprite builder wraps them and the Icon component
 * supplies sizing and colour.
 *
 * To add an icon: add a key here and run `node scripts/build-icons.mjs`.
 */

export const STROKE_DEFAULTS = {
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.75',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
};

export const ICONS = {
    // --- navigation ---------------------------------------------------------
    'arrow-left': '<path d="M19 12H5"/><path d="m11 18-6-6 6-6"/>',
    'arrow-right': '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
    'chevron-right': '<path d="m9 5 7 7-7 7"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-3.6-3.6"/>',
    filter: '<path d="M3 5h18"/><path d="M7 12h10"/><path d="M10 19h4"/>',
    'sliders-horizontal': '<path d="M4 7h10"/><path d="M18 7h2"/><path d="M4 17h4"/><path d="M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
    'external-link': '<path d="M14 4h6v6"/><path d="m20 4-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    x: '<path d="m6 6 12 12"/><path d="m18 6-12 12"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    check: '<path d="m5 13 4.5 4.5L19 7"/>',
    'check-check': '<path d="m2 13 3.5 3.5L13 9"/><path d="m11 15 1.5 1.5L22 7"/>',
    'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/>',
    'refresh-cw': '<path d="M20 11a8 8 0 0 0-13.7-4.9L3 9"/><path d="M4 13a8 8 0 0 0 13.7 4.9L21 15"/><path d="M3 4v5h5"/><path d="M21 20v-5h-5"/>',
    history: '<path d="M3.5 9A9 9 0 1 1 3 12.5"/><path d="M3 4v5h5"/><path d="M12 8v4.5l3 1.7"/>',

    // --- people -------------------------------------------------------------
    user: '<circle cx="12" cy="8" r="3.75"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
    'circle-user-round': '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M6.5 18.5a6 6 0 0 1 11 0"/>',
    'user-plus': '<circle cx="10" cy="8" r="3.75"/><path d="M3 20a7 7 0 0 1 12.2-4.7"/><path d="M18 13v6"/><path d="M15 16h6"/>',
    'user-check': '<circle cx="10" cy="8" r="3.75"/><path d="M3 20a7 7 0 0 1 11.6-5.2"/><path d="m16 17 2 2 4-4"/>',
    'user-round-check': '<circle cx="10" cy="8" r="3.75"/><path d="M3 20a7 7 0 0 1 11.6-5.2"/><path d="m16 17 2 2 4-4"/>',
    'user-cog': '<circle cx="9" cy="8" r="3.75"/><path d="M3 20a6.5 6.5 0 0 1 9.5-5.8"/><circle cx="18" cy="17" r="2.5"/><path d="M18 13v1.2"/><path d="M18 19.8V21"/><path d="m21.5 15-1 .6"/><path d="m15.5 18.4-1 .6"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/>',
    'users-round': '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/>',
    'at-sign': '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>',

    // --- dating / social ----------------------------------------------------
    heart: '<path d="M12 20s-7.5-4.6-7.5-9.5A4.5 4.5 0 0 1 12 7.6a4.5 4.5 0 0 1 7.5 2.9C19.5 15.4 12 20 12 20Z"/>',
    'heart-handshake': '<path d="M12 20s-7.5-4.6-7.5-9.5A4.5 4.5 0 0 1 12 7.6a4.5 4.5 0 0 1 7.5 2.9C19.5 15.4 12 20 12 20Z"/><path d="m9.5 12 1.7 1.7a1.2 1.2 0 0 0 1.7 0L15 11.5"/>',
    star: '<path d="m12 4 2.4 5 5.6.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.6-.8z"/>',
    sparkles: '<path d="m12 4 1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6z"/><path d="M18.5 15.5 19 17l1.5.5L19 18l-.5 1.5L18 18l-1.5-.5L18 17z"/>',
    gift: '<rect x="3.5" y="9.5" width="17" height="10.5" rx="1.5"/><path d="M3.5 13.5h17"/><path d="M12 9.5V20"/><path d="M12 9.5S10.5 4 8 4a2.2 2.2 0 0 0 0 5.5z"/><path d="M12 9.5S13.5 4 16 4a2.2 2.2 0 0 1 0 5.5z"/>',
    crown: '<path d="M4 17h16"/><path d="M4 17 3 7l5 3.5L12 5l4 5.5L21 7l-1 10z"/>',
    gem: '<path d="M6 4h12l3 5-9 11L3 9z"/><path d="M3 9h18"/><path d="m9.5 9 2.5 11L14.5 9 12 4z"/>',
    bookmark: '<path d="M6.5 3.5h11a1 1 0 0 1 1 1V21l-6.5-4-6.5 4V4.5a1 1 0 0 1 1-1Z"/>',
    rocket: '<path d="M13.5 4.5c3.5 1 5.5 3.5 6 7-3.5-.5-6 1.5-7 5-2-1-3.5-2.5-4.5-4.5 3.5-1 5-3.5 5.5-7.5Z"/><path d="M8 16c-1.5.6-2.3 1.9-2.5 4 2.1-.2 3.4-1 4-2.5"/><circle cx="15" cy="9.5" r="1.4"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',

    // --- messaging ----------------------------------------------------------
    'message-circle': '<path d="M20.5 11.7a8.5 8.5 0 1 1-4.6-7.5"/><path d="M20.5 11.7A8.5 8.5 0 0 1 8.3 19.4L3.5 20.5l1.1-4.8"/>',
    'message-square-text': '<path d="M20.5 5.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-4.5 4v-4H5a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 5 4h14a1.5 1.5 0 0 1 1.5 1.5Z"/><path d="M8 8.5h8"/><path d="M8 12h5"/>',
    send: '<path d="M21 3 10.5 13.5"/><path d="M21 3l-6.8 18-3.7-7.5L3 9.8z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="1.75"/><path d="m3.8 6.4 7.3 5.4a1.5 1.5 0 0 0 1.8 0l7.3-5.4"/>',
    bell: '<path d="M18 9a6 6 0 0 0-12 0c0 4.5-2 6-2 6h16s-2-1.5-2-6Z"/><path d="M10.3 19a2 2 0 0 0 3.4 0"/>',
    megaphone: '<path d="m3 11 14-6v14L3 13z"/><path d="M3 11H2.5A1.5 1.5 0 0 0 1 12.5v0A1.5 1.5 0 0 0 2.5 14H3z"/><path d="M6.5 14.5 8 21h3l-1.2-5.4"/><path d="M20 9.5a3 3 0 0 1 0 5"/>',
    'radio-tower': '<circle cx="12" cy="8" r="2"/><path d="M8.5 4.5a5 5 0 0 0 0 7"/><path d="M15.5 4.5a5 5 0 0 1 0 7"/><path d="M6 2a8 8 0 0 0 0 12"/><path d="M18 2a8 8 0 0 1 0 12"/><path d="m10.5 10-2 11"/><path d="m13.5 10 2 11"/>',
    radio: '<circle cx="12" cy="12" r="2"/><path d="M8.5 8.5a5 5 0 0 0 0 7"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M5.5 5.5a9 9 0 0 0 0 13"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>',
    activity: '<path d="M3 12h4l2.5-7 5 14L17 12h4"/>',

    // --- calls / media ------------------------------------------------------
    phone: '<path d="M6.2 3.5h3l1.5 4-2 1.4a12 12 0 0 0 6.4 6.4l1.4-2 4 1.5v3a1.6 1.6 0 0 1-1.8 1.6A16.5 16.5 0 0 1 4.6 5.3 1.6 1.6 0 0 1 6.2 3.5Z"/>',
    'phone-call': '<path d="M6.2 3.5h3l1.5 4-2 1.4a12 12 0 0 0 6.4 6.4l1.4-2 4 1.5v3a1.6 1.6 0 0 1-1.8 1.6A16.5 16.5 0 0 1 4.6 5.3 1.6 1.6 0 0 1 6.2 3.5Z"/><path d="M15 3.5a5.5 5.5 0 0 1 5.5 5.5"/>',
    'phone-off': '<path d="M10.7 5.3 9.2 3.5h-3A1.6 1.6 0 0 0 4.6 5.3a16.5 16.5 0 0 0 9.1 13.9"/><path d="M17.5 17.4a16.6 16.6 0 0 0 2.2 1.1 1.6 1.6 0 0 0 1.8-1.6v-3l-4-1.5-1.4 2"/><path d="m3 3 18 18"/>',
    video: '<rect x="2.5" y="6" width="13" height="12" rx="2"/><path d="m15.5 10.5 6-3v9l-6-3z"/>',
    mic: '<rect x="9.25" y="3" width="5.5" height="11" rx="2.75"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21"/>',
    'stop-circle': '<circle cx="12" cy="12" r="9"/><rect x="9" y="9" width="6" height="6" rx="1"/>',
    camera: '<path d="M4 7.5h3l1.5-2.5h7L17 7.5h3a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 17V9A1.5 1.5 0 0 1 4 7.5Z"/><circle cx="12" cy="13" r="3.5"/>',
    image: '<rect x="3" y="4.5" width="18" height="15" rx="2"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="m4 17 5-5 4 4 2.5-2.5L20 17"/>',
    headphones: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><path d="M4 14h2.5a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M20 14h-2.5a1 1 0 0 0-1 1v3.5a1 1 0 0 0 1 1H19a1 1 0 0 0 1-1z"/>',

    // --- trust / security ---------------------------------------------------
    shield: '<path d="M12 3 5 6v5.5c0 4.3 2.9 7.6 7 9.5 4.1-1.9 7-5.2 7-9.5V6z"/>',
    'shield-check': '<path d="M12 3 5 6v5.5c0 4.3 2.9 7.6 7 9.5 4.1-1.9 7-5.2 7-9.5V6z"/><path d="m9 12 2 2 4-4"/>',
    'badge-check': '<path d="m12 2.5 2.3 1.8 2.9-.2.9 2.8 2.4 1.6-1 2.7 1 2.7-2.4 1.6-.9 2.8-2.9-.2L12 21.5l-2.3-1.8-2.9.2-.9-2.8L3.5 15.5l1-2.7-1-2.7 2.4-1.6.9-2.8 2.9.2z"/><path d="m9 12 2 2 4-4"/>',
    lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="1.75"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    'lock-keyhole': '<rect x="4.5" y="10.5" width="15" height="10" rx="1.75"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/><circle cx="12" cy="15" r="1.5"/>',
    unlock: '<rect x="4.5" y="10.5" width="15" height="10" rx="1.75"/><path d="M8 10.5V8a4 4 0 0 1 7.6-1.8"/>',
    'key-round': '<circle cx="8" cy="8" r="4.5"/><path d="m11.4 11.4 8.1 8.1"/><path d="m17 14 2.5 2.5"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
    ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
    'alert-triangle': '<path d="M12 4.5 21 19.5H3z"/><path d="M12 10v4"/><path d="M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
    'help-circle': '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2-2.5 3.6"/><path d="M12 17h.01"/>',

    // --- commerce -----------------------------------------------------------
    wallet: '<path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h12.5a1.5 1.5 0 0 1 1.5 1.5"/><rect x="3.5" y="7.5" width="17" height="11.5" rx="1.75"/><path d="M20.5 11.5H17a2 2 0 0 0 0 4h3.5"/>',
    'credit-card': '<rect x="2.5" y="5.5" width="19" height="13" rx="2"/><path d="M2.5 10h19"/><path d="M6 14.5h3"/>',
    'shopping-bag': '<path d="M5 7h14l1 13H4z"/><path d="M9 10V6.5a3 3 0 0 1 6 0V10"/>',
    'package-open': '<path d="m3 8 9-4 9 4-9 3.5z"/><path d="M3 8v9l9 4 9-4V8"/><path d="M12 11.5V21"/>',
    'package-check': '<path d="M20.5 12V7.6L12 3.5 3.5 7.6v8.8L12 20.5l3-1.4"/><path d="M3.5 7.6 12 11.7l8.5-4.1"/><path d="M12 11.7v8.8"/><path d="m16.5 18 1.8 1.8L22 16"/>',
    'clipboard-check': '<path d="M9 4.5H7.5A1.5 1.5 0 0 0 6 6v13.5A1.5 1.5 0 0 0 7.5 21h9a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H15"/><rect x="9" y="2.75" width="6" height="3.5" rx="1"/><path d="m9.5 13 2 2 3.5-3.5"/>',
    'bar-chart-3': '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M3 20h18"/>',
    zap: '<path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12z"/>',

    // --- place / time -------------------------------------------------------
    'map-pin': '<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.75"/>',
    'locate-fixed': '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7"/><path d="M12 2v3"/><path d="M12 19v3"/><path d="M2 12h3"/><path d="M19 12h3"/>',
    calendar: '<rect x="3.5" y="5.5" width="17" height="15" rx="2"/><path d="M3.5 10h17"/><path d="M8 3.5v4"/><path d="M16 3.5v4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.3 2"/>',

    // --- system -------------------------------------------------------------
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.2"/><path d="M12 19.3v2.2"/><path d="m4.9 4.9 1.6 1.6"/><path d="m17.5 17.5 1.6 1.6"/><path d="M2.5 12h2.2"/><path d="M19.3 12h2.2"/><path d="m4.9 19.1 1.6-1.6"/><path d="m17.5 6.5 1.6-1.6"/>',
    'edit-3': '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/>',
    trash: '<path d="M4 6.5h16"/><path d="M9 6.5V4.5h6v2"/><path d="M6 6.5 7 20a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13.5"/>',
    'trash-2': '<path d="M4 6.5h16"/><path d="M9 6.5V4.5h6v2"/><path d="M6 6.5 7 20a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13.5"/><path d="M10 10.5v6"/><path d="M14 10.5v6"/>',
    'file-text': '<path d="M14 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3.5V8h4.5"/><path d="M9 12.5h6"/><path d="M9 16h4"/>',
    database: '<ellipse cx="12" cy="6" rx="7.5" ry="3"/><path d="M4.5 6v12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6"/><path d="M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3"/>',
    'log-in': '<path d="M14 3.5h4.5A1.5 1.5 0 0 1 20 5v14a1.5 1.5 0 0 1-1.5 1.5H14"/><path d="M10 8l4 4-4 4"/><path d="M14 12H3.5"/>',
    'log-out': '<path d="M10 3.5H5.5A1.5 1.5 0 0 0 4 5v14a1.5 1.5 0 0 0 1.5 1.5H10"/><path d="m16 8 4 4-4 4"/><path d="M20 12H9.5"/>',
    smartphone: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>',
    'building-2': '<path d="M3.5 21V8l6-3v16"/><path d="M9.5 11h8a1 1 0 0 1 1 1v9"/><path d="M2.5 21h19"/><path d="M6 10.5h1"/><path d="M6 14h1"/><path d="M13 14.5h2"/><path d="M13 18h2"/>',
    'loader-2': '<path d="M12 3.5a8.5 8.5 0 1 1-6 2.5"/>',
    tag: '<path d="M11.6 3.5H20a.5.5 0 0 1 .5.5v8.4a1 1 0 0 1-.3.7l-7.6 7.6a1 1 0 0 1-1.4 0l-7.5-7.5a1 1 0 0 1 0-1.4l7.6-7.6a1 1 0 0 1 .3-.7Z"/><circle cx="16.5" cy="7.5" r="1.4"/>',
    'share-2': '<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="m8.2 10.8 7.6-4"/><path d="m8.2 13.2 7.6 4"/>',
    smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14a4.5 4.5 0 0 0 7 0"/><path d="M9 9.5h.01"/><path d="M15 9.5h.01"/>',
    sticker: '<path d="M14 3.5H6.5A1.5 1.5 0 0 0 5 5v14a1.5 1.5 0 0 0 1.5 1.5h7L20.5 14V5A1.5 1.5 0 0 0 19 3.5Z"/><path d="M13.5 20.5V15a1 1 0 0 1 1-1h6"/><path d="M9 10h.01"/><path d="M14.5 10h.01"/><path d="M9.5 13.5a3 3 0 0 0 3 1.4"/>',
    'bookmark-check': '<path d="M6.5 3.5h11a1 1 0 0 1 1 1V21l-6.5-4-6.5 4V4.5a1 1 0 0 1 1-1Z"/><path d="m9.5 9.5 2 2 3.5-3.5"/>',
    'image-plus': '<path d="M21 12.5V6.5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="m4 16.5 4.5-4.5 3.5 3.5"/><path d="M18 15v6"/><path d="M15 18h6"/>',
    'mic-off': '<path d="M14.75 5.5v-.25a2.75 2.75 0 0 0-5.5 0V11"/><path d="M9.25 11a2.75 2.75 0 0 0 4.4 2.2"/><path d="M5.5 11a6.5 6.5 0 0 0 9.6 5.7"/><path d="M18.5 11a6.5 6.5 0 0 1-.6 2.7"/><path d="M12 17.5V21"/><path d="m3 3 18 18"/>',
    'video-off': '<path d="M8.5 6h5a2 2 0 0 1 2 2v1.5"/><path d="M15.5 10.5l6-3v9l-4-2"/><path d="M15.5 15.5V16a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h.5"/><path d="m3 3 18 18"/>',

    /* --- brand marks -------------------------------------------------------
       Purpose-built for this product rather than borrowed from a generic set.
       The lightning bolt, four-pointed sparkle, and rocket that previously stood
       in for "premium" are the most over-used glyphs in template UI and say
       nothing about a dating membership — these describe what the tier actually
       does: a verified person, an unlocked number, a lifted profile, a tier rank.
       ---------------------------------------------------------------------- */

    // Heart with a check — a genuine, verified connection. The core brand mark.
    'gs-verified-heart': '<path d="M12 20.5s-7.5-4.7-7.5-9.7A4.6 4.6 0 0 1 12 7.9a4.6 4.6 0 0 1 7.5 2.9c0 1.1-.4 2.2-1 3.2"/><path d="m14 17.5 2 2 4.5-4.5"/>',
    // Two hearts joined — a mutual match.
    'gs-match': '<path d="M9.5 17.5S4 14.3 4 10.8A3.4 3.4 0 0 1 9.5 8.6 3.4 3.4 0 0 1 15 10.8c0 3.5-5.5 6.7-5.5 6.7Z"/><path d="M16.5 15.2c2.3-1.6 4.5-3.6 4.5-5.9a3 3 0 0 0-4.6-2.1"/>',
    // Phone with an open padlock — the phone-reveal entitlement.
    'gs-phone-unlock': '<path d="M6.2 9.5v-3h3l1.5 4-2 1.4a12 12 0 0 0 6.4 6.4l1.4-2 4 1.5v3a1.6 1.6 0 0 1-1.8 1.6A16.5 16.5 0 0 1 4.6 5.3 1.6 1.6 0 0 1 6.2 3.7"/><rect x="13.5" y="2.5" width="8" height="5.5" rx="1.2"/><path d="M15.5 2.5V1.6a2 2 0 0 1 4 0"/>',
    // A profile card lifted above a baseline — visibility boost, without a rocket.
    'gs-boost': '<rect x="6" y="7" width="12" height="10" rx="2"/><circle cx="12" cy="11" r="1.8"/><path d="M9 15.2a3.2 3.2 0 0 1 6 0"/><path d="M4 21h16"/><path d="m12 4.5-2 2"/><path d="m12 4.5 2 2"/><path d="M12 4.5V7"/>',
    // Layered chevrons — tier rank. Reads as level without borrowing a crown.
    'gs-tier': '<path d="m12 3 8 4.5-8 4.5-8-4.5z"/><path d="m4 12 8 4.5 8-4.5"/><path d="m4 16.5 8 4.5 8-4.5"/>',
    // Ring with a centred gem facet — premium, distinct from the generic sparkle.
    'gs-premium': '<circle cx="12" cy="12" r="8.5"/><path d="m12 7.5 3 3-3 6-3-6z"/><path d="M9 10.5h6"/>',
    // Shield around a person — a manually reviewed, protected member.
    'gs-trust': '<path d="M12 3 5 6v5.5c0 4.3 2.9 7.6 7 9.5 4.1-1.9 7-5.2 7-9.5V6z"/><circle cx="12" cy="10.5" r="2.2"/><path d="M8.4 16.4a4 4 0 0 1 7.2 0"/>',
    // Coin with the Kenyan shilling mark — priced in KSh, not a generic dollar.
    'gs-shilling': '<circle cx="12" cy="12" r="8.5"/><path d="M9.5 8v8"/><path d="M9.5 12h2.8a2 2 0 0 0 0-4H9.5"/><path d="m12 12 2.5 4"/><path d="M8 10.2h7"/><path d="M8 13.8h7"/>',
};

export const ICON_NAMES = Object.keys(ICONS);
