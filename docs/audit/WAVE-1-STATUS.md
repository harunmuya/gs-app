# Wave 1 — implementation status

**Date:** 2026-08-08 · **App:** V1 (`genuinesugarmummies.co.ke`) · **Build:** `next build` passes

Companion to [PHASE-1-AUDIT.md](./PHASE-1-AUDIT.md). This records what actually landed, what is still open, and what must happen before deploying.

---

## Landed

### 1. Session foundation — `src/lib/authSession.js` (new)
RLS-respecting route client bound to session cookies via `@supabase/ssr`. `getAuthUser()` uses `auth.getUser()`, which validates the JWT against the auth server rather than trusting cookie contents. `createAdminClient(reason)` requires a stated reason, so every remaining RLS bypass is self-documenting at the call site. `requireMember()` gates a route and rejects banned/suspended/deleted accounts centrally.

`src/middleware.js` (new) refreshes sessions and writes rotated tokens. Static assets and `/seed` imagery are excluded from the matcher so auth refresh does not run on image requests.

### 2. Supabase Auth cutover — `api/members/route.js`
Login now performs a **transparent migration with no forced password reset**: the legacy scrypt hash is verified first, and because the password is then known-good, the Supabase Auth identity is provisioned with that same password, a real session is minted, and `password_hash` is nulled. Members notice nothing.

Signup provisions the auth identity *before* the row insert and uses the auth uid as `users.id`, so new accounts satisfy the `auth.uid() = id` policies directly. A failed insert rolls the auth user back rather than orphaning it. Password reset now updates the Supabase Auth credential and clears any legacy hash.

`accountPayload()` no longer writes `password_hash` at all.

### 3. Authentication bypass removed — `api/members/route.js`
Found while wiring the above, not in the original audit. In the old login flow, when `signInWithPassword` failed on a **wrong password**, execution fell through to a lookup by email alone via the admin API and signed the user in regardless. Any account present in Supabase Auth without a `public.users` row was accessible with an arbitrary password. The fallback is gone; a failed password now ends the attempt.

### 4. Entitlement re-keyed to the session — `api/members/route.js`
`getViewerContext()` no longer reads `?viewer_id=`. Phone reveal and tier gating derive from the verified session, so pasting a Gold subscriber's uuid does nothing. Dead `getViewerUnlock()` removed.

**Cache correctness:** with entitlement moving to cookies, a signed-in response could have been stored in a shared cache under an anonymous-looking URL, leaking revealed phone numbers. Responses are now `private` whenever a session resolves, not merely when `viewer_id` is present.

### 5. Admin authentication — `src/lib/adminSession.js` (new)
Hardcoded `admin@genuinesugarmummies.co.ke` / `Admin@2026!` defaults removed; login **fails closed** when unconfigured. The reversible `base64(email:password)` token is replaced by an HMAC-signed token with an 8-hour expiry, delivered in an httpOnly cookie that page scripts cannot read. `ADMIN_PASSWORD_HASH` (scrypt) is preferred over plaintext `ADMIN_PASSWORD`. Changing `ADMIN_EMAIL` invalidates outstanding sessions. Per-instance login throttling added — see the caveat in the file; it is not a substitute for a shared rate limiter.

Admin UI moved off `localStorage` to the cookie session, with a real logout.

### 6. Fabricated data removed — Phase 2/3, shipped with Phase 5 labelling
| Removed | Was |
|---|---|
| `livelySeedTime()` | Generated "last active" as an offset from `Date.now()`, so seed profiles were permanently fresh and ~3 in 8 showed as **online now** |
| `seedDisplayName()` | Synthesised names from built-in first/surname lists via a hash |
| `seedViewFloor` | Fake profile views, 900–9,900 |
| `seedFollowerFloor` | Fake followers, 35–455 |
| `seedGiftFloor` | Fake gifts received, 4–84 |
| `view` action synthetic count | Returned an invented view total for local seed profiles |
| `isSeedProfile: false` | **Hardcoded**, so the client could never tell a seed profile from a real one |
| Locked `Stat` value `999` | Blurred placeholder implying a real magnitude; now a `•••` mask |

Counts now report recorded activity only.

### 7. Facilitation labelling — Phase 5, `src/lib/profileKind.js` (new)
Single server-side source of truth for provenance (`real` / `seed` / `wordpress`). Seed and WordPress profiles carry `requiresFacilitation`, `facilitationLabel`, `facilitationNotice`, and `canDirectMessage: false`. The client cannot decide a profile is real.

Surfaced on the member detail page (header badge, disabled message control, composer replaced by an introduction-request panel), the members grid (card badge, blocked message action), and the discover deck (card badge).

### 8. Migration — `supabase/migrations/20260808_010_supabase_auth_cutover_rls.sql` (new)
Adds and indexes `auth_user_id`, adds a `lower(email)` index the login path can actually use, backfills the link where `users.id` already equals an auth uid, and rewrites the RLS policies to match on **either** linkage column so migrated and new accounts are both covered. Excludes banned/suspended/deleted accounts from public reads and revokes `SELECT` on `password_hash` from `anon` and `authenticated`. Idempotent; deletes nothing.

