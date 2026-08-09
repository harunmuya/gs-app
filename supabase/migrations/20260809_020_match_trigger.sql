-- The match trigger, corrected.
--
-- Run this INSTEAD of 20260808_070. Do not run 070 as well: see below.
--
-- =============================================================================
-- WHY NOT JUST RUN 070
-- =============================================================================
--
-- Two problems, both introduced by me, both caught before this ran.
--
-- 1. A COLUMN MY OWN MIGRATION LEFT OUT.
--    20260809_010 creates member_matches with (id, user_low, user_high,
--    created_at). 070's table definition also has is_super_match, and its
--    trigger inserts into it. Because 010 has already run, 070's
--    CREATE TABLE IF NOT EXISTS is a no-op and the column never appears, so the
--    trigger would fail on every mutual like with "column is_super_match does
--    not exist". Verified against the live table: the column is missing.
--
-- 2. DOUBLE NOTIFICATIONS.
--    070's trigger inserts into user_notifications for both a one-sided like
--    and a match. recordMemberLike in api/members now does the same through
--    notifyMember, which additionally sends the email. Running both means every
--    like produces two in-app notifications, one of which has no email and no
--    action link.
--
--    The application layer wins. It knows the member's name, whether they are
--    currently active, and how to reach their inbox; a database trigger knows
--    none of that. So the trigger here does one thing: keep member_matches in
--    step with member_likes.
--
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. The column 20260809_010 omitted.
-- ---------------------------------------------------------------------------
alter table public.member_matches
    add column if not exists is_super_match boolean default false;

-- ---------------------------------------------------------------------------
-- 2. A returned like becomes a match.
-- ---------------------------------------------------------------------------
-- In the database rather than in application code, so it holds however the like
-- was created: the app, admin tooling, a future client, or a manual insert.
--
-- SECURITY DEFINER because member_likes and member_matches both have RLS
-- enabled and the trigger must write regardless of who caused the like. Its
-- search_path is pinned, which is what stops a definer function being hijacked
-- by a caller-controlled schema.
create or replace function public.handle_member_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    reciprocal record;
begin
    -- Nobody matches with themselves.
    if new.liker_id = new.liked_id then
        return new;
    end if;

    select * into reciprocal
    from public.member_likes
    where liker_id = new.liked_id and liked_id = new.liker_id;

    -- One sided so far. Notifying is the application's job; see the header.
    if not found then
        return new;
    end if;

    insert into public.member_matches (user_low, user_high, is_super_match)
    values (
        least(new.liker_id, new.liked_id),
        greatest(new.liker_id, new.liked_id),
        coalesce(new.is_super_like, false) or coalesce(reciprocal.is_super_like, false)
    )
    on conflict (user_low, user_high) do nothing;

    return new;
end;
$$;

drop trigger if exists trg_member_like_match on public.member_likes;
create trigger trg_member_like_match
    after insert on public.member_likes
    for each row
    execute function public.handle_member_like();

-- An upsert that turns a like into a super like fires UPDATE, not INSERT, so the
-- match is created on the first insert and this keeps its super flag current.
drop trigger if exists trg_member_like_match_update on public.member_likes;
create trigger trg_member_like_match_update
    after update on public.member_likes
    for each row
    execute function public.handle_member_like();

-- ---------------------------------------------------------------------------
-- 3. Unliking removes the match.
-- ---------------------------------------------------------------------------
-- A match should not outlive the interest that created it.
create or replace function public.handle_member_unlike()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    delete from public.member_matches
    where user_low = least(old.liker_id, old.liked_id)
      and user_high = greatest(old.liker_id, old.liked_id);
    return old;
end;
$$;

drop trigger if exists trg_member_unlike_match on public.member_likes;
create trigger trg_member_unlike_match
    after delete on public.member_likes
    for each row
    execute function public.handle_member_unlike();

commit;


-- =============================================================================
-- VERIFY
-- =============================================================================
--
--   node scripts/verify-swipe-persistence.mjs
--
-- Expect 7 passed, 0 failed. Before this migration the match check fails with
-- "the trigger from 070 has not been created".
--
-- Triggers present:
--
--   select tgname from pg_trigger
--   where tgrelid = 'public.member_likes'::regclass and not tgisinternal;
