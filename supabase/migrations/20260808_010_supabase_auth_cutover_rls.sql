-- SUPERSEDED by 20260809_000_consolidated_security_reset.sql — DO NOT RUN.
--
-- its RLS targeted direct_conversations/direct_messages, which are dormant.
-- Running this after the reset would layer a superseded rule set back on top.
-- Kept for the reasoning in its comments only.
--
-- Everything below is disabled.
/*
-- Supabase Auth cutover — Wave 1.
--
-- Context: public.users rows were previously created with gen_random_uuid() and
-- authenticated by a scrypt hash in users.password_hash. The RLS policies written
-- in 20260625_000 assumed auth.uid() = users.id, which was never true for those
-- rows, so every policy silently denied and the app compensated by running every
-- API route with the service-role key.
--
-- After this cutover:
--   * New accounts use the Supabase Auth uid as public.users.id AND auth_user_id.
--   * Legacy accounts are linked via auth_user_id on first successful login,
--     which also clears password_hash.
--
-- Policies below therefore match on EITHER column, so migrated and new accounts
-- are both covered while legacy rows finish migrating.
--
-- Safe to re-run. No data is deleted.

BEGIN;

-- 1. Ensure the link column and an index for it.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_user_id UUID;

CREATE INDEX IF NOT EXISTS idx_users_auth_user_id
    ON public.users (auth_user_id)
    WHERE auth_user_id IS NOT NULL;

-- Case-insensitive email lookup. The login path does an ilike match on email,
-- which cannot use a plain btree index on email.
CREATE INDEX IF NOT EXISTS idx_users_email_lower
    ON public.users (lower(email));

-- 2. Backfill the link where a row's primary key already equals an auth user id.
UPDATE public.users u
SET auth_user_id = u.id
FROM auth.users a
WHERE u.auth_user_id IS NULL
  AND a.id = u.id;

-- 3. Helper: does the current JWT correspond to this row?
CREATE OR REPLACE FUNCTION public.is_current_user(row_id UUID, row_auth_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    SELECT auth.uid() IS NOT NULL
       AND (auth.uid() = row_auth_user_id OR auth.uid() = row_id);
$$;

-- 4. Replace the users policies so they match on either linkage column.
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
ON public.users
FOR UPDATE
USING (public.is_current_user(id, auth_user_id))
WITH CHECK (public.is_current_user(id, auth_user_id));

-- Public discovery still needs to read profiles, but restricted and deleted
-- accounts must not be listed, and the credential column must never be exposed.
DROP POLICY IF EXISTS "Public can read users" ON public.users;
CREATE POLICY "Public can read users"
ON public.users
FOR SELECT
USING (
    COALESCE(is_banned, false) = false
    AND COALESCE(is_suspended, false) = false
    AND account_deleted_at IS NULL
);

-- 5. Messaging policies keyed to the session rather than to a client-supplied id.
DROP POLICY IF EXISTS "Users can read own conversations" ON public.direct_conversations;
CREATE POLICY "Users can read own conversations"
ON public.direct_conversations
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.users u
        WHERE public.is_current_user(u.id, u.auth_user_id)
          AND (u.id = participant_one_id OR u.id = participant_two_id)
    )
);

DROP POLICY IF EXISTS "Users can read own direct messages" ON public.direct_messages;
CREATE POLICY "Users can read own direct messages"
ON public.direct_messages
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.users u
        WHERE public.is_current_user(u.id, u.auth_user_id)
          AND (u.id = sender_id OR u.id = receiver_id)
    )
);

DROP POLICY IF EXISTS "Users can insert own direct messages" ON public.direct_messages;
CREATE POLICY "Users can insert own direct messages"
ON public.direct_messages
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users u
        WHERE public.is_current_user(u.id, u.auth_user_id)
          AND u.id = sender_id
    )
);

DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
CREATE POLICY "Users can read own notifications"
ON public.notifications
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.users u
        WHERE public.is_current_user(u.id, u.auth_user_id)
          AND u.id = user_id
    )
);

-- 6. Never expose the credential column through PostgREST, even to service role
--    responses that select '*'.
REVOKE SELECT (password_hash) ON public.users FROM anon, authenticated;

COMMIT;

-- Post-migration check: how many accounts still hold a legacy hash?
-- These migrate automatically on their next successful login.
--
--   SELECT count(*) FILTER (WHERE password_hash IS NOT NULL) AS pending_migration,
--          count(*) FILTER (WHERE auth_user_id IS NOT NULL)  AS linked_to_auth,
--          count(*)                                          AS total
--   FROM public.users
--   WHERE COALESCE(is_seed_profile, false) = false;

*/
