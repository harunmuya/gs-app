-- Consolidate the two notification tables.
--
-- `notifications` (628 rows, 23 May – 7 Jul) and `user_notifications` (381 rows,
-- current) both exist. No application code references `notifications` at all —
-- 24 references across 8 files all point at `user_notifications` — so the older
-- table was orphaned when the app moved, and everything written to it since has
-- been invisible.
--
-- Checked before writing this:
--   * all 628 rows belong to users that still exist
--   * none of them are duplicated in user_notifications
--   * none were ever marked read
--
-- So they are not junk — they are verification updates, connection notices,
-- broadcasts and support replies that members were simply never shown.
--
-- They are migrated with their original timestamps, marked READ. Delivering 628
-- notifications up to two and a half months old as unread would bury anything
-- current under stale badges, which serves nobody. The history is preserved and
-- visible in the member's list; it just does not shout.
--
-- If you would rather members see them as new, change `true` to `false` in the
-- `read` column below before running.
--
-- Safe to re-run: the insert skips anything already carried over.

BEGIN;

-- Marks migrated rows so a second run cannot duplicate them.
ALTER TABLE public.user_notifications ADD COLUMN IF NOT EXISTS legacy_id UUID;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_notifications_legacy_id
    ON public.user_notifications (legacy_id) WHERE legacy_id IS NOT NULL;

DO $$
DECLARE
    moved INTEGER;
BEGIN
    IF to_regclass('public.notifications') IS NULL THEN
        RAISE NOTICE 'legacy notifications table not present; nothing to migrate';
        RETURN;
    END IF;

    INSERT INTO public.user_notifications (user_id, type, title, body, read, created_at, legacy_id)
    SELECT
        n.user_id,
        COALESCE(NULLIF(n.type, ''), 'general'),
        COALESCE(NULLIF(n.title, ''), 'Notification'),
        COALESCE(n.body, ''),
        true,                       -- see the note above
        COALESCE(n.created_at, now()),
        n.id
    FROM public.notifications n
    JOIN public.users u ON u.id = n.user_id      -- skip rows whose owner is gone
    WHERE n.id IS NOT NULL
    ON CONFLICT (legacy_id) DO NOTHING;

    GET DIAGNOSTICS moved = ROW_COUNT;
    RAISE NOTICE 'migrated % legacy notification(s) into user_notifications', moved;
END $$;

COMMIT;

-- The old table is left in place, now emptied of purpose. Once you have
-- confirmed the migrated rows appear correctly in members' alerts, it can go:
--
--   -- confirm the counts line up first
--   SELECT
--     (SELECT count(*) FROM public.notifications)                         AS legacy_rows,
--     (SELECT count(*) FROM public.user_notifications WHERE legacy_id IS NOT NULL) AS carried_over;
--
--   -- then, and only then
--   DROP TABLE public.notifications;
--
-- Dropping it is not done here because a migration that deletes 628 rows of
-- member history should be a deliberate act, not a side effect of deploying.
