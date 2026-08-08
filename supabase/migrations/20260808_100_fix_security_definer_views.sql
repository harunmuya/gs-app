-- SUPERSEDED by 20260809_000_consolidated_security_reset.sql — DO NOT RUN.
--
-- absorbed as Phase 5.
-- Running this after the reset would layer a superseded rule set back on top.
-- Kept for the reasoning in its comments only.
--
-- Everything below is disabled.
/*
-- Resolve the three Critical "Security Definer View" findings.
--
--   public.admin_seed_profile_audit
--   public.admin_legacy_user_repair_audit
--   public.admin_package_schema_audit
--
-- All three were created in 20260710_010_production_full_rebuild_foundation.sql
-- as plain `create or replace view`. Nothing declared them SECURITY DEFINER —
-- that is simply what a Postgres view is by default. `security_invoker` defaults
-- to false, so the view executes with the *owner's* rights (postgres), and the
-- row level security of the querying user never applies.
--
-- Why that matters here specifically: all three aggregate over public.users, a
-- table holding 148 real accounts with emails. A view owned by postgres and
-- granted to `anon` hands any holder of the publishable key a count of banned
-- users, suspended users, incomplete profiles and seeded rows — and it does so
-- straight through whatever RLS 060 puts on the table, because the view owner
-- outranks it.
--
-- Two changes, because either alone is insufficient:
--
--   1. security_invoker = on, so the view respects the caller's RLS instead of
--      the owner's. This is what clears the linter.
--   2. Revoke from anon and authenticated. These are administrative diagnostics;
--      no member has any business reading them, and after (1) they would return
--      zeroes to a member anyway — a confusing half-answer rather than a refusal.
--
-- The admin panel is unaffected: /api/admin uses the service role, which bypasses
-- RLS and retains its grants. Nothing in src/ queries these views at all — they
-- exist for manual inspection during the rebuild. If you would rather not keep
-- them, the drops at the bottom are commented out and safe to run instead.

begin;

do $$
declare
    v text;
begin
    foreach v in array array[
        'admin_seed_profile_audit',
        'admin_legacy_user_repair_audit',
        'admin_package_schema_audit'
    ]
    loop
        if exists (
            select 1 from pg_views where schemaname = 'public' and viewname = v
        ) then
            -- security_invoker needs Postgres 15+. Supabase is well past that,
            -- but fail loudly rather than silently leaving the view exposed.
            execute format('alter view public.%I set (security_invoker = on)', v);
            execute format('revoke all on public.%I from anon, authenticated', v);
            raise notice 'secured view public.%', v;
        else
            raise notice 'view public.% not present, skipping', v;
        end if;
    end loop;
end $$;

commit;

-- Verify — every row should read security_invoker=on, and neither anon nor
-- authenticated should appear in the grants:
--
--   select c.relname,
--          c.reloptions,
--          has_table_privilege('anon', c.oid, 'select')          as anon_can_read,
--          has_table_privilege('authenticated', c.oid, 'select') as member_can_read
--   from pg_class c
--   join pg_namespace n on n.oid = c.relnamespace
--   where n.nspname = 'public'
--     and c.relkind = 'v'
--     and c.relname in ('admin_seed_profile_audit',
--                       'admin_legacy_user_repair_audit',
--                       'admin_package_schema_audit');
--
-- Then re-run the Supabase linter; all three findings should clear.

-- Alternative, if you would rather remove them outright. Nothing in the
-- application reads these:
--
--   drop view if exists public.admin_seed_profile_audit;
--   drop view if exists public.admin_legacy_user_repair_audit;
--   drop view if exists public.admin_package_schema_audit;

*/
