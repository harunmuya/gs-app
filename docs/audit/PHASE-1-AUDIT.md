# Genuine Sugarmummies — Phase 1 Full Audit

**Audit date:** 2026-08-08
**Scope audited:** V1 codebase at `genuine sugarmummies app/` (Next.js 16, React 19, Supabase, Capacitor 8)
**Repo:** `github.com/harunmuya/GS-APP.git`, branch `master`, 69 uncommitted files
**V2 (`genuinesugarmummies.com`)** — present as a nested folder with its own `.git`; **not yet audited** (see §21)

Every finding below cites the file and line where it was verified. Nothing here is inferred from naming or assumed from convention.

---

## Severity key

| Level | Meaning |
|---|---|
| **P0** | Exploitable now, or actively misleading paying users. Fix before any redesign work. |
| **P1** | Causes cost, breakage, or material trust damage. Fix in the first implementation wave. |
| **P2** | Quality, maintainability, polish. |

---

## §0. Executive summary

The application is not a "basic prototype with rough edges." It has **three structural defects** that make the rest of the roadmap unsafe to build on top of, and they must be fixed first:

1. **There is no server-side authentication on any user-facing API route.** Identity is read from the request body or query string. Every route then runs with the Supabase **service-role key**, which bypasses Row Level Security entirely. Any person with a browser can read, modify, or delete any other user's data.
2. **Premium entitlement is decided from a client-supplied query parameter.** Phone reveal — the core paid feature — unlocks on `?viewer_id=<any gold user's uuid>`, and those UUIDs are returned publicly in member listings. The paid tier is currently free to anyone who reads the network tab.
3. **The admin panel's credentials are hardcoded in source with a working default**, and the session token is a reversible base64 of those credentials.

Separately, and central to your Phase 2/3 goals: the backend **actively manufactures presence data**. `livelySeedTime()` fabricates a "last active" timestamp for every seed profile on each request, and the `isOnline` flag is computed from that fabricated value. Seed profiles are therefore shown to users as *online right now*. On a paid dating platform this is the highest-liability item in the codebase, above even the auth bypass, because it is deceptive by design rather than by accident.

**My recommendation on sequencing is that Phases 7–8 (UI/UX redesign, icon system) should not start until Phases 2–4 are done.** Redesigning the surface of a system whose data layer is being replaced means building the interface twice. The audit below is ordered accordingly.

---

## §1. Frontend architecture

**P1 — Route handlers and components are far past maintainable size.**

| File | Size |
|---|---|
| `src/app/api/members/route.js` | **148 KB** |
| `src/contexts/AuthContext.js` | **80 KB** |
| `src/lib/localSeedMembers.js` | **67 KB** |
| `src/app/(main)/profile/page.js` | 55 KB |
| `src/app/api/admin/route.js` | 52 KB |
| `src/app/auth/login/page.js` | 48 KB |
| `src/app/admin/page.js` | 47 KB |
| `src/app/(main)/discover/page.js` | 43 KB |

`api/members/route.js` alone holds 60+ top-level functions covering member listing, filtering, ranking, photo handling, name generation, uploads, support-ticket auto-responses, and account CRUD. This is the file where the entitlement bug lives, and its size is why the bug is not obvious.

**P1 — The entire seed dataset ships to the browser.**
`src/lib/profileImages.js:1` imports `localSeedRows` from the 67 KB `localSeedMembers.js`. `profileImages.js` is then imported by client components — `UserAvatar.js:3`, `BlurImage.js:4`, `BoostedMembersStrip.js:7`, `discover/page.js:12`, `members/page.js:14`, `members/[id]/page.js:11`, `matches/page.js:12`. Consequences:
- The seed roster is bundled into client JS downloaded by every visitor.
- Anyone can open devtools and enumerate the complete seed profile list, which directly contradicts the Phase 11 authenticity goal.

**P2 — `next.config.js:3-6` sets `workerThreads: false, cpus: 1`,** which serialises builds and makes them substantially slower with no runtime benefit. This looks like a leftover workaround for a build OOM.

---

## §2. Backend architecture & §4. Authentication — **P0**

**Finding 2.1 — No API route authenticates the caller.**

A search across `src/app/api/**` for any auth-header or session read returns **four** hits total: three are `x-forwarded-for` IP parsing in `location/route.js:10-13`, and one is the admin token at `admin/route.js:21`. No route calls `supabase.auth.getUser()`. No route reads an `Authorization` header. No route validates a session cookie.

Identity comes from the payload:

