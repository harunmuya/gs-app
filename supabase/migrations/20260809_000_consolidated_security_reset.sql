-- =============================================================================
-- CONSOLIDATED SECURITY RESET — genuinesugarmummies.co.ke (V1)
-- Project ref: rmsvyhfpiytcffjkozje
--
-- Run this ONCE, as a single script, in the Supabase SQL editor.
-- It replaces every policy migration that came before it.
-- =============================================================================
--
-- WHAT THIS REPLACES
--
-- teta.txt contains 9,961 lines of accumulated SQL: 257 `create table`
-- statements covering 69 distinct tables (user_settings appears 10 times,
-- conversations 9, messages 8), 217 `create policy` against 173 `drop policy`,
-- and seed-deletion filters written for the V2 domain
-- (seed+%@genuinesugarmummies.com) that were run against V1, whose seeds use
-- .co.ke — so those clauses matched nothing here.
--
-- The duplication is mostly harmless because the statements are idempotent. The
-- policies are not. 81 of them are `using (true)`, including:
--
--     create policy "GS app server readable conversations"
--       on public.conversations for all using (true) with check (true);
--     create policy "GS app server readable messages"
--       on public.messages for all using (true) with check (true);
--
-- RLS is enabled on those tables, which is why the dashboard shows them as
-- protected. The policy then grants everything to everyone. Measured against the
-- live database with the publishable key on 9 Aug 2026:
--
--     users                  148 rows   incl. email, phone, password_hash
--     messages               967 rows   incl. message bodies
--     conversations          939 rows
--     notifications          628 rows
--     user_notifications     384 rows
--     profile_views          164 rows
--     user_settings          146 rows
--     user_daily_usage       138 rows
--     admin_logs             102 rows
--     credit_wallet           34 rows
--     direct_messages         25 rows
--     ... 17 tables, 3,731 rows in total
--
-- Anyone with the publishable key — which is in the JavaScript bundle of every
-- page, by design — can read all of that today.
--
-- -----------------------------------------------------------------------------
-- WHAT THIS DOES NOT DO
--
-- It does not delete, truncate or modify a single row of your data. No DROP
-- TABLE, no TRUNCATE, no DELETE, no UPDATE. Your 148 accounts, 967 messages,
-- 939 conversations and every payment record are untouched.
--
-- "Erase all" here means the *policy layer* only — the duplicated, contradictory
-- rules — which is rebuilt from nothing. That is reversible: policies can be
-- rewritten. Data cannot be un-deleted, so this script does not go near it.
--
-- -----------------------------------------------------------------------------
-- WHY DEFAULT-DENY IS SAFE HERE
--
-- Verified before writing this: `createBrowserSupabaseClient` appears in 15
-- places in src/, and not one of them calls `.from()`. The browser uses the anon
-- key for exactly two things — Supabase Auth, and Realtime channel
-- subscriptions. Every piece of data the app displays is fetched by an API route
-- through `createServerSupabaseClient({ admin: true })`, i.e. the service role,
-- which bypasses RLS entirely and is unaffected by anything below.
--
-- So revoking anon and authenticated access to the tables cannot break the
-- application. If a future feature needs a direct browser read, add a policy for
-- that specific case — do not reopen the table.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Guard: refuse to run against the wrong project.
-- The V2 database (tislsfajzqcctjcrmnlg) has its own schema and its own users;
-- this script is written for V1's tables and must not be applied there.
-- -----------------------------------------------------------------------------
do $$
begin
    if not exists (select 1 from information_schema.tables
                   where table_schema = 'public' and table_name = 'users') then
        raise exception 'public.users not found — wrong database?';
    end if;
    if not exists (select 1 from information_schema.tables
                   where table_schema = 'public' and table_name = 'package_tiers') then
        raise exception 'public.package_tiers not found — wrong database?';
    end if;
end $$;


-- =============================================================================
-- PHASE 1 — erase every existing policy in the public schema
--
-- Done by enumerating pg_policies rather than by name. 217 create statements
-- against 173 drops means the names never lined up; several policies in the
-- database are from migrations whose drop statement was spelled differently, and
-- some are simply not in teta.txt at all. Enumerating catches all of them.
-- =============================================================================
do $$
declare
    r record;
    dropped int := 0;
begin
    for r in
        select schemaname, tablename, policyname
        from pg_policies
        where schemaname = 'public'
    loop
        execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
        dropped := dropped + 1;
    end loop;
    raise notice 'PHASE 1: dropped % existing policies', dropped;
