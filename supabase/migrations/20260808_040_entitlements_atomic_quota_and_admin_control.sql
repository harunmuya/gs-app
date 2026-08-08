-- Membership entitlements: make limits real, and make the admin panel control them.
--
-- Three problems this fixes.
--
-- 1. The admin panel controlled nothing.
--    "Ads & Limits" writes a single global row to `app_limits`. Enforcement reads
--    per-tier columns from `package_tiers`. Nothing ever read `app_limits` to make
--    a decision, so every limit an administrator set was ignored. On top of that
--    `package_tiers` only carried 5 of the ~20 entitlement fields the application
--    actually uses, and had no `free` row at all — so most entitlements were
--    unreachable from the database even in principle.
--
-- 2. Daily limits could be exceeded by racing.
--    The application did SELECT count -> compare -> UPDATE. Two concurrent
--    requests both read 4, both saw 4 < 5, and both wrote 5. On a paid quota that
--    is a bypass, and it needs no tooling — just a fast double tap.
--
-- 3. A database error granted unlimited access.
--    A missing table or any query error returned "allowed" and skipped counting.
--    The safest-looking branch was the one that gave paid features away.
--
-- Semantics preserved deliberately: for a limit column, 0 or NULL means unlimited
-- and a positive number is the cap. That is what the existing rows already mean
-- (silver/gold carry 0 for unlimited messaging), so redefining 0 as "blocked"
-- would have silently cut off paying members. Blocking is expressed by the
-- boolean feature flags instead.
--
-- Safe to re-run.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Give package_tiers the full entitlement surface the app already reads.
-- ---------------------------------------------------------------------------
ALTER TABLE public.package_tiers ADD COLUMN IF NOT EXISTS daily_like_limit INTEGER DEFAULT 0;
ALTER TABLE public.package_tiers ADD COLUMN IF NOT EXISTS daily_super_like_limit INTEGER DEFAULT 0;
ALTER TABLE public.package_tiers ADD COLUMN IF NOT EXISTS daily_swipe_limit INTEGER DEFAULT 0;
ALTER TABLE public.package_tiers ADD COLUMN IF NOT EXISTS daily_profile_view_limit INTEGER DEFAULT 0;
ALTER TABLE public.package_tiers ADD COLUMN IF NOT EXISTS can_see_who_liked BOOLEAN DEFAULT false;
ALTER TABLE public.package_tiers ADD COLUMN IF NOT EXISTS can_see_who_viewed BOOLEAN DEFAULT false;
ALTER TABLE public.package_tiers ADD COLUMN IF NOT EXISTS can_send_voice_notes BOOLEAN DEFAULT false;
ALTER TABLE public.package_tiers ADD COLUMN IF NOT EXISTS can_send_images BOOLEAN DEFAULT false;
ALTER TABLE public.package_tiers ADD COLUMN IF NOT EXISTS can_go_live BOOLEAN DEFAULT false;
ALTER TABLE public.package_tiers ADD COLUMN IF NOT EXISTS can_send_gifts BOOLEAN DEFAULT false;
ALTER TABLE public.package_tiers ADD COLUMN IF NOT EXISTS can_use_nearby BOOLEAN DEFAULT false;
ALTER TABLE public.package_tiers ADD COLUMN IF NOT EXISTS max_gift_tier INTEGER DEFAULT 0;
ALTER TABLE public.package_tiers ADD COLUMN IF NOT EXISTS starting_credits INTEGER DEFAULT 0;
ALTER TABLE public.package_tiers ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.package_tiers ADD COLUMN IF NOT EXISTS tagline TEXT DEFAULT '';

-- These two are in the original CREATE TABLE, but not in every deployment: the
-- live database is missing `is_active`, which made /api/packages fail with
-- "column package_tiers.is_active does not exist". The route caught that error
-- and silently served hardcoded defaults, so the pricing page showed built-in
-- numbers while enforcement used the real rows. Adding them here so the schema
-- matches what the code expects.
ALTER TABLE public.package_tiers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.package_tiers ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
UPDATE public.package_tiers SET is_active = true WHERE is_active IS NULL;

-- ---------------------------------------------------------------------------
-- 2. Seed every tier, including `free`, which had no row.
--    Values mirror DEFAULT_TIERS in src/lib/packageAccess.js so behaviour does
--    not change on the day this runs; the point is that they are now editable.
--    Existing rows keep their configured price and name.
-- ---------------------------------------------------------------------------
INSERT INTO public.package_tiers (
    id, name, tagline, price_ksh, phone_reveal,
    daily_message_limit, daily_gift_limit, daily_like_limit, daily_super_like_limit,
    daily_swipe_limit, daily_profile_view_limit,
    priority_visibility, international_access, voice_video_access,
    can_see_who_liked, can_see_who_viewed, can_send_voice_notes, can_send_images,
    can_go_live, can_send_gifts, can_use_nearby,
    max_gift_tier, starting_credits, is_active, sort_order
) VALUES
    ('free',   'Free',               'Browse and get started',        0,    false, 5,  0,  5,   0,   10, 10, false, false, false, false, false, false, false, false, false, false, 0, 0,   true, 0),
    ('basic',  'Basic',              'Message and send gifts',        650,  false, 0,  10, 20,  5,   30, 30, false, false, false, false, false, false, true,  false, true,  false, 1, 50,  true, 1),
    ('silver', 'Silver Recommended', 'Unlock phone numbers and calls',1200, true,  0,  50, 50,  100, 0,  0,  true,  false, true,  true,  true,  true,  true,  true,  true,  true,  3, 200, true, 2),
    ('gold',   'Gold International', 'Everything, no limits',         3550, true,  0,  0,  0,   0,   0,  0,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  4, 500, true, 3)
