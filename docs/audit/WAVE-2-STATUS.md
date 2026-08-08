# Wave 2 — cost and correctness

**Date:** 2026-08-08 · **App:** V1 · **Build:** `next build` passes

Follows [WAVE-1-STATUS.md](./WAVE-1-STATUS.md). Wave 2 targets the Vercel and Supabase cost drivers identified in §16 of the audit.

---

## Landed

### 1. Listing over-fetch — `api/members/route.js`

The route overrode whatever pagination the client asked for and always fetched 240 full member rows, then paginated in memory. Measured against what the clients actually request:

| Page | Client asks for | Rows fetched before | After |
|---|---|---|---|
| Discover deck | 20 | 240 | **60** |
| Members grid | 40 | 240 | **120** |

The candidate pool still has to exceed the page, because ranking, the local-seed merge, and the preference interleave all operate across a pool. It is now sized to page depth and rounded to a 60-row grid so consecutive pages usually share a pool and therefore an ordering.

**Known tradeoff:** crossing a grid boundary can reshuffle results between pages. Stable deep pagination requires database-side ranking, which is Phase 6. Page 1 — nearly all traffic — is unaffected.

### 2. Matches page fan-out — the largest single win

The matches page fired **1 + N parallel requests, each pulling 240 rows**, where N is the number of target labels for the user. With two target labels that is 720 rows across 3 serverless invocations, to render 40 cards.

The unlabelled request was also entirely redundant: `recommendations` filters to target labels anyway, so nothing it uniquely contributed ever reached the screen.

Now one request. Added a `labels=` parameter (comma-separated, capped at 8) so a caller needing several categories asks once:

| | Before (N=2) | After |
|---|---|---|
| HTTP requests | 3 | **1** |
| Rows fetched | 720 | **120** |
| Function invocations | 3 | **1** |

### 3. Seed dataset removed from the client bundle

`lib/profileImages.js` imported the 67 KB `localSeedMembers` purely to build lists of fallback photo URLs, and is imported by `UserAvatar`, `BlurImage`, `BoostedMembersStrip`, and the discover/members/matches pages — so the entire seed roster shipped to every visitor and was readable in devtools.

Replaced with a generated 4.4 KB manifest of 12 URLs per category, produced by `scripts/generate-fallback-manifest.mjs` (re-run it if the seed folders change).

**Verified against the built output:** the client bundle now contains exactly 48 `/seed/` occurrences — the manifest's 48 URLs and nothing else. The remaining `seed-local-` matches in two chunks are the `id.startsWith('seed-local-')` string literals in page code, not data.

### 4. Immutable caching for static imagery — `next.config.js`

`public/` holds ~51 MB of seed photography, gift art, and icons, served with a revalidating cache policy — so every card view cost a request. Files are replaced by name rather than edited, so they are now `public, max-age=31536000, immutable`.

This is the cheapest large win available without moving the files, and it is independent of the storage migration below.

### 5. Lazy loading on list-rendered images

`loading="lazy"` and `decoding="async"` added where many images render at once: `StoriesStrip`, `LiveNowStrip`, and the matches grid. Above-the-fold hero images were left eager on purpose.

### 6. Discovery ranking rebuilt — Phase 6, `src/lib/discoveryRanking.js`

Ordering was `hash(row.id) XOR hash(seed)` — a deterministic shuffle with no relationship to the viewer, the profile, or any activity. Discovery "felt random" because it was. Alongside it, `applyViewerPreferenceMix` interleaved primary and secondary matches on a fixed 4:1 cadence regardless of profile strength, so a distant, inactive primary always outranked a nearby, active secondary.

Profiles are now scored on six weighted signals — preference match, proximity, real activity recency, profile quality, freshness, and a small deterministic tie-break — with paid visibility added as a bonus on top rather than as an override. All weights live in one exported `WEIGHTS` object; there is no hidden term.

Activity scoring is only meaningful because of Wave 1: `last_seen_at` was previously regenerated from `Date.now()` for every seed profile on every request, so every seed profile scored maximum. Unattended profiles now decay.

