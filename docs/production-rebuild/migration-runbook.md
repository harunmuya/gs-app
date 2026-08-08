# Production Migration Runbook

## Rule One

Back up Supabase database and storage before applying production migrations. These migrations are additive, but live data must still be backed up first.

## Safe Order

1. Apply `20260710_010_production_full_rebuild_foundation.sql`.
2. Query audit views:
   1. `select * from public.admin_seed_profile_audit;`
   2. `select * from public.admin_legacy_user_repair_audit;`
   3. `select * from public.admin_package_schema_audit;`
3. Confirm existing users can log in.
4. Confirm a newly created complete user appears in members.
5. Confirm incomplete users are hidden until completion, not deleted.
6. Confirm seeded profiles remain `real_user = false`.
7. Confirm messaging inserts no longer fail on `messages.content`.
8. Confirm package routes can read all package feature columns.
9. Confirm `/api/v1/bootstrap`, `/api/v1/health`, and `/api/v1/entitlements` work in production.
10. Only then continue to v1 members/chat/calls/live/payment endpoints.

## Smoke Test SQL

```sql
select * from public.admin_seed_profile_audit;
select * from public.admin_legacy_user_repair_audit;
select * from public.admin_package_schema_audit;
select id, display_name, email, real_user, is_seed_profile, profile_completion_status, discoverability_status
from public.users
order by created_at desc
limit 20;
```

## Rollback Strategy

This foundation migration does not delete records. If a UI problem appears:

1. Do not drop columns or tables immediately.
2. Disable UI paths using feature flags.
3. Restore old route behavior if needed.
4. Use the backup only if data was corrupted externally.
5. Keep audit views available for diagnosis.

## Production Blocks That Need External Access

1. Vercel usage and bandwidth report.
2. Supabase live execution result and row counts.
3. Payment provider credentials/callback URLs.
4. Firebase Cloud Messaging project.
5. Physical Android devices for permission/call/live testing.

