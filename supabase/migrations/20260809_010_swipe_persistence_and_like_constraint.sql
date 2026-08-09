-- Make swipes, likes and matches persist.
--
-- Run this after 20260809_000_consolidated_security_reset.sql.
--
-- =============================================================================
-- WHAT IS BROKEN, MEASURED ON THE LIVE DATABASE 9 Aug 2026
-- =============================================================================
--
-- Three writes fail on every swipe, and all three fail silently:
--
--   member_likes upsert
--     "there is no unique or exclusion constraint matching the ON CONFLICT
--      specification"
--     recordMemberLike upserts on (liker_id, liked_id). That constraint does not
--     exist, so every like is rejected. member_likes holds 0 rows.
--
--   member_matches
--     "Could not find the table 'public.member_matches'"
--     So a mutual like can never become a match.
--
--   user_interactions
--     "Could not find the table 'public.user_interactions'"
--     Every pass, swipe, save and profile view is discarded.
--
-- The visible symptom is the one that gets reported: the discover deck shows the
-- same profiles again after every reload, because nothing recorded that they were
-- already swiped. Local storage hides it within a session; the moment the app
-- reloads, or the member opens it on another device, the deck resets.
--
-- Meanwhile user_daily_usage holds 138 rows including 31 swipes and 26 likes, so
-- members have been spending real daily quota on likes that were stored nowhere.
--
-- =============================================================================
-- A CORRECTION TO 20260808_070
-- =============================================================================
--
-- That migration's header states member_likes "already had the right shape
-- (liker_id, liked_id, UNIQUE)". It does not. The columns are right; the unique
-- constraint was never created. 070 therefore builds the tables and the trigger
-- correctly but leaves the upsert failing, so no like is ever written and the
-- trigger never fires. This migration adds the constraint 070 assumed.
--
-- Run both. This one is safe to run before or after 070.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. The missing unique constraint on member_likes.
-- ---------------------------------------------------------------------------
-- Deduplicate first. The table is empty today, but this makes the migration
-- safe to run against a database where likes have since accumulated.
delete from public.member_likes a
using public.member_likes b
where a.liker_id = b.liker_id
  and a.liked_id = b.liked_id
  and a.ctid > b.ctid;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conrelid = 'public.member_likes'::regclass
          and contype = 'u'
          and conkey @> array[
              (select attnum from pg_attribute where attrelid = 'public.member_likes'::regclass and attname = 'liker_id'),
              (select attnum from pg_attribute where attrelid = 'public.member_likes'::regclass and attname = 'liked_id')
          ]::smallint[]
    ) then
        alter table public.member_likes
            add constraint member_likes_liker_liked_key unique (liker_id, liked_id);
        raise notice 'added unique (liker_id, liked_id) to member_likes';
    else
        raise notice 'member_likes already has the unique constraint';
    end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. user_interactions, if 070 has not run yet.
-- ---------------------------------------------------------------------------
-- This is what stops the deck repeating: every pass and swipe is recorded here,
-- and api/members reads it back into the client on load.
create table if not exists public.user_interactions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.users(id) on delete cascade,
    profile_key text not null,
    action text not null,
    profile_name text,
    profile_image text,
    is_super_like boolean default false,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    unique (user_id, profile_key, action)
);

create index if not exists idx_user_interactions_user
    on public.user_interactions (user_id, action, updated_at desc);
create index if not exists idx_user_interactions_profile
    on public.user_interactions (profile_key);

-- ---------------------------------------------------------------------------
-- 3. member_matches, if 070 has not run yet.
-- ---------------------------------------------------------------------------
create table if not exists public.member_matches (
    id uuid primary key default gen_random_uuid(),
    user_low uuid not null references public.users(id) on delete cascade,
    user_high uuid not null references public.users(id) on delete cascade,
    created_at timestamptz default now(),
    unique (user_low, user_high),
    constraint member_matches_ordered check (user_low < user_high)
);

create index if not exists idx_member_matches_low on public.member_matches (user_low, created_at desc);
create index if not exists idx_member_matches_high on public.member_matches (user_high, created_at desc);

-- ---------------------------------------------------------------------------
-- 4. RLS, consistent with the consolidated reset.
-- ---------------------------------------------------------------------------
-- The reset default-denies anon and authenticated and revokes their grants.
-- These tables are read by API routes on the service role, which bypasses RLS,
-- so no grant is restored here. RLS is enabled so the tables are not an
-- exception to the posture the reset established.
alter table public.user_interactions enable row level security;
alter table public.member_matches enable row level security;
alter table public.member_likes enable row level security;

commit;


-- =============================================================================
-- VERIFY
-- =============================================================================
--
-- 1. The constraint exists:
--
--   select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--   where conrelid = 'public.member_likes'::regclass and contype = 'u';
--
-- 2. Both tables exist:
--
--   select table_name from information_schema.tables
--   where table_schema = 'public'
--     and table_name in ('user_interactions', 'member_matches');
--
-- 3. Then from the project directory, prove the writes now succeed:
--
--     node scripts/verify-swipe-persistence.mjs
--
--   It performs a like, a pass and a mutual like against real rows and deletes
--   everything it created. Before this migration all three fail.
