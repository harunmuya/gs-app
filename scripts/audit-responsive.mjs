/**
 * What breaks on a 360px phone?
 *
 * Nearly everyone using this app is on a phone, and a good share of those are
 * on a 360px Android screen. The failure is always the same shape: one element
 * that cannot shrink forces the whole page wider than the viewport, and every
 * screen after it scrolls sideways. It is invisible on a laptop, which is where
 * it gets written.
 *
 * This looks for the specific things that cause it rather than trying to judge
 * layout in the abstract:
 *
 *   a fixed width wider than 360px with no max-width or responsive prefix
 *   a grid of three or more columns that never collapses at a breakpoint
 *   whitespace-nowrap on something that can hold a long name
 *   a table or a pre without a scroll container around it
 *   a tap target under 24px, and separately one under 44px
 *
 * Reported as findings, not failures. Some are deliberate, and the point is to
 * see the list rather than to gate a commit on it.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

function walk(dir, out = []) {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full, out);
        else if (/\.(js|jsx)$/.test(entry)) out.push(full);
    }
    return out;
}

const files = walk(join('src', 'app')).concat(walk(join('src', 'components')))
    .filter((f) => !f.includes(join('app', 'api')));

/*
  Pull every className along with the element it is on.

  The element matters. A first pass measured any `h-5 w-5` as a tap target and
  reported 66 failures, nearly all of them icon wrappers inside a button that
  was itself the right size. A height only means something for reach when the
  thing is what the finger actually presses, so the opening tag is walked back
  from the className to find out what it belongs to.
*/
const INTERACTIVE_TAG = /^(button|a|input|select|textarea|summary)$/;

function classNames(text) {
    const found = [];
    const re = /className=(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\}|\{"([^"]*)"\}|\{'([^']*)'\})/g;
    let match;
    while ((match = re.exec(text))) {
        const value = match[1] ?? match[2] ?? match[3] ?? match[4] ?? match[5] ?? '';
        const line = text.slice(0, match.index).split('\n').length;

        // Walk back to the '<' that opened this element.
        const open = text.lastIndexOf('<', match.index);
        const tag = open === -1 ? '' : (text.slice(open + 1, open + 20).match(/^[A-Za-z][\w.]*/) || [''])[0];
        // And forward to the '>' that closes the opening tag, for onClick.
        const close = text.indexOf('>', match.index);
        const attrs = open === -1 || close === -1 ? '' : text.slice(open, close);

        const interactive = INTERACTIVE_TAG.test(tag.toLowerCase())
            || /\bonClick=/.test(attrs)
            || /role="button"/.test(attrs);

        found.push({ value, line, tag, interactive });
    }
    return found;
}

const REM = 4; // Tailwind spacing unit in px, w-4 = 1rem = 16px, so unit = 4px.
const findings = [];
const add = (file, line, kind, detail) => findings.push({ file: relative('src', file), line, kind, detail });

for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const isTable = /<table|<pre/.test(text);

    for (const { value, line, tag, interactive } of classNames(text)) {
        const classes = value.split(/\s+/).filter(Boolean);
        const bare = classes.filter((c) => !/^(sm|md|lg|xl|2xl|hover|focus|active|dark|group-hover|peer):/.test(c));

        // A fixed width that cannot shrink below a 360px viewport.
        for (const c of bare) {
            const fixed = c.match(/^w-(\d+)$/);
            if (fixed) {
                const px = Number(fixed[1]) * REM;
                const guarded = classes.some((x) => /^(max-w-|w-full|min-w-0|shrink)/.test(x))
                    || classes.some((x) => /^(sm|md|lg):w-/.test(x));
                if (px > 320 && !guarded) add(file, line, 'fixed width', `${c} is ${px}px with no max-width`);
            }
            const minw = c.match(/^min-w-\[(\d+)px\]$/);
            if (minw && Number(minw[1]) > 320) add(file, line, 'fixed width', `${c} cannot shrink on a phone`);
        }

        /*
          A many-column grid with no breakpoint below it.

          Three columns of small tiles is a normal phone layout, so the bar is
          four and above: at 360px minus padding that is under 80px per cell,
          which is not enough for a label and a number without wrapping into
          something unreadable.
        */
        for (const c of bare) {
            const cols = c.match(/^grid-cols-(\d+)$/);
            if (cols && Number(cols[1]) >= 4) {
                const responsive = classes.some((x) => /^(sm|md|lg|xl):grid-cols-/.test(x));
                if (!responsive) add(file, line, 'rigid grid', `${c} never collapses, about ${Math.floor(328 / Number(cols[1]))}px per cell at 360`);
            }
        }

        // nowrap without a truncate or a min-w-0 beside it eventually overflows.
        if (bare.includes('whitespace-nowrap')
            && !classes.some((x) => /^(truncate|overflow-|max-w-|min-w-0)/.test(x))) {
            add(file, line, 'nowrap', 'whitespace-nowrap with nothing to clip it');
        }

        /*
          Tap targets, in two tiers.

          WCAG 2.5.8 sets the floor at 24px and 2.5.5 sets the comfortable size
          at 44px. Anything under 24 is a real failure. Between 24 and 44 is a
          judgement: a switch track, an X on a photo thumbnail, and a chip in a
          dense toolbar are all deliberately smaller than a primary control, and
          inflating them to 44 would cover the thing they sit on.

          Both are reported. Collapsing them into one number would either hide
          genuine failures or bury them in exceptions.

          Only things a finger presses are measured, and a checkbox inside its
          own label is skipped, because the label is what gets tapped.
        */
        if (interactive) {
            const insideLabel = /type="(checkbox|radio)"/.test(text.slice(Math.max(0, text.indexOf(value) - 300), text.indexOf(value)));
            const heights = bare.map((c) => c.match(/^(?:h|min-h)-(\d+)$/)).filter(Boolean);
            const explicit = bare.some((c) => /^min-h-\[(\d+)px\]$/.test(c) && Number(c.match(/\d+/)[0]) >= 44);
            const tallest = heights.length ? Math.max(...heights.map((m) => Number(m[1]) * REM)) : null;
            if (tallest !== null && !explicit && !insideLabel) {
                if (tallest < 24) add(file, line, 'below the floor', `<${tag}> is ${tallest}px, under the 24px minimum`);
                else if (tallest < 44) add(file, line, 'small target', `<${tag}> is ${tallest}px, under the 44px comfortable size`);
            }
        }
    }

    // A table or a code block needs something around it that can scroll.
    if (isTable && !/overflow-x-auto|overflow-auto|overflow-x-scroll/.test(text)) {
        add(file, 1, 'unscrollable', 'contains a table or pre with no horizontal scroll container');
    }
}

const byKind = findings.reduce((acc, f) => { (acc[f.kind] ||= []).push(f); return acc; }, {});
const order = ['below the floor', 'unscrollable', 'fixed width', 'rigid grid', 'nowrap', 'small target'];

console.log(`\nScanned ${files.length} screens and components.\n`);
for (const kind of order) {
    const items = byKind[kind];
    if (!items?.length) { console.log(`  ${kind}: none`); continue; }
    console.log(`  ${kind}: ${items.length}`);
    const shown = items.slice(0, 40);
    for (const f of shown) console.log(`      ${f.file}:${f.line}  ${f.detail}`);
    if (items.length > shown.length) console.log(`      ... and ${items.length - shown.length} more`);
    console.log('');
}
console.log(`${findings.length} findings total`);