end $$;


-- =============================================================================
-- PHASE 2 — enable RLS on every table in public
--
-- ENABLE, deliberately not FORCE.
--
-- FORCE would subject the table owner to its own policies as well. That sounds
-- stricter and is the wrong choice here: there are seven SECURITY DEFINER
-- functions in this database (teta.txt lines 8961, 8971, 9251, 9270, 9908, 9921,
-- 9933), and a definer function executes as the function owner. Under FORCE it
-- would be filtered by policies written for end users and would start failing —
-- quota accounting and the match trigger among them.
--
-- Without FORCE the owner still bypasses RLS, but the owner is `postgres`, which
-- no client can authenticate as. anon and authenticated are fully governed
-- either way, and service_role carries BYPASSRLS regardless, which is what the
-- API routes depend on.
-- =============================================================================
do $$
declare
    r record;
    enabled int := 0;
begin
    for r in
        select c.relname
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relkind = 'r'
          and c.relname not like 'pg_%'
    loop
        execute format('alter table public.%I enable row level security', r.relname);
        enabled := enabled + 1;
    end loop;
    raise notice 'PHASE 2: RLS enabled on % tables', enabled;
end $$;


-- =============================================================================
-- PHASE 3 — default deny
--
-- Revoke the blanket table grants Supabase hands to anon and authenticated. RLS
-- alone is not enough: a table with RLS on and no policy denies reads, but the
-- grant still lets a caller probe columns and attempt writes. Revoking is the
-- belt to RLS's braces.
--
-- service_role keeps everything. That is the role every API route uses.
-- =============================================================================
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

-- Anything created later inherits the same posture.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

grant usage on schema public to anon, authenticated;


-- =============================================================================
-- PHASE 4 — the only reads the browser legitimately needs
--
-- Three groups, and nothing else:
--   (a) reference data that is public by nature
--   (b) the live room, which is a public broadcast
--   (c) the two tables Realtime pushes to a signed-in member, scoped to them
-- =============================================================================

-- (a) Reference data ----------------------------------------------------------
-- Package tiers and the gift catalogue are shown on the pricing page before
-- sign-in. They contain no personal data.
grant select on public.package_tiers to anon, authenticated;
create policy package_tiers_public_read on public.package_tiers
    for select to anon, authenticated using (true);

grant select on public.gift_catalog to anon, authenticated;
create policy gift_catalog_public_read on public.gift_catalog
    for select to anon, authenticated using (true);


-- (b) The live room -----------------------------------------------------------
-- A live stream is a broadcast; its comments and gifts are visible to everyone
-- watching. Writes still go through /api/live so tier gating and quotas apply.
grant select on public.live_streams to anon, authenticated;
create policy live_streams_public_read on public.live_streams
    for select to anon, authenticated using (coalesce(is_active, false) = true);

grant select on public.live_comments to authenticated;
create policy live_comments_read on public.live_comments
    for select to authenticated using (true);

grant select on public.live_gifts to authenticated;
create policy live_gifts_read on public.live_gifts
    for select to authenticated using (true);


-- (c) Realtime, scoped to the member ------------------------------------------
-- postgres_changes honours RLS, so a member only receives rows these policies
-- admit. Writes are not granted: a client able to insert a call signal could
-- inject an offer into somebody else's call.
--
-- IDENTITY IS MATCHED TWO WAYS, and this is not belt-and-braces — it is required.
-- Measured on the live database 9 Aug 2026: 148 profiles, 274 auth accounts, but
-- only 9 profiles have `auth_user_id` populated. The Supabase Auth cutover
-- instead made the profile's own `id` equal to the auth uid, which is true for
-- 129 of them. A policy keyed on auth_user_id alone would therefore have
-- delivered realtime to 9 members out of 148 and silently starved the rest —
-- they would have seen no incoming calls at all, with nothing in any log to say
-- why. Matching either linkage reaches 129; the remaining 19 have no auth
-- account and cannot sign in, so reaching them is neither possible nor wanted.
grant select on public.call_sessions to authenticated;
create policy call_sessions_participant_read on public.call_sessions
    for select to authenticated
    using (
        exists (
            select 1 from public.users u
            where (u.auth_user_id = auth.uid() or u.id = auth.uid())
              and u.id in (call_sessions.caller_id, call_sessions.receiver_id)
        )
    );

