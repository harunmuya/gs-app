# Wave 3 — icons, SEO, accessibility

**Date:** 2026-08-08 · **App:** V1 · **Build:** `next build` passes

Follows [WAVE-2-STATUS.md](./WAVE-2-STATUS.md). This covers the parts of Phases 8 and 13 that involve no subjective design decisions. The UI/UX redesign (Phase 7) is deliberately still open — see the end of this document.

---

## Landed

### 1. Self-hosted SVG sprite icon system — Phase 8

`lucide-react` is removed from `package.json`. Icons are now:

| | |
|---|---|
| Artwork source | `scripts/icons/icon-set.mjs` — 95 glyphs, authored on a 24px grid, 20px live area, 1.75 stroke, round caps, `currentColor` |
| Build | `npm run icons` → `public/icons/sprite.svg` (24.9 KB, one immutable cached file) |
| Components | `src/components/icons.js` — generated named wrappers |
| Primitive | `src/components/Icon.js` — `<use href="/icons/sprite.svg#name">` |

Artwork no longer enters the JavaScript bundle. Client chunks dropped from **1578 KB to 1526 KB**, and the sprite is fetched once and cached for a year under the rule added in Wave 2.

**Accessibility:** icons are `aria-hidden` and `focusable="false"` by default, which is correct for the decorative majority. Passing `title` promotes an icon to `role="img"` with an accessible name — for icon-only buttons. This is a genuine improvement: the previous `lucide-react` usage rendered bare SVGs with no consistent policy, so icon-only controls had no accessible name at all.

**Two design decisions worth recording:**

*Why a barrel of wrappers rather than rewriting call sites.* Icons are used two ways here: as JSX tags (`<Heart size={16} />`, ~230 sites) and as component **values** passed to other components (`icon={Heart}`, `{ icon: Users }`, ~120 sites). A codemod that only rewrote JSX tags would have stripped the imports and left ~120 undefined references. Generating one thin named wrapper per icon means both forms keep working and the migration is a change of import specifier — 28 files, one line each.

*Coverage is enforced, not assumed.* `scripts/build-icons.mjs` scans `src/` for names still imported from `lucide-react` and exits non-zero if any lacks a sprite symbol. That check caught a digit-handling bug in the kebab-case conversion (`BarChart3` → `bar-chart3` instead of `bar-chart-3`) and 8 icons a manual count had missed because their imports span multiple lines.

**Honest note on artwork quality.** Lucide is professionally drawn. Some of these 95 replacements — the denser glyphs like `rocket`, `sticker`, `megaphone`, and the `user-cog` variant — are serviceable but not as refined as what they replace. The system is what matters: artwork lives in one editable file, so any individual glyph can be redrawn or replaced with commissioned artwork without touching a single call site. If icon craft matters to the brand, commissioning a set and dropping it into `icon-set.mjs` is now a contained job.

### 2. SEO — Phase 13

**Correction to the Phase 1 audit.** It reported "no `generateMetadata`, no per-profile metadata", inferred from file sizes rather than read. That was wrong: `src/app/layout.js` already carries complete root metadata including OpenGraph and Twitter cards, and five public pages export their own. The genuine gaps were narrower.

Added:
- **`src/app/robots.js`** — allows public pages, disallows `/api/`, `/admin`, `/auth/`, and every signed-in route.
- **`src/app/sitemap.js`** — the seven genuinely public URLs.
- **`noindex` on the whole `(main)` route group** via layout metadata. These pages sit behind `AuthGuard`, but that runs on the *client*, so a crawler still receives the shell. Indexing them would leak member profile ids into search results.

**Member profiles are deliberately excluded from the sitemap.** They are authenticated, they change constantly, and a large share are seeded profiles — publishing those to search engines as though they were real people is exactly the impression Phase 11 is meant to remove.

**A finding, not a fix:** `/packages` is inside the `(main)` group and therefore behind the auth gate, so an anonymous crawler gets nothing from your pricing page. A public pricing page is normally one of the strongest SEO assets a subscription product has. Moving it outside the auth gate is a small change with real upside; I have left it disallowed and out of the sitemap because today it genuinely is not public.

### 3. Accessibility — pinch-zoom restored

`src/app/layout.js` set `maximumScale: 1, userScalable: false`, which blocks pinch-zoom on mobile. That fails **WCAG 2.1 SC 1.4.4 (Resize Text)** and is a real barrier for anyone reading profile text on a phone. Now `maximumScale: 5, userScalable: true`. The layout is responsive and never relied on a locked viewport, so nothing else changes.

### 4. Design system foundation — Phase 7, started

The audit called the interface "robotic, generic, template-based". That turned out to be measurable rather than a matter of taste:

| Signal | Count |
|---|---|
| `font-black` (weight 900) | **305** |
| `font-bold` | 113 |
| `font-medium` | 26 |
| `font-extrabold` | 0 |
| Arbitrary `text-[Npx]` sizes | **130** |
| `prefers-reduced-motion` rules | **0** |
| `focus-visible` rules | 5 |