---

### 9. Write authorization — all routes converted
Every user-facing route now derives the actor from `requireMember()` / `getSessionMember()`. Body- and query-supplied identity is ignored throughout.

| Route | Was exploitable as |
|---|---|
| `api/wallet` (GET/POST) | Read any member's balances and history; top up and spend against their wallet |
| `api/chat` (GET/POST) | Read any member's full message history; send messages that appear to come from them |
| `api/calls` (GET/POST) | Read another member's call history; place calls as them |
| `api/live` (POST) | Start streams and perform stream actions as another member |
| `api/activity` (GET/POST) | Read another member's views/likes/stories feed; post as them |
| `api/profiles/follows` (GET/POST) | Follow and unfollow as another member |
| `api/location` (POST) | Overwrite another member's coordinates, which drive nearby/distance |
| `api/v1/entitlements` (GET/POST) | Read another member's package state |
| `api/members` — 22 sites | Settings, inbox, profile edits, photos, **account deletion**, likes, saves, views, gifts, all as another member |

`resolveUserId()` was rewritten rather than replaced call-by-call, which converted eleven member-scoped actions at once. `resolvePayloadId()` was deleted — it let the client pick the primary key of a new account row, and is the original reason `users.id` never matched `auth.uid()`.

Two body-supplied ids were deliberately kept: `api/admin` acting on a target user (already behind the admin session) and `members.body.memberId` naming the profile being acted *on* rather than the actor.

### 10. `/api/diag` closed
Was reachable unauthenticated, ran service-role writes against the live database, and **inserted test rows into production `users`** while reporting column-level schema. Now requires an admin session and 404s otherwise.

### 11. Stale-session handling — `contexts/AuthContext.js`
The heartbeat now treats a 401 as a stale local session and signs out. Without this, every member signed in before the cutover would have kept local state with no cookie and seen an app where every request failed.

---

## Still open

Wave 1 is complete. Outstanding from Wave 2 onward: forced `per_page=240` over-fetch, 57 MB of assets served from Vercel, `localSeedMembers` in the client bundle, migration consolidation, discovery ranking, then Wave 3 (UI/UX, icons, SEO, responsiveness).

One deliberate carry-over: routes still use the service-role client, now with a **verified** subject. That closes the identity forgery, which was the exploitable half. Authoring RLS policies for wallet, gift, call, live, and story tables so routes can drop to the anon client is Phase 10 work and is tracked there.

---

## Before deploying

1. **Set `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH`** (or `ADMIN_PASSWORD`) in Vercel. Admin login now fails closed — without these, nobody can sign in. Generate a hash with:
   ```
   node -e "import('./src/lib/security.js').then(m=>console.log(m.hashPassword('YOUR_PASSWORD')))"
   ```
2. Optionally set `ADMIN_SESSION_SECRET` (≥16 chars). Without it, sessions are signed with a key derived from the service-role key, which works but couples admin session rotation to that key.
3. **Run the migration** `20260808_010_supabase_auth_cutover_rls.sql`.
4. **Rotate `ADMIN_PASSWORD`**, and rotate `SUPABASE_SERVICE_ROLE_KEY` if `GS-APP` is or ever was public.
5. Verify on a staging deploy before production — every existing member's first login goes through the migration path.

## Testing checklist for this change set

- [ ] Legacy member (has `password_hash`) logs in with existing password → succeeds, `password_hash` becomes null, `auth_user_id` set
- [ ] Same member logs in a second time → takes Path A, still succeeds
- [ ] Wrong password → 401, no session, `password_hash` unchanged
- [ ] Account in Supabase Auth with no `users` row + wrong password → 404/401, **not** signed in (was the bypass)
- [ ] New signup → auth user and row created with matching id, session established
- [ ] Signup where insert fails → auth user rolled back, email reusable
- [ ] Password reset → new password works, old password rejected
- [ ] Free member cannot reveal a phone number by sending `?viewer_id=<gold uuid>`
- [ ] Signed-in listing response carries `Cache-Control: private`
- [ ] Seed profile shows "Facilitation Required", no online dot, no fabricated counts, no message composer
- [ ] Admin login fails closed when env unset; succeeds when set; logout clears; session expires at 8h
- [ ] Signed-in member A cannot read member B's wallet, chat history, call log, or activity by sending B's id
- [ ] Member A cannot send a message, place a call, follow, or write location as member B
- [ ] Member A cannot delete member B's account
- [ ] Messaging a seed profile returns 403 `FACILITATION_REQUIRED` even when called directly against the API
- [ ] `/api/diag` returns 404 without an admin session
- [ ] A member with pre-cutover localStorage state and no cookie is signed out on first heartbeat rather than left in a 401 loop
