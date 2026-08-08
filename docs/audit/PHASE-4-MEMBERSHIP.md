# Phase 4 — membership system rebuild

**Date:** 2026-08-08 · **App:** V1 · **Build:** `next build` passes

Packages, limits, admin control, and what members are shown about their own plan.

---

## What was actually wrong

### 1. The admin control panel controlled nothing

The "Ads & Limits" tab wrote three numbers to a **single global row** in `app_limits`. Enforcement reads **per-tier** columns from `package_tiers`. Nothing in the entitlement path has ever read `app_limits` — it is written by the admin route and read back only to redisplay itself.

Every limit an administrator set was ignored by the running product.

Worse, the panel's package list came from `PACKAGE_TIERS`, a constant built from the hardcoded defaults in `packageAccess.js` — so it displayed built-in values rather than the database, and an administrator had no way to see the real configuration, let alone change it.

### 2. Paid limits were silently overridden in code

```js
// packageAccess.js, normalizePackageRow
if (tierId !== 'free') normalized.daily_message_limit = 0;
```

Whatever the database said, every paid tier's message limit was forced to 0 (which means unlimited). An administrator could set Silver to 25 messages a day and the code would discard it on read.

### 3. A gate that could never close

```js
if (feature === 'messages') return dailyLimitForFeature(tier, 'messages') !== 0;
```

`dailyLimitForFeature` returns `null` for any non-positive value and never returns `0`, so this comparison was always true. The messaging feature gate had no effect at any tier.

### 4. Limits could be exceeded by racing

All three quota implementations did `SELECT count` → compare → `UPDATE`. Two concurrent requests both read 4, both saw `4 < 5`, and both wrote 5. On a paid quota that is a bypass requiring no tooling — a fast double tap is enough.

### 5. A database error granted unlimited access

```js
if (result.error && result.error.code === 'PGRST205') return { ok: true, /* ... */ skipped: true };
if (result.error && result.error.code !== 'PGRST116') return { ok: true, /* ... */ skipped: true };
```

A missing table, or any query error, returned **allowed** and skipped counting. The failure mode of the paid-feature gate was to give the product away.

### 6. Three divergent copies

`api/members`, `api/chat`, and `api/wallet` each had their own `enforceDailyLimit`. They had already drifted: the chat copy carried an `if (limit <= 0) deny` branch that could never run, because the helper it called returns `null` rather than `0`.

---

## What changed

### Migration — `20260808_040_entitlements_atomic_quota_and_admin_control.sql`

- Extends `package_tiers` with the **full entitlement surface** the app reads (15 columns it lacked: like/swipe/view limits, the `can_*` flags, gift tier, starting credits, tagline).
- Seeds the **`free` tier**, which had no row at all, plus values for the new columns on existing tiers — using `COALESCE` so configured prices and names survive.
- Adds `consume_daily_quota(user_id, kind, limit)`: an **atomic** `INSERT … ON CONFLICT DO UPDATE … WHERE count < limit` that increments and checks in one guarded statement. Two concurrent callers cannot both pass the same final unit.
- Adds `peek_daily_quota` for read-only display.
- Both functions are `SECURITY DEFINER` with `EXECUTE` revoked from `anon`.

**Limit convention preserved deliberately:** `0` or `NULL` means unlimited. The seeded silver and gold rows already use `0` that way, so redefining it as "blocked" would have cut off paying members overnight. Blocking is expressed by the boolean flags.

### `src/lib/entitlementGuard.js` (new)

One `consumeQuota()` replacing all three copies. Atomic via the RPC, and **fails closed** — an unavailable quota service returns 503 rather than granting access.

### `packageAccess.js`

Removed the `daily_message_limit = 0` override; database values now win. Fixed the dead messages gate.

### Admin panel

`packages` in the GET payload is joined by `packageTiers`, read live from the table. New `update_package_tier` action with an explicit column allowlist. The tab is now a **per-tier editor** — every numeric limit and every feature flag, with unsaved-change indicators, and the `0 = unlimited` convention stated in the UI rather than left as folklore. Changes take effect on the next request.

`app_limits` keeps only what genuinely lives there: photo count, manual verification, ads.

### Packages page

`/api/packages` now returns, for a signed-in member, their **effective** entitlements and today's usage alongside the catalogue. The page shows a "Your plan" panel with live quota bars, the features actually granted, and — importantly — an explicit notice when a paid package is **not in effect** (awaiting approval, locked, or expired) instead of quietly serving free-tier limits to someone who has paid.

