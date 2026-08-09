-- Let an existing match pick up the super flag.
--
-- 20260809_020 added an AFTER UPDATE trigger so that upgrading a like to a super
-- like would mark the match super. It does not work, because the statement it
-- runs is:
--
--     insert into public.member_matches (...) values (...)
--     on conflict (user_low, user_high) do nothing;
--
-- The match already exists by then, so DO NOTHING is exactly what happens and
-- is_super_match keeps its original value. The trigger fires; the write is
-- discarded.
--
-- Caught by scripts/verify-match-reciprocity.mjs, which reported the one-sided
-- and reciprocal cases correct and this one wrong.
--
-- DO UPDATE recomputes the flag from both sides on every like change, so it
-- rises when either person super likes and falls again if that is withdrawn.
-- Matching the flag to the current state of both likes is the only version that
-- stays correct over time; a one-way upgrade would leave a match permanently
-- marked super after the super like was taken back.

begin;

create or replace function public.handle_member_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    reciprocal record;
begin
    if new.liker_id = new.liked_id then
        return new;
    end if;

    select * into reciprocal
    from public.member_likes
    where liker_id = new.liked_id and liked_id = new.liker_id;

    -- One sided so far. Notifying is the application's job; see 20260809_020.
    if not found then
        return new;
    end if;

    insert into public.member_matches (user_low, user_high, is_super_match)
    values (
        least(new.liker_id, new.liked_id),
        greatest(new.liker_id, new.liked_id),
        coalesce(new.is_super_like, false) or coalesce(reciprocal.is_super_like, false)
    )
    on conflict (user_low, user_high) do update
        set is_super_match = excluded.is_super_match;

    return new;
end;
$$;

commit;

-- Verify:
--   node scripts/verify-match-reciprocity.mjs
-- Expect 6 passed, 0 failed.
