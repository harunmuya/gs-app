-- Blocking and reporting.
--
-- The app had neither. The only way to get away from somebody was to message
-- Admin Mary on Telegram and wait, and the only "report" in the product was a
-- line of copy telling members to do exactly that. For a dating app that is a
-- safety hole before it is anything else, and Google Play's user-generated
-- content policy requires an in-app way to block a user and report content.
--
-- Two tables, deliberately separate:
--
--   user_blocks  is the member's own decision and takes effect immediately. It
--                needs no review, and nobody is told they were blocked.
--   user_reports is a message to the administrators. It changes nothing on its
--                own; somebody reads it and decides.
--
-- Blocking is one-directional as a record (who blocked whom, so it can be
-- undone by the right person) but is enforced both ways: a blocked member must
-- not see the blocker either, or blocking someone merely hides them from you
-- while leaving you visible to them.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.user_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- One row per pair, so blocking twice is not an error and unblocking
    -- cannot leave a second row behind still hiding the person.
    CONSTRAINT user_blocks_unique_pair UNIQUE (blocker_id, blocked_id),
    -- Blocking yourself would hide you from your own listings.
    CONSTRAINT user_blocks_not_self CHECK (blocker_id <> blocked_id)
);

CREATE TABLE IF NOT EXISTS public.user_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    reported_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL DEFAULT 'other',
    detail TEXT NOT NULL DEFAULT '',
    -- open -> reviewing -> actioned | dismissed
    status TEXT NOT NULL DEFAULT 'open',
    admin_note TEXT NOT NULL DEFAULT '',
    reviewed_by TEXT NOT NULL DEFAULT '',
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT user_reports_not_self CHECK (reporter_id IS NULL OR reporter_id <> reported_id)
);

-- reporter_id survives the reporter deleting their account (ON DELETE SET NULL)
-- so a report under review does not vanish mid-investigation.

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON public.user_blocks(blocker_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON public.user_blocks(blocked_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_status ON public.user_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_reports_reported ON public.user_reports(reported_id, created_at DESC);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

-- Every read and write goes through the server with the service role, as with
-- the rest of this schema; no anon policy is granted.
DROP POLICY IF EXISTS "service role manages user_blocks" ON public.user_blocks;
CREATE POLICY "service role manages user_blocks" ON public.user_blocks FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service role manages user_reports" ON public.user_reports;
CREATE POLICY "service role manages user_reports" ON public.user_reports FOR ALL USING (true) WITH CHECK (true);