The tier cards remain hand-maintained marketing copy; the panel above them is read from the enforcement layer, so what a member is told and what the server allows cannot drift.

---

## Verified

Entitlement logic tested directly:

```
admin sets Silver messages=25  -> 25          (previously discarded, became unlimited)
admin sets Silver likes=40     -> 40
stored limit 0                 -> unlimited   (backward compatible)
canUseFeature(free,'gifts')    -> false       (gate works)
canUseFeature(free,'messages') -> true        (explicit, was a dead comparison)

effective tier degradation:
  paid + approved       -> gold
  paid + NOT approved   -> free
  paid + locked         -> free
  paid + expired        -> free
  paid + future expiry  -> gold
```

## Not verified

**The atomic quota function has not been executed.** Testing it requires running the migration, and the only database reachable from here is production — not somewhere to try new SQL. The logic is a standard guarded upsert and the migration includes a verification snippet:

```sql
SELECT * FROM public.consume_daily_quota('<user uuid>'::uuid, 'likes', 3);
-- run four times: the fourth must return allowed=f
```

Run that on staging before relying on it.

---

## Found by running the app against a live session

These were not visible from reading the code. They surfaced by exercising the real API and pages while signed in.

### 7. `/api/packages` had been serving hardcoded defaults all along

The query filtered `.eq('is_active', true)`. On this deployment that column **does not exist** — the dev log gave it up directly:

```
[api/packages] tier query failed: column package_tiers.is_active does not exist
```

Postgres returned 42703, and the route's bare `catch` swallowed it into `defaultPackageTiers()`. Meanwhile `getPackageTier` — same table, no such filter — read the real rows. So one endpoint reported **two different limits for the same tier** in a single response: catalogue said messages `0` (unlimited), usage said `30`.

The giveaway was the returned object's keys: no `is_active`, no `sort_order`, no `created_at`. Those were never database rows.

Fixed both ways — the migration adds the missing columns, and the route retries without them rather than silently abandoning the database. Verified: `source: "database"`, and all five limits now match between catalogue and enforcement.

### 8. The Basic package advertised "Unlimited messages" while capped at 30

Static marketing copy had drifted from enforcement:

| Claim on the page | Actually enforced |
|---|---|
| "Unlimited messages every day" | **30/day** |
| "30 swipes every day" | 40/day |
| "30 profile views every day" | 40/day |

Someone paying KSh 650 for unlimited messaging was cut off at 30. Every numeric claim is now generated from the same tier row the server enforces; prose claims stay hand-written. Verified all five figures match for Basic, and that Silver and Gold still correctly read "Unlimited" where their limit is genuinely 0.

### 9. The palette change had missed the most commercial screen

The packages hero used a hardcoded four-stop ramp — `#6B1D42 → #9B2C5E → #D4A03C → #B8860B` — written as literal old-palette hexes rather than a token, so it survived the palette rework untouched. My earlier sweep looked for three-stop gradients and missed it. Also replaced: the `themeColor` meta, and two gradients plus a shadow in `ProfileCompletionModal`.

### 10. Second copy of the `999` placeholder

The profile page had its own blurred `999` for locked stats — the same fabricated figure removed from the member detail page in Phase 2. Now a `•••` mask.

---

## Deploy order

1. `20260808_010` — auth cutover + RLS
2. `20260808_020` — seed label reconciliation
3. `20260808_030` — clear fabricated engagement
4. `20260808_040` — entitlements + atomic quota  ← new

Then set `ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH`, and `SEED_LABELS_RECONCILED=1` once `_020`'s check returns 0.

## Testing checklist

- [ ] Admin panel lists 4 tiers read from `package_tiers`, not the built-in defaults
- [ ] Changing Silver's "Likes / day" to 3 and saving takes effect on the next like, with no deploy
- [ ] The 4th like that day is refused with a 402 and an upgrade prompt
- [ ] Firing 5 likes concurrently consumes at most the configured limit (this is the race fix)
- [ ] Turning off "Send gifts" for Basic blocks gift sending immediately
- [ ] Setting a limit to 0 means unlimited, not blocked
- [ ] With `consume_daily_quota` dropped, gated actions **fail closed** (503), not open
- [ ] A member awaiting package approval sees "Not active" and free limits on /packages
- [ ] Quota bars on /packages match what enforcement actually permits
