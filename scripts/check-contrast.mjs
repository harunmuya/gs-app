/**
 * WCAG contrast check for the palette's load-bearing pairs.
 *
 * globals.css documents a ratio against each colour it tuned, and those notes are
 * only worth having if something checks them. This recomputes every pairing that
 * carries text or an icon, so a hue change cannot quietly drop a token below AA.
 *
 *   node scripts/check-contrast.mjs
 *
 * Thresholds: 4.5 for body text (SC 1.4.3), 3.0 for large text and for icons and
 * other non-text indicators (SC 1.4.11).
 */

function luminance(hex) {
    const value = hex.replace('#', '');
    const full = value.length === 3 ? [...value].map((c) => c + c).join('') : value;
    const channels = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
    const linear = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function ratio(a, b) {
    const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (high + 0.05) / (low + 0.05);
}

// [label, foreground, background, minimum]
const PAIRS = [
    // --- light theme -------------------------------------------------------
    ['light: primary as text on white', '#0D5C63', '#FFFFFF', 4.5],
    ['light: white on primary fill', '#FFFFFF', '#0D5C63', 4.5],
    ['light: white on primary dark', '#FFFFFF', '#08454A', 4.5],
    ['light: ink on primary light', '#101718', '#8FC9CE', 4.5],
    ['light: text primary on card', '#101718', '#FFFFFF', 4.5],
    ['light: text secondary on card', '#3F4A4B', '#FFFFFF', 4.5],
    ['light: text muted on card', '#64716F', '#FFFFFF', 4.5],
    ['light: text muted on surface', '#64716F', '#EDF4F4', 4.5],
    ['light: accent-match icon on card', '#0D5C63', '#FFFFFF', 3.0],
    ['light: accent-support icon on card', '#475569', '#FFFFFF', 3.0],
    ['light: success text on card', '#047857', '#FFFFFF', 4.5],
    ['light: danger text on card', '#C81E1E', '#FFFFFF', 4.5],
    ['light: verified icon on card', '#1D4ED8', '#FFFFFF', 3.0],
    ['light: white on gold', '#FFFFFF', '#8A6620', 4.5],

    // The four role accents in ProfileCompletionModal. Non-text indicators, so
    // 3:1, and each must also be told apart from the brand teal by eye.
    ['role: sugar mummy on card', '#6D28D9', '#FFFFFF', 3.0],
    ['role: sugar daddy on card', '#0369A1', '#FFFFFF', 3.0],
    ['role: mistress on card', '#4D7C0F', '#FFFFFF', 3.0],
    ['role: toyboy on card', '#475569', '#FFFFFF', 3.0],

    // --- dark theme --------------------------------------------------------
    ['dark: primary as text on card', '#5FD3DC', '#0F1A1A', 4.5],
    ['dark: white on primary fill', '#FFFFFF', '#0D5C63', 4.5],
    ['dark: text primary on card', '#F2F7F7', '#0F1A1A', 4.5],
    ['dark: text secondary on card', '#C8D4D4', '#0F1A1A', 4.5],
    ['dark: text muted on card', '#8A9A9A', '#0F1A1A', 4.5],
    ['dark: accent-match icon on card', '#5FD3DC', '#0F1A1A', 3.0],
    ['dark: accent-support icon on card', '#94A3B8', '#0F1A1A', 3.0],
    ['dark: success text on card', '#34D399', '#0F1A1A', 4.5],
    ['dark: danger text on card', '#F87171', '#0F1A1A', 4.5],
    ['dark: accent-verify icon on card', '#7EA6FF', '#0F1A1A', 3.0],
    ['dark: ink on gold', '#2A1E05', '#D2A758', 4.5],
];

let failed = 0;

for (const [label, fg, bg, min] of PAIRS) {
    const value = ratio(fg, bg);
    const pass = value >= min;
    if (!pass) failed++;
    console.log(
        `${pass ? 'ok  ' : 'FAIL'}  ${value.toFixed(2).padStart(5)}:1  (min ${min.toFixed(1)})  ${label}`,
    );
}

console.log(`\n${PAIRS.length - failed}/${PAIRS.length} pairings pass.`);
if (failed) process.exitCode = 1;
