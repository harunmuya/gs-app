# GS App Master Rebuild Deliverables

This file tracks the full rebuild request for `https://genuine-sugarmummies-app.vercel.app`. Items are not marked complete unless they are implemented and verified.

## Current Execution Status

| # | Deliverable | Status | Evidence / Next Action |
|---|---|---|---|
| 1 | Current architecture audit | Implemented, needs expansion | Current app is Next.js, Supabase, Vercel, and a Capacitor Android wrapper. |
| 2 | Defect list with severity | In progress | Critical defects: Android WebView dependency, DB drift, schema mismatch, incomplete native runtime permissions, package gate coverage, and seed/media integrity. |
| 3 | Target architecture diagram | In progress | See `architecture-blueprint.md`; versioned API foundation added. |
| 4 | Database migration scripts | Implemented in progress | Added `supabase/migrations/20260710_010_production_full_rebuild_foundation.sql`. |
| 5 | Seeded-profile cleanup report | In progress | Existing seed repairs are in `20260709_050` through `20260709_052`; live post-run report still needed. |
| 6 | Legacy-user repair report | In progress | New migration adds completion state fields and reminder foundations. Live counts still needed. |
| 7 | Native Android permission matrix | Partially implemented | Manifest now includes camera, microphone, notifications, audio settings, coarse location, and fine location. Native runtime UX still pending. |
| 8 | API endpoint documentation | In progress | See `api-v1-contract.md`; `/api/v1/bootstrap`, `/api/v1/health`, and `/api/v1/entitlements` added. |
| 9 | Package entitlement matrix | Partially implemented | `src/lib/packageAccess.js` now includes machine-readable entitlement evaluation. Every feature route still needs gate tests. |
| 10 | Payment-provider configuration | Foundation implemented | New migration adds provider config and payment event tables. UI/admin wiring pending. |
| 11 | Vercel usage report | Blocked | Requires Vercel dashboard/API access and usage export. |
| 12 | Hosting migration report | In progress | Android still depends on Vercel through Capacitor `server.url`; backend migration is required before removal. |
| 13 | Security review | In progress | New migration adds RLS for new tables; full route/security review pending. |
| 14 | Automated test results | Not complete | Build/lint must run after implementation batch. Feature tests pending. |
| 15 | Physical-device test report | Blocked | Requires real Android devices or emulator/device access. |
| 16 | Performance measurements | Not complete | Needs API timings, payload sizes, image error counts, and Vercel metrics. |
| 17 | Release notes | Not complete | Prepare after verified implementation batch. |
| 18 | Rollback instructions | In progress | Migrations are additive; rollback is feature-disable and restore backup, not deleting live data. |
| 19 | Environment-variable documentation | Not complete | Needs current environment inventory without exposing secrets. |
| 20 | Admin operating guide | Not complete | Needs admin panel feature audit after DB schema alignment. |

## Critical Product Rules

1. Real users must remain able to log in.
2. Real users must never inherit seeded profile media or labels.
3. Seeded profiles must stay separately flagged with `is_seed_profile`, `real_user = false`, and `seed_category`.
4. New accounts must become visible only after required profile details and a usable primary photo are present.
5. Members page can show all categories mixed; home and matches must follow preference rules.
6. Package rules must be enforced on API routes, not only by hiding buttons.
7. Android permissions must be requested by runtime permission APIs when a feature needs them.
8. The APK must not be considered fully rebuilt while it depends on a remote Vercel WebView.