```js
// src/app/api/members/route.js:144
async function resolveUserId(supabase, body) {
    if (body.memberId || body.userId) return body.memberId || body.userId;
    const email = String(body.email || '').trim().toLowerCase();
    if (!email) return null;
    const { data } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
    return data?.id || null;
}
```

The caller states who they are. The server believes them. It will even resolve an identity from a bare email address.

**Finding 2.2 — Every route runs as service-role, so RLS is bypassed.**

`admin: true` appears **24 times across 15 route files** — `members`, `chat`, `wallet`, `calls`, `live`, `activity`, `admin`, `profiles/follows`, `packages`, `location`, `diag`, and all three `v1/*` routes. `createServerSupabaseClient({ admin: true })` (`src/lib/supabaseAdmin.js:11-25`) returns a client built on `SUPABASE_SERVICE_ROLE_KEY`.

The typical pattern is `createServerSupabaseClient({ admin: true }) || createServerSupabaseClient({ admin: false })` (`members/route.js:956`) — service-role first, anon only as a fallback.

**Combined impact of 2.1 + 2.2:** whatever RLS policies exist in the 51 migrations are dead code for all traffic that arrives through the API. Sending another user's UUID in a request body is sufficient to act as them. This affects messaging, wallet, profile edits, and account deletion.

> **This is the single change that has to land first.** Phase 10's RLS work has no effect until routes stop using service-role, and Phase 4's membership enforcement cannot be trusted until identity is server-derived.

---

## §3. Supabase structure & §20. Database — **P1**

**Finding 3.1 — Migration history is unreplayable.**

51 migration files. The names tell the story: `emergency_auth_members_recovery`, `critical_fixes`, `live_app_repair`, `profile_visibility_repair`, `restore_members_visibility_after_settings`, `delete_broken_duplicate_seed_profiles`, `repair_legacy_seed_photo_urls`, `clean_seed_duplicates_keep_real_users`.

Two files share the `20260707_010_` prefix (`critical_fixes` and `rls_profile_photo_admin_repair`) and two share `20260709_049_` — **ordering between them is undefined**, so a fresh replay may not reproduce production.

**Finding 3.2 — ~1.9 MB of seed data is duplicated across six migrations.**

`..._047_clean_reseed_all_categorized_profiles` (209 KB), `_048_clean_reseed_all_seed_categories` (323 KB), `_050_delete_and_reseed_kenyan_seed_profiles` (326 KB), `_051_full_seed_wipe_and_reseed_only_real_users_preserved` (326 KB), `_052_strict_folder_seed_repair` (326 KB), `20260710_020_seed_names_tiers_public_cleanup` (323 KB), plus the original `20260625_020` (279 KB). Each is a near-copy of the last. Seed content does not belong in migration history; it belongs in an idempotent seeding script run separately.

**Finding 3.3 — Schema drift is handled at runtime, not by migration.**
`members/route.js:1000-1003` catches Postgres error `42703` (undefined column) and `PGRST204`, then **re-runs the whole query against a reduced column set**. The app is defending against not knowing its own schema. Every listing request risks paying for two round-trips.

---

## §5. Membership & premium packages — **P0**

**Finding 5.1 — Phone reveal unlocks from a URL parameter.**

```js
// src/app/api/members/route.js:922
async function getViewerContext(supabase, searchParams) {
    const viewerId = searchParams.get('viewer_id');
    if (!viewerId) return { canViewPhone: false, viewer: null };
    const { data } = await supabase.from('users')
        .select('id, subscription_tier, admin_approved, ...')
        .eq('id', viewerId).maybeSingle();
    return { canViewPhone: isUnlockedViewer(data), viewer: data || null };
}
```

The server looks up the tier of *whatever UUID it is handed*. It never checks that the requester **is** that user. Member listings return `id` for each member, so a Gold subscriber's UUID is discoverable in a normal API response. Substituting it into `?viewer_id=` grants phone reveal to anyone.

`getViewerUnlock()` at line 909 has the identical flaw.

This means the Free/Silver/Gold distinction is currently unenforced at the boundary that matters most. **Phase 4's rebuild cannot succeed while entitlement is keyed to an unauthenticated parameter** — the fix is the same server-side session work as §2.

---

## §6-§9. Discovery, messaging, profiles, media

**Finding 6.1 (P1) — Discovery ranking is hash-based rotation, not relevance.**
`rotatingRank()` (`members/route.js:794`) and `mixedMemberRows()` (line 821) order results by a `stableHash` seeded on `?mix=` or a 15-minute time bucket (line 990). There is no scoring on location proximity, activity recency, profile completeness, or preference match — which is exactly the "feels random and low quality" symptom described in Phase 6. `applyViewerPreferenceMix()` (line 379) applies a fixed 4:1 primary/secondary pattern (`PREFERENCE_MIX_PATTERN`, line 365) rather than a ranked blend.