grant select on public.call_signals to authenticated;
create policy call_signals_participant_read on public.call_signals
    for select to authenticated
    using (
        exists (
            select 1 from public.users u
            where (u.auth_user_id = auth.uid() or u.id = auth.uid())
              and u.id in (call_signals.sender_id, call_signals.receiver_id)
        )
    );

-- users is referenced by the two policies above. Granting select on the whole
-- table would undo the point of this migration, so the grant is column-level:
-- enough for the subquery to resolve, nothing more. Notably NOT password_hash,
-- email or phone.
grant select (id, auth_user_id) on public.users to authenticated;
create policy users_self_identity_read on public.users
    for select to authenticated
    using (auth_user_id = auth.uid() or id = auth.uid());


-- =============================================================================
-- PHASE 5 — the three Critical "Security Definer View" findings
--
--   public.admin_seed_profile_audit
--   public.admin_legacy_user_repair_audit
--   public.admin_package_schema_audit
--
-- Nothing declared these SECURITY DEFINER; that is simply what a Postgres view
-- is by default. `security_invoker` is off, so the view runs as its owner
-- (postgres) and the caller's RLS never applies. All three aggregate over
-- public.users.
--
-- security_invoker = on makes them respect the caller. The revoke makes them
-- administrative, which is what they are — nothing in src/ queries them.
-- =============================================================================
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
        if exists (select 1 from pg_views where schemaname = 'public' and viewname = v) then
            execute format('alter view public.%I set (security_invoker = on)', v);
            execute format('revoke all on public.%I from anon, authenticated', v);
            raise notice 'PHASE 5: secured view public.%', v;
        end if;
    end loop;
end $$;


-- =============================================================================
-- PHASE 6 — Realtime
--
-- Publishing these moves call signalling and live chat onto a websocket that
-- connects straight to Supabase. That traffic does not pass through Vercel, so
-- it costs no edge requests — which matters because the 1,000,000/month free
-- tier is currently exhausted and the app falls back to HTTP polling without it.
--
-- Order matters and it is not cosmetic: this runs after Phases 2-4 deliberately.
-- Realtime honours RLS, but a published table with RLS *off* streams every row
-- to anyone holding the publishable key. Publishing call_signals before the
-- policies existed would have broadcast the SDP and ICE candidates of every call
-- in the system.
-- =============================================================================
do $$
declare
    t text;
begin
    foreach t in array array['call_signals', 'call_sessions', 'live_comments', 'live_gifts']
    loop
        if exists (select 1 from information_schema.tables
                   where table_schema = 'public' and table_name = t)
           and not exists (select 1 from pg_publication_tables
                           where pubname = 'supabase_realtime'
                             and schemaname = 'public' and tablename = t)
        then
            execute format('alter publication supabase_realtime add table public.%I', t);
            raise notice 'PHASE 6: published public.% to realtime', t;
        end if;
    end loop;
end $$;

-- UPDATE and DELETE events carry only the primary key unless replica identity is
-- full. The call pages read `status` off the changed row.
alter table public.call_sessions replica identity full;

commit;


-- =============================================================================
-- VERIFY — run these after the script and check each one
-- =============================================================================

-- 1. Every public table should have RLS on. Expect zero rows.
--
--   select c.relname
--   from pg_class c join pg_namespace n on n.oid = c.relnamespace
--   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

-- 2. The surviving policies — expect exactly the eight created above, no more.
--
--   select tablename, policyname, cmd, roles
--   from pg_policies where schemaname = 'public'
--   order by tablename, policyname;

-- 3. No `using (true)` should remain on a table holding personal data.
--
--   select tablename, policyname, qual
--   from pg_policies
--   where schemaname = 'public' and qual = 'true'
--   order by tablename;

-- 4. The audit views.
--
--   select c.relname, c.reloptions,
--          has_table_privilege('anon', c.oid, 'select') as anon_can_read
--   from pg_class c join pg_namespace n on n.oid = c.relnamespace
--   where n.nspname = 'public' and c.relkind = 'v'
--     and c.relname like 'admin_%_audit';

-- 5. Realtime publication.
--
--   select tablename from pg_publication_tables
--   where pubname = 'supabase_realtime' and schemaname = 'public'
--   order by tablename;

-- 6. Then, from the project directory, prove it from outside the database:
--
--     node scripts/audit-rls-exposure.mjs
--
--   Every sensitive table must report "locked". Before this migration it
--   reported 17 tables and 3,731 rows exposed.
