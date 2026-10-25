/**
 * Rewrite icon-set.mjs with Google Material Symbols artwork.
 *
 * Run once when the mapping below changes:
 *
 *   node scripts/icons/fetch-material.mjs && node scripts/build-icons.mjs
 *
 * Why a generator and not a dependency: the artwork is fetched here and written
 * into icon-set.mjs, which is committed. Nothing downloads at install time, at
 * build time or in a browser, there is no font request to go wrong, and the
 * sprite stays a single self-hosted file. The cost is that adding an icon means
 * running this, which is why the mapping is the only thing you edit.
 *
 * Why not the Material Symbols webfont: ligature fonts render the icon's *name*
 * as text until the font arrives, and any rule that sets font-family on a
 * container overrides them. That is not hypothetical — it is exactly what
 * happened on the sister WordPress site, where every icon read "schedule" or
 * "chevron_left" on pages carrying an inherited font-family, and the fix was an
 * !important the stylesheet now depends on. An SVG sprite cannot fail that way.
 *
 * Material Symbols are filled paths on a 0 -960 960 960 grid, where the set this
 * replaces was 1.75-weight strokes on 0 0 24 24. Both live in the sprite: each
 * <symbol> carries its own viewBox and its own fill/stroke attributes, so the
 * eight bespoke gs-* glyphs keep their geometry while everything else switches.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Pinned, not floating: a sprite regenerated from a different release of the
// icon set would produce a diff nobody asked for.
const VERSION = '0.47.0';
const STYLE = 'outlined';
const BASE = `https://cdn.jsdelivr.net/npm/@material-symbols/svg-400@${VERSION}/${STYLE}`;

/*
  Our sprite id -> Material Symbols name.

  Chosen for what the icon *means here*, not for the closest literal match.
  `compass` is the Discover tab, so it maps to `explore`. `zap` marks a boost, so
  `bolt`. `target` has no Material counterpart worth the name; `track_changes`
  is the concentric-rings glyph that was being drawn anyway.

  Two of ours intentionally share one Material glyph: `lock` and `lock-keyhole`
  were near-duplicates in the old set and `how_to_reg` is simply the right icon
  for a checked person. Keeping both ids means no call site has to change.
*/
const NAME_MAP = {
    verified: 'verified',
    'arrow-left': 'arrow_back',
    'arrow-right': 'arrow_forward',
    'chevron-right': 'chevron_right',
    compass: 'explore',
    search: 'search',
    filter: 'filter_alt',
    'sliders-horizontal': 'tune',
    'external-link': 'open_in_new',
    x: 'close',
    plus: 'add',
    check: 'check',
    'check-check': 'done_all',
    'check-circle': 'check_circle',
    'refresh-cw': 'refresh',
    history: 'history',
    user: 'person',
    'circle-user-round': 'account_circle',
    'user-plus': 'person_add',
    'user-check': 'how_to_reg',
    'user-round-check': 'person_check',
    'user-cog': 'manage_accounts',
    users: 'group',
    'users-round': 'groups',
    'at-sign': 'alternate_email',
    heart: 'favorite',
    'heart-handshake': 'volunteer_activism',
    star: 'star',
    // Material Symbols has no `auto_awesome`; that is a Material *Icons* name.
    // `star_shine` is the sparkle glyph in this set.
    sparkles: 'star_shine',
    gift: 'redeem',
    crown: 'workspace_premium',
    gem: 'diamond',
    bookmark: 'bookmark',
    rocket: 'rocket_launch',
    target: 'track_changes',
    'message-circle': 'chat_bubble',
    'message-square-text': 'chat',
    send: 'send',
    mail: 'mail',
    bell: 'notifications',
    megaphone: 'campaign',
    'radio-tower': 'cell_tower',
    radio: 'radio',
    activity: 'monitoring',
    phone: 'call',
    'phone-call': 'phone_in_talk',
    'phone-off': 'call_end',
    video: 'videocam',
    mic: 'mic',
    'stop-circle': 'stop_circle',
    camera: 'photo_camera',
    image: 'image',
    headphones: 'headphones',
    shield: 'shield',
    'shield-check': 'verified_user',
    'badge-check': 'verified',
    lock: 'lock',
    'lock-keyhole': 'lock',
    unlock: 'lock_open',
    'key-round': 'key',
    eye: 'visibility',
    ban: 'block',
    'alert-triangle': 'warning',
    info: 'info',
    'help-circle': 'help',
    wallet: 'account_balance_wallet',
    'credit-card': 'credit_card',
    'shopping-bag': 'shopping_bag',
    'package-open': 'inventory_2',
    'package-check': 'inventory',
    'clipboard-check': 'assignment_turned_in',
    'bar-chart-3': 'bar_chart',
    zap: 'bolt',
    'map-pin': 'location_on',
    'locate-fixed': 'my_location',
    calendar: 'calendar_today',
    clock: 'schedule',
    settings: 'settings',
    'edit-3': 'edit',
    trash: 'delete',
    'trash-2': 'delete_forever',
    'file-text': 'description',
    database: 'database',
    'log-in': 'login',
    'log-out': 'logout',
    // This set carries no single-handset glyph at all — no `smartphone`,
    // `phone_android` or `phone_iphone` — so `devices` is the nearest honest
    // match. It costs nothing today: the only import of this icon, on the
    // packages page, is unused and never reaches JSX.
    smartphone: 'devices',
    'building-2': 'apartment',
    'loader-2': 'progress_activity',
    tag: 'sell',
    'share-2': 'share',
    smile: 'mood',
    // `emoji_emotions` is another Material Icons name absent here. `emoticon` is
    // the equivalent face, and distinct from `mood`, which `smile` already uses.
    sticker: 'emoticon',
    'bookmark-check': 'bookmark_added',
    'image-plus': 'add_photo_alternate',
    'mic-off': 'mic_off',
    'video-off': 'videocam_off',
};