**Finding 9.1 (P1) — Over-fetching on every listing request.**
`members/route.js:992-995`: unless it is a direct lookup, the route **overrides pagination** and always fetches `per_page=240`, page 1, then paginates in memory. Every discover/members request pulls up to 240 full member rows from Supabase regardless of what the client asked for. This is a direct and significant driver of the Supabase egress and Vercel function cost noted in Phases 9–10.

**Finding 10.1 (P1) — 42 MB of seed imagery served from the app.**
`public/seed/` is **42.3 MB across 310 files**; `public/gifts/` is 8.6 MB; `public/downloads/` holds a 3.1 MB APK. Total `public/` is **57.2 MB**. These are served through Vercel rather than Supabase Storage or a CDN with transforms, and are not responsive variants.

---

## §11. Trust & authority / Phase 2 fake elements — **P0 (highest liability)**

**Finding 11.1 — Presence data is fabricated server-side.**

```js
// src/app/api/members/route.js:509
function livelySeedTime(member) {
    if (!member.is_seed_profile) return recentDisplayTime(member);
    const hash = stableHash(member.id || member.email || member.display_name);
    const bucket = hash % 8;
    const minutesAgo = bucket <= 2
        ? (hash % 4)                          // 0–3 minutes ago
        : bucket <= 4 ? 18 + (hash % 42)
        : bucket <= 6 ? 2 * 60 + (hash % (5 * 60))
        : 11 * 60 + (hash % (10 * 60));
    return new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
}
```

Because the value is recomputed as an offset from `Date.now()` on every request, seed profiles are **permanently and perpetually "recently active."** They never go stale.

This feeds the online indicator directly:

```js
// src/app/api/members/route.js:657
const isOnline = Boolean(showOnline && lastSeenMs && Date.now() - lastSeenMs < 3 * 60 * 1000);
```

Roughly **3 of every 8 seed profiles** (`bucket <= 2`, yielding 0–3 minutes) satisfy the 3-minute window at any moment. The platform continuously displays a population of seed profiles as being online and available, to users who are paying for access.

**Finding 11.2 — Display names are synthesised.**
`seedDisplayName()` (line 492) discards the stored name unless it already matches the built-in lists, and generates `FirstName Surname` from `SEED_FEMALE_FIRST_NAMES` / `SEED_MALE_SURNAMES` (lines 462-490) via a hash.

**Assessment.** Your Phase 5 instruction — label seed and WordPress profiles "Facilitation Required" and remove direct messaging from them — is the correct remedy and I will implement it as specified. I want to be direct about one thing: **the label only works if the fabricated presence goes with it.** A profile marked "Facilitation Required" that still displays a green "online now" dot is still making a false factual claim to a paying customer, and in Kenya that engages the Consumer Protection Act's provisions on misleading representations, on top of the app-store policy risk for the Capacitor build. Labelling and de-faking need to ship together, not in sequence. I have scoped them as one unit in the plan below.

---

## §12. Security — consolidated

| # | Finding | Sev |
|---|---|---|
| S1 | No authentication on any user API route; identity from request body (`members/route.js:144`) | **P0** |
| S2 | Service-role key used in all 15 route files (24 sites); RLS bypassed | **P0** |
| S3 | Premium entitlement from `?viewer_id=` query param (`members/route.js:909,922`) | **P0** |
| S4 | Hardcoded admin credentials with working default | **P0** |
| S5 | Admin token is reversible base64 of credentials, no expiry | **P0** |
| S6 | CSP allows `'unsafe-inline'` and `'unsafe-eval'` (`next.config.js:84`) | P1 |
| S7 | Custom scrypt password stack parallel to Supabase Auth (`lib/security.js`) | P1 |

**S4/S5 detail:**

```js
// src/app/api/admin/route.js:7-23
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@genuinesugarmummies.co.ke';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@2026!';

function tokenFor(email, password) {
    return Buffer.from(`${email}:${password}`).toString('base64');
}
function isAuthed(request) {
    const token = request.headers.get('x-admin-token') || '';
    return token === tokenFor(ADMIN_EMAIL, ADMIN_PASSWORD);
}
```

If `ADMIN_PASSWORD` is unset in any environment, the default grants full admin access — and the default is in a GitHub repo. The token is a static, non-expiring, reversible encoding of the credentials, held in browser storage (`admin/page.js:202`). Anyone who obtains it can decode the live admin password.