(These undercount — seven files with bracketed route paths were skipped by the scan.)

When weight 900 is used 305 times there is no hierarchy: every element shouts equally and the eye has nothing to follow. That is the mechanical cause of the "AI-generated" impression, and it is fixable without any taste judgement.

Added to `globals.css`:
- **A type scale** — six steps on a 1.25 ratio, `clamp()`-based so it holds from 360 px to ultra-wide, with weight 900 reserved for display text and a deliberate ladder below it. Exposed as `.type-display` … `.type-micro` so pages can adopt it incrementally.
- **An elevation ladder** (4 steps). Previously every card shared one shadow, which flattened depth.
- **A global focus ring** on every interactive element. Keyboard users previously had almost none.
- **`prefers-reduced-motion` support.** framer-motion drives swipes, gift effects, and transitions throughout, and none of it honoured the setting. For users with vestibular sensitivity that is not cosmetic. Motion is reduced to near-instant rather than removed, so state changes stay perceptible.
- **An ultra-wide cap** (`max-width: 1280px` above 1440 px). The shell was fluid to any width, so line lengths became unreadable on a wide monitor — one of the Phase 12 items.

Applied so far to the two highest-traffic surfaces:
- **`BottomNav`** — on every screen. Now carries `aria-label="Primary"` and `aria-current="page"`, so the active tab is announced rather than only colour-coded. The unread badge is `aria-hidden` with an `sr-only` count beside the label, so it reads "Chat, 3 unread" instead of a bare number. Guaranteed 44 px tap targets.
- **Member cards** — the name now carries the weight and everything below steps down, so each card has a reading order.

### 5. Weight ladder applied across every screen

`scripts/fix-type-weights.mjs` applies the typographic rule the codebase was breaking: weight should fall as size falls. It decides per `className` attribute, using the size token in that same attribute, so unrelated elements on one line stay independent.

| | micro (8–11px, `text-xs`) | small (`text-sm`) | display (`text-base`+) |
|---|---|---|---|
| Rule | `font-black` → `font-semibold` | `font-black` → `font-bold` | untouched |
| Applied | 166 | 59 | — |

225 changes across 27 files. Only the weight token changes, so layout is unaffected beyond fractional glyph width.

| Weight | Before | After |
|---|---|---|
| `font-black` (900) | 305+ | **128** — now display text |
| `font-bold` | 113 | 195 |
| `font-semibold` | **0** | **178** |
| `font-medium` | 26 | 27 |

35 `font-black` attributes carry no size token at all and inherit from a parent. The codemod deliberately left those alone rather than guessing; they need a human eye.

### 6. Verified in a real browser

Rather than asserting the visual work landed, the dev server was run and the pages inspected:

- Sprite resolves (`/icons/sprite.svg#shield-check`), icons render at non-zero size and are correctly `aria-hidden`
- `button:focus-visible` rule is live; the focus ring is visibly rendering on form fields
- `prefers-reduced-motion` block present in the cascade
- `--font-micro` and `--tap-min` resolve
- Viewport meta reports `maximum-scale=5, user-scalable=yes`
- **No horizontal overflow at 375 px or 525 px** — `scrollWidth === clientWidth`, zero elements out of bounds
- No console errors

**Two findings from the live check:**
- Next 16 warns that the `middleware` file convention is deprecated in favour of `proxy`. The middleware added in Wave 1 still works (the build registers it as `ƒ Proxy (Middleware)`), but it should be renamed before the convention is removed.
- Nine controls are under 44 px. Most are inline footer links inside a sentence, which WCAG 2.5.8 explicitly exempts. The genuine one is the standalone **"Forgot password?" button at 40 px tall** — a small, real gap worth closing.

**This is a foundation, not the finished redesign.** The weight ladder gives every screen a hierarchy, but the six-step `type-*` scale is so far only adopted by `BottomNav` and member cards. Rolling it across the remaining screens is mechanical — and it is where a direction from you would change the outcome.

---

## Still open

**Phase 7 — UI/UX redesign.** Not started, deliberately. Rewriting component visuals is the one part of this programme where I would be guessing at your taste rather than fixing a defect, and it is the largest single block of work remaining. It needs a direction agreed first: reference apps you rate, whether the existing purple/gold palette stays, and how far the redesign should reach.

**Phase 12 — responsiveness audit.** Needs the app running against real devices, not a static read.

**Remaining icon polish.** See the honest note above.

---

## Testing checklist

- [ ] Every screen renders icons; none are missing or mis-sized
- [ ] `npm run icons` regenerates the sprite and reports no missing symbols
- [ ] Icon-only buttons announce a name in a screen reader; decorative icons stay silent
- [ ] `/sitemap.xml` lists exactly the seven public URLs and no member profiles
- [ ] `/robots.txt` disallows `/admin`, `/api/`, and all signed-in routes
- [ ] A signed-in page returns `noindex` in its rendered head
- [ ] Pinch-zoom works on a real phone across discover, profile, and messages
- [ ] `grep -r "lucide-react" src/` returns nothing
