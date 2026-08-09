-- Make likes, swipes and matches real.
--
-- Two problems, both silent.
--
-- 1. `user_interactions` does not exist in this database, yet `recordInteraction`
--    in api/members writes every like, super like, pass, save and profile view to
--    it. The call is wrapped in try/catch, but the Supabase client returns an
--    error object rather than throwing — so the failure was ignored twice over.
--    Members have been spending their daily like quota (user_daily_usage has 138
--    rows) on likes that were never stored anywhere.
--
-- 2. `matches` is not matches. Its columns are
--       user_id, profile_wp_id, profile_name, profile_image, score, seen
--    — one-sided stored recommendations against WordPress profile ids. There is
--    no second member and no reciprocity, so the product had no concept of mutual
--    interest at all. `member_likes` has the right columns
--    (liker_id, liked_id) and zero rows, because nothing wrote to it.
--
-- CORRECTION, 9 Aug 2026: an earlier version of this comment said member_likes
-- already carried a UNIQUE on (liker_id, liked_id). It does not, and that was
-- never verified. recordMemberLike upserts on that pair, so the write fails with
-- "no unique or exclusion constraint matching the ON CONFLICT specification" and
-- the trigger below never fires. 20260809_010 adds the missing constraint; run it
-- alongside this migration.
--
-- This creates the missing interaction table, and makes a match what the word
-- means: both people liked each other.
--
-- Safe to re-run.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The interaction ledger the application already expects.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    -- Free-form so it can address a member ("member:<uuid>"), a seeded profile
    -- ("seed-local-004") or a WordPress import ("wp-123").
    profile_key TEXT NOT NULL,
    action TEXT NOT NULL,
    profile_name TEXT DEFAULT '',
    profile_image TEXT DEFAULT '',
    is_super_like BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    -- Matches the onConflict target the application already passes.
    UNIQUE (user_id, profile_key, action)
);

CREATE INDEX IF NOT EXISTS idx_user_interactions_user ON public.user_interactions (user_id, action, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_interactions_profile ON public.user_interactions (profile_key, action);

ALTER TABLE public.user_interactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner reads own interactions" ON public.user_interactions;
CREATE POLICY "Owner reads own interactions"
ON public.user_interactions FOR SELECT
USING (user_id = public.current_member_id());

-- ---------------------------------------------------------------------------
-- 2. Mutual matches.
--
-- Stored once per pair with the ids ordered, so (A,B) and (B,A) cannot both
-- exist and "are these two matched" is a single indexed lookup.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.member_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- user_low < user_high, enforced by the trigger below.
    user_low UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    user_high UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    is_super_match BOOLEAN DEFAULT false,
    seen_by_low BOOLEAN DEFAULT false,
    seen_by_high BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_low, user_high),
    CONSTRAINT member_matches_ordered CHECK (user_low < user_high)
);

CREATE INDEX IF NOT EXISTS idx_member_matches_low ON public.member_matches (user_low, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_member_matches_high ON public.member_matches (user_high, created_at DESC);

ALTER TABLE public.member_matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Participants read matches" ON public.member_matches;
CREATE POLICY "Participants read matches"
ON public.member_matches FOR SELECT
USING (
    user_low = public.current_member_id()
    OR user_high = public.current_member_id()
);

ALTER TABLE public.member_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members read likes involving them" ON public.member_likes;
CREATE POLICY "Members read likes involving them"
ON public.member_likes FOR SELECT
USING (
    liker_id = public.current_member_id()
    OR liked_id = public.current_member_id()
);

-- ---------------------------------------------------------------------------
-- 3. A like that is returned becomes a match, in the database rather than in
--    application code — so it holds however the like was created, including
--    admin tooling and future clients.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_member_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    reciprocal RECORD;
    low_id UUID;
    high_id UUID;
    both_super BOOLEAN;
BEGIN
    -- Nobody matches with themselves.
    IF NEW.liker_id = NEW.liked_id THEN
        RETURN NEW;
    END IF;

    SELECT * INTO reciprocal
    FROM public.member_likes
    WHERE liker_id = NEW.liked_id AND liked_id = NEW.liker_id;

    IF NOT FOUND THEN
        -- One-sided so far. Tell the recipient someone liked them.
        BEGIN
            INSERT INTO public.user_notifications (user_id, type, title, body)
            VALUES (
                NEW.liked_id,
                'like',
                CASE WHEN NEW.is_super_like THEN 'Someone super liked you' ELSE 'Someone liked you' END,
                'Open your likes to see who it was.'
            );
        EXCEPTION WHEN OTHERS THEN
            NULL;  -- a missing notification must not block the like
        END;
        RETURN NEW;
    END IF;

    low_id := LEAST(NEW.liker_id, NEW.liked_id);
    high_id := GREATEST(NEW.liker_id, NEW.liked_id);
    both_super := COALESCE(NEW.is_super_like, false) OR COALESCE(reciprocal.is_super_like, false);

    INSERT INTO public.member_matches (user_low, user_high, is_super_match)
    VALUES (low_id, high_id, both_super)
    ON CONFLICT (user_low, user_high) DO NOTHING;

    -- Both sides hear about it.
    BEGIN
        INSERT INTO public.user_notifications (user_id, type, title, body)
        VALUES
            (NEW.liker_id, 'match', 'It''s a match', 'You both liked each other. Start a conversation.'),
            (NEW.liked_id, 'match', 'It''s a match', 'You both liked each other. Start a conversation.');
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_member_like_match ON public.member_likes;
CREATE TRIGGER trg_member_like_match
    AFTER INSERT ON public.member_likes
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_member_like();

-- Unliking removes the match; a match should not outlive the interest.
CREATE OR REPLACE FUNCTION public.handle_member_unlike()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.member_matches
    WHERE user_low = LEAST(OLD.liker_id, OLD.liked_id)
      AND user_high = GREATEST(OLD.liker_id, OLD.liked_id);
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_member_unlike_match ON public.member_likes;
CREATE TRIGGER trg_member_unlike_match
    AFTER DELETE ON public.member_likes
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_member_unlike();

-- ---------------------------------------------------------------------------
-- 4. The legacy `matches` table keeps its 716 rows. It holds saved WordPress
--    recommendations, which is a different thing from a mutual match, and
--    deleting it is not this migration's business. New reciprocal matches go to
--    member_matches.
-- ---------------------------------------------------------------------------

COMMIT;

-- Verification:
--
--   -- a one-sided like: no match, one notification to the recipient
--   INSERT INTO member_likes (liker_id, liked_id) VALUES ('<A>', '<B>');
--   SELECT count(*) FROM member_matches;                  -- 0
--
--   -- returned: a match appears and both are notified
--   INSERT INTO member_likes (liker_id, liked_id) VALUES ('<B>', '<A>');
--   SELECT * FROM member_matches;                          -- 1 row, ordered ids
--   SELECT user_id, title FROM user_notifications ORDER BY created_at DESC LIMIT 2;
--
--   -- withdrawing a like removes the match
--   DELETE FROM member_likes WHERE liker_id = '<B>' AND liked_id = '<A>';
--   SELECT count(*) FROM member_matches;                  -- 0