/*
  The glyphs that stay hand-drawn.

  Each is a composite that names something only this product has, so there is no
  Material equivalent to map to: a verified heart, a mutual match, an unlocked
  phone number, a boost, a tier, premium, trust, and the Kenyan shilling. Mapping
  these onto generic icons would lose the meaning that made them worth drawing.
*/
const KEEP_CUSTOM = [
    'gs-verified-heart',
    'gs-match',
    'gs-phone-unlock',
    'gs-boost',
    'gs-tier',
    'gs-premium',
    'gs-trust',
    'gs-shilling',
];

const SET_PATH = join(process.cwd(), 'scripts', 'icons', 'icon-set.mjs');

/** Pull the drawable children out of a fetched Material SVG. */
function extractBody(svg, name) {
    const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim();
    if (!inner) throw new Error(`${name}: no markup inside <svg>`);
    if (/<(script|style|image)\b/i.test(inner)) throw new Error(`${name}: unexpected element`);
    // Material ships a plain path (occasionally several). Anything with its own
    // fill or colour would fight `currentColor`, so it is rejected rather than
    // silently shipped.
    if (/fill="(?!none)/i.test(inner)) throw new Error(`${name}: hardcoded fill`);
    return inner;
}

async function fetchIcon(materialName) {
    const res = await fetch(`${BASE}/${materialName}.svg`);
    if (!res.ok) throw new Error(`${materialName}: HTTP ${res.status}`);
    return extractBody(await res.text(), materialName);
}

const existing = await import('./icon-set.mjs');
const previous = existing.ICONS;

const missingCustom = KEEP_CUSTOM.filter((name) => !previous[name]);
if (missingCustom.length) {
    console.error(`Custom glyphs not found in the current set: ${missingCustom.join(', ')}`);
    process.exit(1);
}

const bodies = {};
const failures = [];

// Sequential on purpose: ~95 requests is nothing, and a burst of parallel
// fetches against a CDN is the one way to turn a clean run into a flaky one.
for (const [id, materialName] of Object.entries(NAME_MAP)) {
    try {
        bodies[id] = await fetchIcon(materialName);
        process.stdout.write('.');
    } catch (error) {
        failures.push(`${id} -> ${materialName}: ${error.message}`);
        process.stdout.write('x');
    }
}
process.stdout.write('\n');

if (failures.length) {
    console.error(`\n${failures.length} icon(s) could not be fetched:`);
    for (const line of failures) console.error(`  ${line}`);
    console.error('\nNothing was written. Fix NAME_MAP and run again.');
    process.exit(1);
}

for (const name of KEEP_CUSTOM) bodies[name] = previous[name];

const materialIds = Object.keys(NAME_MAP);
const ordered = [...materialIds, ...KEEP_CUSTOM];

const file = `/**
 * Genuine Sugarmummies icon set.
 *
 * GENERATED by scripts/icons/fetch-material.mjs — edit the mapping there, not
 * the artwork here. Then run \`node scripts/build-icons.mjs\` to rebuild
 * public/icons/sprite.svg and src/components/icons.js.
 *
 * Two families live side by side, and each <symbol> carries its own viewBox and
 * paint attributes so they do not interfere:
 *
 *   Material Symbols (${STYLE}, weight 400, v${VERSION}) — filled paths on a
 *   0 -960 960 960 grid. ${materialIds.length} of them, fetched from the published
 *   package rather than redrawn, so they are the real glyphs.
 *
 *   gs-* — ${KEEP_CUSTOM.length} hand-drawn composites for things only this product has
 *   (a verified heart, a mutual match, an unlocked number, the Kenyan shilling).
 *   Stroke-based, 1.75 weight, on 0 0 24 24.
 *
 * Nothing here carries an id, a class or a colour: the builder wraps each body in
 * a <symbol> and the Icon component supplies size and colour via currentColor.
 */

/** Paint for the hand-drawn gs-* glyphs. */
export const STROKE_DEFAULTS = {
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.75',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
};

/** Paint for Material Symbols, which are solid shapes rather than outlines. */
export const MATERIAL_DEFAULTS = {
    fill: 'currentColor',
    stroke: 'none',
};

export const VIEWBOX = {
    material: '0 -960 960 960',
    stroke: '0 0 24 24',
};

/** Which ids use Material artwork; everything else is drawn here. */
export const MATERIAL_ICONS = new Set(${JSON.stringify(materialIds, null, 4).replace(/\n/g, '\n')});

export const ICONS = {
${ordered.map((name) => `    ${/^[a-z][a-z0-9]*$/.test(name) ? name : `'${name}'`}: ${JSON.stringify(bodies[name])},`).join('\n')}
};
`;

await writeFile(SET_PATH, file, 'utf8');

console.log(`\nWrote ${ordered.length} icons to scripts/icons/icon-set.mjs`);
console.log(`  ${materialIds.length} Material Symbols (${STYLE} 400, v${VERSION})`);
console.log(`  ${KEEP_CUSTOM.length} hand-drawn gs-* glyphs preserved`);
console.log('\nNow run: node scripts/build-icons.mjs');