**Filters added:** `min_age` / `max_age` (applied in SQL, so they shrink the pool) and `radius_km` (applied after the fetch, because a profile's position may be inferred from location text rather than stored coordinates).

**Verified by direct test** against hand-built profiles for a Nairobi sugar-mummy viewer:

```
 1.  93.9  match 100%  ideal toyboy, Nairobi, active 30min, complete
 2.  79.2  match  85%  sugar_daddy (secondary), Nairobi, active, complete
 3.  77.8  match  83%  toyboy, Mombasa (~440km), active 30min, complete
 4.  76.2  match  81%  toyboy, Nairobi, inactive 3 months, complete
 5.  66.9  match  72%  mistress (unmatched), Nairobi, active, complete
 6.  66.5  match  47%  BOOSTED toyboy, Mombasa, inactive 3mo, no bio
 7.  28.2  match  30%  toyboy, Nairobi, active, NO photo/bio
```

Row 2 is the point of the rebuild: a strong secondary match now beats a weak primary. Row 6 is the paid-visibility design working — the boost lifts *placement* to 6th without inflating the *match figure*, which honestly reads 47%.

**Two mis-tunings the test caught before shipping:**
- A photoless profile initially scored 2nd at "84% match". Weighting alone was too weak to express that a card with no image is unusable, so missing photos now scale the whole relevance score by 0.4.
- Nairobi→Mombasa scored exactly 0.000 proximity against a 400 km cutoff — which would have excluded Kenya's second city from every Nairobi feed. The decay ceiling is now 1200 km, tuned for East African distances.

### 7. Client no longer contradicts the server ranking — `discover/page.js`

The deck computed its own `matchScore` that **added 22 points for `isBoosted`** and floored every result at 50%. So a paid boost inflated the *match percentage* shown to the member, not merely the profile's position, and a genuinely poor match could never display below 50%.

It now uses the server's `matchPercent`, falling back to a local heuristic only for profiles that never went through ranking (WordPress imports, direct lookups). The boost term and the artificial floor are gone from that fallback.

### 8. Seed label drift reconciled — unblocks the SQL label filter

`supabase/migrations/20260808_020_reconcile_seed_profile_labels.sql` makes `profile_label` agree with the photo folder for seed profiles, using a Postgres function that mirrors `inferProfileLabel()` exactly. The toyboy folder is stored URL-encoded (`/seed/Toboys%20or%20Sugarguys/`) and `%` is a LIKE wildcard, so every comparison uses `strpos()` for literal matching.

The migration prints the drift count before updating, touches only `is_seed_profile = true` rows, leaves profiles with no identifiable folder alone, and adds a partial index for the new filter.

**The SQL filter is gated behind `SEED_LABELS_RECONCILED=1`,** which you set *after* running the migration and confirming its verification query returns 0. This matters: I cannot inspect your live database, so shipping the pushdown unconditionally would be guessing. The JavaScript filter still runs downstream, so the SQL filter is a narrowing rather than a replacement — if the flag were set prematurely the failure mode is missing rows, never wrong rows.

With the flag on, the pool overshoot drops from 2× to 1.3×, because only visibility and self-exclusion filtering remain after the fetch.

Label parsing was also consolidated into one `requestedLabelSet()` helper, so the SQL filter, the JavaScript filter, and the local-seed filter cannot disagree about what was requested.

---

## Not done — and why

**Moving `public/seed` (42 MB) to Supabase Storage or a CDN.** This needs upload access to your Supabase project and a DNS/CDN decision. I can write the upload script and the URL-rewrite migration, but I cannot execute the transfer, and doing half of it would leave broken image paths in production. Item 4 above captures most of the bandwidth benefit in the meantime.

**Migration consolidation.** 51 files, ~1.9 MB of duplicated seed data across six near-identical reseeds, and two colliding timestamp prefixes (`20260707_010_` and `20260709_049_` each used twice, so ordering between them is undefined).

I deliberately did **not** renumber or squash these. Supabase tracks applied migrations by version string in `supabase_migrations.schema_migrations`; renaming a file that has already run makes the CLI treat it as new and attempt to re-apply it. On a live database holding real accounts that is a bad trade for tidiness.

The safe route is a deliberate squash-to-baseline against a *fresh* environment: `supabase db dump` the current production schema into a single `..._000_baseline.sql`, verify a clean restore reproduces production, then archive the historical migrations and mark the baseline as applied. That needs database access and a maintenance window, so it is your call rather than mine to schedule.

---

## Testing checklist

- [ ] Discover deck loads and paginates; ordering is stable within a page
- [ ] Members grid loads 40 per page and paginates
- [ ] Matches page renders recommendations from a single `/api/members?labels=...` request (check the network tab shows one, not three)
- [ ] A user whose `targetLabelsForUser` is empty still gets results
- [ ] Seed profiles still show a category-matched fallback photo when their avatar 404s
- [ ] `/seed/...` responses carry `Cache-Control: public, max-age=31536000, immutable`
- [ ] Client bundle contains no seed member records (`rg 'seed-local-' .next/static/chunks` returns only string literals)
- [ ] Discover deck for a sugar mummy leads with nearby, active toyboys — not a fixed 4:1 pattern
- [ ] A boosted profile appears earlier but its match % is not inflated by the boost
- [ ] Profiles with no photo appear last and report a low match %, not 50%+
- [ ] `min_age` / `max_age` narrow results; `radius_km` excludes distant profiles
- [ ] A member in Mombasa still appears for a Nairobi viewer (not scored to zero)
- [ ] `feed=new`, `feed=featured`, and `feed=random` each still produce a sensible order
- [ ] Migration `20260808_020` runs clean; its `RAISE NOTICE` reports the drift count
- [ ] Its verification query returns 0 **before** `SEED_LABELS_RECONCILED=1` is set
- [ ] With the flag off, label filtering behaves exactly as before (regression check)
- [ ] With the flag on, `?label=` and `?labels=` return the same members as with it off