**Action required from you (I cannot do this):** rotate `ADMIN_PASSWORD` and, if the repo is or ever was public, treat `SUPABASE_SERVICE_ROLE_KEY` as compromised and rotate it in the Supabase dashboard. Please do **not** send me admin credentials or the service-role key — I don't need them for any of this work, and I won't enter them anywhere.

**Good news:** `.env.local` is correctly gitignored (`.gitignore:26`) and is **not** tracked by git. Verified.

**S7 detail:** `lib/security.js` implements scrypt hashing, reset-code generation, and email hashing — a second identity system alongside Supabase Auth. Two sources of truth for identity is the root cause of the `emergency_auth_members_recovery` migration.

---

## §13-§15. SEO, accessibility, responsiveness

Assessed structurally; full audit requires the running app (see §22).

- **SEO (P1):** `src/app/page.js` is 1.2 KB and `layout.js` 3.4 KB — no `generateMetadata`, no per-profile metadata, no `sitemap.ts`/`robots.ts` anywhere in `src/`. Member profiles are client-rendered and therefore largely invisible to crawlers.
- **Accessibility (P1):** Phase 8 requires removing `lucide-react`, which is currently a dependency and supplies icons app-wide. That swap is also the moment to fix icon labelling — decorative vs. semantic — so I've merged the a11y icon pass into Phase 8 rather than treating it separately.
- **Responsiveness:** Tailwind 4 is configured; no evidence yet either way. Needs device testing.

---

## §16-§19. Vercel, caching, API

**Finding 16.1 (P1) — Cost drivers identified, in order of impact:**
1. Forced `per_page=240` fetch on every listing request (§9.1).
2. 57 MB of static assets served from Vercel (§10.1).
3. Schema-fallback double queries (§3.3).
4. 148 KB route handler cold-start cost.

**Finding 18.1 (P2) — Caching is inconsistent.** `members/route.js:982` sets `public, s-maxage=15, stale-while-revalidate=30` for anonymous listings but `private, no-cache, max-age=0` whenever `viewer_id` is present — so every logged-in request is uncached. Once auth moves to sessions, this needs rethinking around a proper vary strategy.

**Finding 19.1 (P2) — `/api/diag` exists** (`src/app/api/diag/route.js`, service-role). Needs confirmation it is not reachable in production.

---

## §21. V2 — not yet audited

`genuinesugarmummies.com/` sits **inside** the V1 project folder with its own `.git`, `.next`, `node_modules`, plus `gs-app-api/`, `gs-app-api.zip`, and `pics to be seeded/`. V1's `.gitignore` does not exclude it, so git sees an embedded repository — this needs untangling before either project can be versioned cleanly. I have not read V2's source yet.

## §22. What I could not verify without access

- Live Supabase schema, indexes, RLS policies, triggers, storage buckets — the migrations tell me intent, not current state.
- Actual Vercel usage/cost figures.
- Runtime behaviour: render loops, duplicate calls, real responsiveness and a11y.
- V2 entirely.

---

## Prioritised fix list

**Wave 0 — you, now, before any code:** rotate `ADMIN_PASSWORD`; rotate `SUPABASE_SERVICE_ROLE_KEY` if the repo was ever public; confirm whether GS-APP is public or private.

**Wave 1 — P0, must precede everything else**
1. Server-side session auth; derive identity from the session, never the payload. *(S1)*
2. Move routes to an RLS-respecting client; restrict service-role to genuinely privileged operations. *(S2)*
3. Re-key entitlement to the authenticated session. *(S3)*
4. Replace the admin token with a real signed, expiring session; remove hardcoded defaults. *(S4, S5)*
5. Delete `livelySeedTime()` and `seedDisplayName()`; ship the "Facilitation Required" labels and DM removal in the same change. *(11.1, 11.2, Phase 5)*

**Wave 2 — P1 cost and correctness**
6. Honour real pagination; stop the forced 240-row fetch.
7. Move `public/seed` to Supabase Storage or a CDN; responsive variants; progressive loading.
8. Remove `localSeedMembers` from the client bundle.
9. Consolidate migrations into a replayable baseline; move seed data out of migrations.
10. Rebuild discovery ranking on real signals.

**Wave 3 — Phases 6-8, 12-13**
11. Real presence, views, likes, matches from actual events.
12. UI/UX redesign, self-hosted SVG icon system, responsive audit, SEO, launch checklists.

---

*Phase 1 complete. Findings §1-§20 delivered for V1; V2 audit and the running-app checks remain outstanding.*
