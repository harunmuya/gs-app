/**
 * WCAG contrast for the semantic colours, in both themes.
 *
 * The dark theme lifts --color-primary with a comment explaining that it has to
 * keep AA against the dark surface — but --color-danger and --color-success were
 * never given the same treatment and still carry their light-mode values. This
 * measures every semantic colour against the surfaces it is actually drawn on.
 *
 * Thresholds: 4.5:1 for body text (SC 1.4.3), 3:1 for large text and for UI
 * component boundaries such as a status dot or a badge (SC 1.4.11).
 */
import { readFileSync } from 'node:fs';

const css = readFileSync('src/app/globals.css', 'utf8');

function tokensIn(block) {
    const out = {};
    for (const m of block.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) out[m[1]] = m[2];
    return out;
}

const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf(':root[data-theme="dark"]'));
const darkStart = css.indexOf(':root[data-theme="dark"] {');
const darkBlock = css.slice(darkStart, css.indexOf('}', darkStart));

const light = tokensIn(rootBlock);
const dark = { ...light, ...tokensIn(darkBlock) };

function srgb(hex) {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return [0, 2, 4].map((i) => {
        const v = parseInt(h.slice(i, i + 2), 16) / 255;
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
}
const luminance = (hex) => {
    const [r, g, b] = srgb(hex);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
    const la = luminance(a);
    const lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

const WHITE = '#ffffff';

const CHECKS = [
    // Text roles — the -text variants are what .text-danger / .text-success use.
    ['--color-danger-text', '--color-bg-card', 4.5, 'danger text on a card'],
    ['--color-danger-text', '--color-bg-dark', 4.5, 'danger text on the page'],
    ['--color-success-text', '--color-bg-card', 4.5, 'success text on a card'],
    ['--color-success-text', '--color-bg-dark', 3.0, 'online dot on the page'],
    ['--color-primary', '--color-bg-card', 4.5, 'primary text on a card'],
    ['--color-secondary', '--color-bg-card', 4.5, 'secondary text on a card'],
    ['--color-gold', '--color-bg-card', 4.5, 'gold text on a card'],
    ['--color-text-muted', '--color-bg-card', 4.5, 'muted text on a card'],
    ['--color-text-secondary', '--color-bg-card', 4.5, 'body text on a card'],
    // Fill roles — the base tokens, carrying white text. Splitting the tokens is
    // pointless if the fills then fail, so both directions are measured.
    [WHITE, '--color-danger', 4.5, 'white on a danger fill'],
    [WHITE, '--color-success', 4.5, 'white on a success fill'],
    [WHITE, '--color-primary-fill', 4.5, 'white on a primary fill'],
];

/**
 * Alert category accents.
 *
 * Icons and badge marks, so 3:1 (SC 1.4.11) rather than 4.5:1. These were
 * literal hexes in the alerts KIND map — a literal cannot change with the theme,
 * and two of them failed: #1D4ED8 gave 2.80:1 on the dark card, #0EA5E9 gave
 * 2.77:1 on the light one.
 */
const ACCENTS = ['--accent-match', '--accent-social', '--accent-gift', '--accent-verify', '--accent-support', '--accent-call'];

let fail = 0;
for (const [themeName, tokens] of [['light', light], ['dark', dark]]) {
    console.log(`\n=== ${themeName} theme`);
    for (const [fg, bg, min, what] of CHECKS) {
        const f = fg.startsWith('#') ? fg : tokens[fg];
        const b = bg.startsWith('#') ? bg : tokens[bg];
        if (!f || !b) { console.log(`  ????  ${what}: missing ${!f ? fg : bg}`); continue; }
        const r = ratio(f, b);
        const ok = r >= min;
        if (!ok) fail++;
        console.log(`  ${ok ? 'ok   ' : 'FAIL '} ${what.padEnd(28)} ${f} on ${b}  ${r.toFixed(2)}:1  (needs ${min})`);
    }
}

console.log('\n=== alert accents, each on its own theme surface (3:1 for icons)');
for (const token of ACCENTS) {
    const onLight = ratio(light[token], light['--color-bg-card']);
    const onDark = ratio(dark[token], dark['--color-bg-card']);
    const ok = onLight >= 3 && onDark >= 3;
    if (!ok) fail++;
    console.log(`  ${ok ? 'ok   ' : 'FAIL '} ${token.padEnd(18)} light ${light[token]} ${onLight.toFixed(2)}:1   dark ${dark[token]} ${onDark.toFixed(2)}:1`);
}

// Any accent hex left inline in a component is a colour that cannot follow the theme.
const alerts = readFileSync('src/app/(main)/alerts/page.js', 'utf8');
const strays = [...alerts.matchAll(/#[0-9A-Fa-f]{6}/g)].map((m) => m[0]);
if (strays.length) { fail++; console.log(`\n  FAIL  ${strays.length} literal hex(es) still in alerts: ${[...new Set(strays)].join(', ')}`); }
else console.log('\n  ok    no literal hexes left in the alerts palette');

console.log(fail ? `\n${fail} contrast failure(s)` : '\nevery colour meets its threshold in both themes');
process.exit(fail ? 1 : 0);
