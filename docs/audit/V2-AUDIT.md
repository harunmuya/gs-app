# V2 audit — genuinesugarmummies.com

**Date:** 2026-08-08 · **Scope:** `genuinesugarmummies.com/` (nested inside the V1 project folder)

This is the first look at V2. Everything before now — [Phase 1](./PHASE-1-AUDIT.md), [Wave 1](./WAVE-1-STATUS.md), [Wave 2](./WAVE-2-STATUS.md), [Wave 3](./WAVE-3-STATUS.md) — applies to V1 only. **No fix from any of those waves has been applied to V2.**

---

## Headline

V2 is a **separately deployed, live application** with its own GitHub repository, its own Vercel project, and **its own Supabase database**. It is an earlier fork of the same codebase, and it carries essentially every critical defect that Wave 1 fixed in V1 — including the two that matter most commercially and legally:

- **Premium is free.** Phone reveal unlocks from `?viewer_id=` (`api/members/route.js:536`), exactly as in V1.
- **Admin has a published password.** `ADMIN_PASSWORD || 'Admin@2026!'` with the same reversible `base64(email:password)` token (`api/admin/route.js:5-20`).

Because V2 runs on a **different** Supabase project, fixing V1 does nothing for it. Its own member data is exposed on its own terms.

---

## What V2 is

| | V1 | V2 |
|---|---|---|
| Repo | `harunmuya/GS-APP` | `harunmuya/genuinesugarmummies-com-v2` |
| Supabase project | `rmsvyhfpiytcffjkozje` | **`tislsfajzqcctjcrmnlg`** |
| Vercel | linked | linked |
| Next / React | 16.2.10 / 19.2.4 | 16.1.6 / 19.2.4 |
| `@supabase/ssr` | 0.10.3 | **absent** |
| Source | 90 files, 1205 KB | 65 files, 805 KB |
| API route groups | 15 | 12 |
| Migrations | 51 | 24 |

V2 is the smaller, older lineage: no `/api/v1/*` contract, no `stories`/`boosts` work, no `diag` endpoint.

---

## Defects carried over from V1

| # | Defect | V2 evidence | Severity |
|---|---|---|---|
| 1 | Premium bypass via `?viewer_id=` | `api/members/route.js:536` | **P0** |
| 2 | Hardcoded admin password + reversible token | `api/admin/route.js:5,6,14,20` | **P0** |
| 3 | Identity taken from request body | **26 sites** across the API | **P0** |
| 4 | Service-role client bypassing RLS | **18 sites** | **P0** |
| 5 | Fabricated presence — `livelySeedTime()` | `api/members/route.js:276`, used at `:399` | **P0** |
| 6 | Seeded engagement counts written to the database | reseed migrations, as in V1 | P1 |
| 7 | `lucide-react` runtime dependency | `package.json` | P2 |

### Two V1 defects V2 does **not** have

Worth stating, because it narrows the work:

- **No email-only login bypass.** V1 had a fallback that signed a user in by email after a wrong password. V2's login has a single `verifyPassword` gate (`:1034`) and no `findAuthUserByEmail` fallback — that hole was introduced in V1 *after* the fork.
- **No `/api/diag`.** V1's unauthenticated, service-role, writes-to-production diagnostics endpoint does not exist here.

---

## Repository hazard — fix before any V2 work

V2 lives **inside** the V1 project folder, and V1's `.gitignore` does not exclude it. The result:

```
git -C <V1> ls-files | grep '^genuinesugarmummies.com/'   ->  400 files
```

**V2's source is committed into the V1 repository as well as its own.** 2461 files / 98.9 MB sit under that folder. Practical consequences:

- Editing a V2 file shows as a modification in *both* repos.
- A commit in V1 commits V2's code into V1.
- The two copies can silently diverge, and it is not obvious which is authoritative.

This needs resolving before anyone edits V2, or the fixes will land in an ambiguous place. Options, in order of preference:

1. **Move V2 out** to a sibling directory (`../genuinesugarmummies.com`) and `git rm -r --cached genuinesugarmummies.com` in V1. Cleanest; V2 keeps its own history.
2. Add `genuinesugarmummies.com/` to V1's `.gitignore` **and** `git rm -r --cached` it. Keeps the layout, stops the duplication.
3. Leave as-is. Not recommended — the ambiguity is the problem.

---

## Porting the V1 fixes

Most of Wave 1 transfers as whole files, because it was written as self-contained modules rather than inline patches. Rough shape of the work:

**Drops in nearly unchanged** (new files, no V2 equivalent to reconcile):
- `lib/authSession.js`, `lib/adminSession.js`, `lib/profileKind.js`, `lib/discoveryRanking.js`, `lib/placeName.js`
- `proxy.js`, `components/ConnectionStatus.js`, `components/Icon.js`, `app/api/ping/route.js`
- `supabase/migrations/20260808_010`, `_020`, `_030`

**Prerequisite:** V2 has **no `@supabase/ssr`** dependency. It must be added before the session layer will work — that is the one hard blocker.

**Needs per-file adaptation** (V2's routes differ):
- 26 body-identity sites → `requireMember()`
- 18 service-role sites → reviewed, reason-documented
- `getViewerContext` re-keyed to the session
- `livelySeedTime()` and the engagement floors removed
- Login/signup migrated to Supabase Auth

**Does not apply:** the `/api/v1/*` entitlements contract and `/api/diag` do not exist in V2.

My estimate is that V2 is roughly 60–70% of the V1 effort — smaller surface, but the same architectural change, and it cannot be a copy-paste because the route bodies differ.

---

## Recommendation

**Decide V2's future before investing in it.** Two apps on two databases with overlapping purpose is a maintenance burden, and every fix now has to be made twice. Three honest options:

1. **Retire V2.** If `.co.ke` is the live product, take V2 down. Fastest way to close a live premium bypass and an exposed admin panel, and it costs no engineering.
2. **Fix V2 to parity.** Justified only if it serves a distinct market. Plan for most of another Wave 1 + Wave 2.
3. **Merge into V1.** Migrate V2's members into V1's database and redirect the domain. Most work up front, one codebase afterwards.

**Whatever you choose, do these now** — they are minutes of work and they close the two live holes:

- Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in V2's Vercel environment so the published default stops working.
- If `genuinesugarmummies-com-v2` is or ever was a public repo, rotate V2's `SUPABASE_SERVICE_ROLE_KEY`.

The `?viewer_id=` premium bypass cannot be closed by configuration — it needs the code change.

---

## Not covered

I read V2's configuration, route inventory, and the specific lines matching known V1 defects. I did **not** read all 65 source files, run V2, or inspect its database — so this establishes that V2 shares V1's architecture and defects, not that it has no additional ones of its own.