ON CONFLICT (id) DO UPDATE SET
    -- Only fill columns that are new or unset. An administrator's existing
    -- pricing and naming must survive this migration.
    tagline = COALESCE(NULLIF(public.package_tiers.tagline, ''), EXCLUDED.tagline),
    daily_like_limit = COALESCE(public.package_tiers.daily_like_limit, EXCLUDED.daily_like_limit),
    daily_super_like_limit = COALESCE(public.package_tiers.daily_super_like_limit, EXCLUDED.daily_super_like_limit),
    daily_swipe_limit = COALESCE(public.package_tiers.daily_swipe_limit, EXCLUDED.daily_swipe_limit),
    daily_profile_view_limit = COALESCE(public.package_tiers.daily_profile_view_limit, EXCLUDED.daily_profile_view_limit),
    can_see_who_liked = COALESCE(public.package_tiers.can_see_who_liked, EXCLUDED.can_see_who_liked),
    can_see_who_viewed = COALESCE(public.package_tiers.can_see_who_viewed, EXCLUDED.can_see_who_viewed),
    can_send_voice_notes = COALESCE(public.package_tiers.can_send_voice_notes, EXCLUDED.can_send_voice_notes),
    can_send_images = COALESCE(public.package_tiers.can_send_images, EXCLUDED.can_send_images),
    can_go_live = COALESCE(public.package_tiers.can_go_live, EXCLUDED.can_go_live),
    can_send_gifts = COALESCE(public.package_tiers.can_send_gifts, EXCLUDED.can_send_gifts),
    can_use_nearby = COALESCE(public.package_tiers.can_use_nearby, EXCLUDED.can_use_nearby),
    max_gift_tier = COALESCE(public.package_tiers.max_gift_tier, EXCLUDED.max_gift_tier),
    starting_credits = COALESCE(public.package_tiers.starting_credits, EXCLUDED.starting_credits),
    updated_at = now();

-- ---------------------------------------------------------------------------
-- 3. Atomic quota consumption.
--
--    The whole decision happens in one statement. INSERT .. ON CONFLICT DO UPDATE
--    with a WHERE guard either increments the counter or does nothing, and the
--    row is locked for the duration, so two concurrent callers cannot both pass
--    the same final unit. RETURNING tells us which happened.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_daily_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
    kind TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, usage_date, kind)
);

CREATE OR REPLACE FUNCTION public.consume_daily_quota(
    p_user_id UUID,
    p_kind TEXT,
    p_limit INTEGER
)
RETURNS TABLE(allowed BOOLEAN, used INTEGER, quota INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_used INTEGER;
BEGIN
    -- 0 or NULL means unlimited, matching the existing column semantics.
    IF p_limit IS NULL OR p_limit <= 0 THEN
        RETURN QUERY SELECT true, 0, 0;
        RETURN;
    END IF;

    INSERT INTO public.user_daily_usage AS u (user_id, usage_date, kind, count)
    VALUES (p_user_id, CURRENT_DATE, p_kind, 1)
    ON CONFLICT (user_id, usage_date, kind) DO UPDATE
        SET count = u.count + 1, updated_at = now()
        WHERE u.count < p_limit
    RETURNING u.count INTO v_used;

    IF v_used IS NULL THEN
        -- The guard blocked the update: already at or over the cap.
        SELECT u.count INTO v_used
        FROM public.user_daily_usage u
        WHERE u.user_id = p_user_id AND u.usage_date = CURRENT_DATE AND u.kind = p_kind;
        RETURN QUERY SELECT false, COALESCE(v_used, p_limit), p_limit;
    ELSE
        RETURN QUERY SELECT true, v_used, p_limit;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_daily_quota(UUID, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_daily_quota(UUID, TEXT, INTEGER) TO service_role;

-- Read-only view of today's usage, for showing members what they have left.
CREATE OR REPLACE FUNCTION public.peek_daily_quota(p_user_id UUID, p_kind TEXT)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        (SELECT count FROM public.user_daily_usage
         WHERE user_id = p_user_id AND usage_date = CURRENT_DATE AND kind = p_kind),
        0);
$$;

REVOKE ALL ON FUNCTION public.peek_daily_quota(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.peek_daily_quota(UUID, TEXT) TO service_role;

COMMIT;

-- Verification:
--
--   SELECT id, name, price_ksh, daily_message_limit, daily_like_limit,
--          can_send_gifts, phone_reveal
--   FROM public.package_tiers ORDER BY sort_order;      -- 4 rows, free included
--
--   SELECT * FROM public.consume_daily_quota(
--     '<a real user uuid>'::uuid, 'likes', 3);          -- allowed=t used=1 quota=3
--   -- run it four times: the fourth returns allowed=f used=3 quota=3
--
-- NOTE: `app_limits` is now unused by enforcement. It is left in place rather
-- than dropped so nothing breaks if something still reads it, but the admin
-- panel no longer writes entitlement values there.
