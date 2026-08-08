# Migration runbook — 2026-08-08

Eight migrations, in order. Every one is idempotent and none deletes member data.

Run **060 first if you can only run one today** — it closes a live data exposure.

---

## Order and purpose

| # | File | What it does | Risk |
|---|---|---|---|
| **060** | `critical_rls_lockdown` | **Stops anonymous read access to messages, emails, notifications, matches, payments** | None to the app — server routes use the service role |
| 010 | `supabase_auth_cutover_rls` | Links `auth_user_id`, RLS for the auth cutover | Low |
| 020 | `reconcile_seed_profile_labels` | Makes `profile_label` agree with the photo folder | Low, seed rows only |
| 030 | `clear_seeded_engagement_metrics` | Zeroes fabricated views/followers/gifts on seeds | Low, seed rows only |
| 040 | `entitlements_atomic_quota_and_admin_control` | Full entitlement columns, `free` tier row, atomic quota function | Low |
| 050 | `payment_requests` | Unique index on payment reference, provider columns | **May fail — see below** |
| 070 | `real_interactions_and_mutual_matches` | Creates `user_interactions`, `member_matches`, match trigger | Low |
| 080 | `consolidate_notifications` | Carries 628 orphaned notifications into the live table | Low |
| 090 | `realtime_calls_and_live` | RLS on the four realtime tables, then publishes them | Low — **must run after 060** |

### 090 is optional, and ordered for a reason

Calls, live chat and live gifts work without it: verified on 8 Aug 2026 with
`scripts/verify-realtime-enabled.mjs`, none of `call_signals`, `call_sessions`,
`live_comments` or `live_gifts` is in the `supabase_realtime` publication, so all
four fall back to polling. Running 090 turns pushes on and takes live chat from
a 2.5-second poll to instant.

The order is not cosmetic. Realtime honours RLS, but a published table with RLS
*disabled* streams every row to any client holding the anon key — publishing
`call_signals` in that state would broadcast the SDP and ICE candidates of every
call in the system to anyone who subscribed. 090 therefore enables RLS and writes
the participant policies before it touches the publication. Do not reorder the
statements inside it, and do not run it before 060.

060 is listed first by priority but is numbered to run after 010–050. If you are running them all in one sitting the numeric order is fine — it is a single session. If you are staging them, run 060 on its own today.

---

## 050 may fail, and that is informative

The unique index on `payment_reference` will refuse to build if two rows already share a code. That is worth knowing rather than working around:

```sql
SELECT upper(payment_reference) AS reference, count(*), array_agg(id) AS rows
FROM public.package_requests
WHERE payment_reference <> ''
GROUP BY 1 HAVING count(*) > 1
ORDER BY 2 DESC;
```

Each group is either an honest double submission — keep one — or the same receipt used by two accounts, which is worth looking at before you delete anything.

---

## After running

**Set these environment variables:**

| Variable | Why |
|---|---|
| `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` | Admin login now fails closed. Without these nobody can sign in. |
| `SEED_LABELS_RECONCILED=1` | Only after 020's verification query returns 0 |
| `NEXT_PUBLIC_MPESA_TILL`, `NEXT_PUBLIC_AIRTEL_NUMBER` | Currently defaulting to `5204588` and `0738871048` from the old code |

Generate the admin hash with:

```bash
node -e "import('./src/lib/security.js').then(m=>console.log(m.hashPassword('YOUR_PASSWORD')))"
```

**Run the photo migration** (moves 1.8 MB of base64 images out of the users table):

```bash
node scripts/migrate-data-url-photos.mjs           # dry run
node scripts/migrate-data-url-photos.mjs --apply
```

**Rotate `SUPABASE_SERVICE_ROLE_KEY`** if the repo was ever public.

---

## Verify after deploying

**The exposure is closed.** With the *anon* key, every one of these must return zero rows or an error:

```sql
select * from messages limit 1;
select * from conversations limit 1;
select * from user_notifications limit 1;
select * from matches limit 1;
select email from users limit 1;          -- must fail
select display_name from users limit 1;   -- must still work
```

**The app still works signed in.** Everything reads through server routes on the service role, so it should be unaffected — but confirm rather than assume: discover, members, messages, alerts, packages, wallet.

**Matches are real now.** Two accounts liking each other should produce a row in `member_matches` and a notification for both. Withdrawing one like should remove it.

**Likes no longer error on seeded profiles.** Previously a like on `seed-local-*` raised a UUID type error and returned 500 while still spending the member's daily quota.

---

## Expected visible changes

Worth knowing before members notice and ask.

- **The members list will shrink.** 56 of 148 accounts have no profile picture and were being listed anyway, contradicting the app's own promise that a profile stays off the Members page until a photo is uploaded. They reappear as people upload.
- **Two accounts become hidden.** They had set their profile to private; a bug in the listing filter was ignoring that.
- **Seeded profiles lose their view, follower and gift counts**, and stop showing as recently active. Those numbers were generated, not recorded.
- **628 old notifications appear in members' alerts**, marked read, dated back to May. They were written to an orphaned table and never shown.
- **Everyone's first login goes through the auth migration path.** Expect a burst of re-logins; that is the cutover working.
