-- SUPERSEDED by 20260809_000_consolidated_security_reset.sql — DO NOT RUN.
--
-- fully absorbed, and the reset drops policies by enumeration rather than by name.
-- Running this after the reset would layer a superseded rule set back on top.
-- Kept for the reasoning in its comments only.
--
-- Everything below is disabled.
/*
-- CRITICAL — close public read access to member data.
--
-- Verified against the live database on 2026-08-08 using the anon key, which is
-- embedded in the browser bundle and is public by design. An unauthenticated
-- client could read, in full:
--
--     messages             967 rows, including message content
--     conversations        939 rows
--     users                148 rows, including email addresses
--     user_notifications   381 rows
--     notifications        628 rows
--     matches              716 rows
--     profile_views        164 rows
--     package_requests     payment references
--     user_daily_usage     138 rows
--
-- Anyone who opened devtools, copied the key, and issued one PostgREST request
-- could dump the lot. Private conversations and member emails were effectively
-- published.
--
-- Root cause: these tables were created without RLS, and the application worked
-- because every server route uses the service role — which bypasses RLS and
-- therefore never surfaced the gap.
--
-- Note on 20260808_010: that migration wrote messaging policies for
-- `direct_conversations` / `direct_messages`. Those tables are dormant — last
-- write 5 July — while the live traffic is in `conversations` / `messages`, which
-- it did not cover. This migration secures the tables actually in use and locks
-- the dormant pair as well.
--
-- Server routes are unaffected: they authenticate with the service role.
--
-- Safe to re-run.

BEGIN;

-- ---------------------------------------------------------------------------
-- Helper: the caller's member id, or NULL when unauthenticated.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_member_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT u.id
    FROM public.users u
    WHERE auth.uid() IS NOT NULL
      AND (u.auth_user_id = auth.uid() OR u.id = auth.uid())
    LIMIT 1;
$$;

-- ---------------------------------------------------------------------------
-- Messaging — the live pair.
-- `conversations` is one-sided: it has user_id (the owner) and match_* columns.
-- `messages` hangs off conversation_id and carries sender_id.
-- ---------------------------------------------------------------------------
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner reads conversations" ON public.conversations;
CREATE POLICY "Owner reads conversations"
ON public.conversations FOR SELECT
USING (user_id = public.current_member_id());

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Participants read messages" ON public.messages;
CREATE POLICY "Participants read messages"
ON public.messages FOR SELECT
USING (
    sender_id = public.current_member_id()
    OR EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = messages.conversation_id
          AND c.user_id = public.current_member_id()
    )
);

-- Dormant pair. No policy at all: RLS on with no SELECT policy denies everyone
-- except the service role, which is correct for tables nothing reads any more.
ALTER TABLE public.direct_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own conversations" ON public.direct_conversations;
DROP POLICY IF EXISTS "Users can read own direct messages" ON public.direct_messages;
DROP POLICY IF EXISTS "Users can insert own direct messages" ON public.direct_messages;

-- ---------------------------------------------------------------------------
-- Notifications — both tables. `notifications` is dormant (last write 7 July)
-- but still held 628 readable rows.
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner reads notifications" ON public.user_notifications;
CREATE POLICY "Owner reads notifications"
ON public.user_notifications FOR SELECT
USING (user_id = public.current_member_id());

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Owner reads legacy notifications" ON public.notifications;
CREATE POLICY "Owner reads legacy notifications"
ON public.notifications FOR SELECT
USING (user_id = public.current_member_id());

-- ---------------------------------------------------------------------------
-- Personal activity.
-- ---------------------------------------------------------------------------
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner reads matches" ON public.matches;
CREATE POLICY "Owner reads matches"
ON public.matches FOR SELECT
USING (user_id = public.current_member_id());

ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Subject and viewer read profile views" ON public.profile_views;
CREATE POLICY "Subject and viewer read profile views"
ON public.profile_views FOR SELECT
USING (
    viewed_id = public.current_member_id()
    OR viewer_id = public.current_member_id()
);

ALTER TABLE public.user_daily_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner reads own usage" ON public.user_daily_usage;
CREATE POLICY "Owner reads own usage"
ON public.user_daily_usage FOR SELECT
USING (user_id = public.current_member_id());

-- Payments carry references and amounts.
ALTER TABLE public.package_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner reads own package requests" ON public.package_requests;
CREATE POLICY "Owner reads own package requests"
ON public.package_requests FOR SELECT
USING (user_id = public.current_member_id());

-- Wallets, if present.
DO $$
BEGIN
    IF to_regclass('public.wallet_transactions') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "Owner reads own wallet" ON public.wallet_transactions';
        EXECUTE 'CREATE POLICY "Owner reads own wallet" ON public.wallet_transactions
                 FOR SELECT USING (user_id = public.current_member_id())';
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- users: discovery needs public reads, but not of contact details.
--
-- RLS is row-level, so hiding a column needs a column privilege. Discovery
-- legitimately reads names, photos and locations; email and phone are not
-- discovery data and were being served to anyone.
-- ---------------------------------------------------------------------------
REVOKE SELECT (email) ON public.users FROM anon;
REVOKE SELECT (password_hash) ON public.users FROM anon, authenticated;

DO $$
DECLARE
    col TEXT;
BEGIN
    FOREACH col IN ARRAY ARRAY['phone', 'phone_number', 'verification_phone',
                               'verification_selfie_url', 'verification_document_url']
    LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'users' AND column_name = col
        ) THEN
            EXECUTE format('REVOKE SELECT (%I) ON public.users FROM anon', col);
        END IF;
    END LOOP;
END $$;

COMMIT;

-- ---------------------------------------------------------------------------
-- Verification — run with the ANON key, not the service role. Every one of these
-- must return zero rows or an error:
--
--   select * from messages limit 1;
--   select * from conversations limit 1;
--   select * from user_notifications limit 1;
--   select * from matches limit 1;
--   select * from profile_views limit 1;
--   select * from package_requests limit 1;
--   select email from users limit 1;          -- must fail: column privilege
--   select display_name from users limit 1;   -- must still work: discovery
--
-- Then confirm the app still functions while signed in: messages, alerts,
-- matches and the packages page all read through server routes using the service
-- role, so they are unaffected — but verify rather than assume.

*/
