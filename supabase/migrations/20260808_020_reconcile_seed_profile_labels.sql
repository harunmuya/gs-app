-- Reconcile seed profile labels with their photo folders.
--
-- Why: the application does not trust `profile_label` for seed profiles.
-- `inferProfileLabel()` in src/app/api/members/route.js derives a seed profile's
-- label from its photo path and overrides the column. That divergence is why the
-- label filter has to run in JavaScript after the rows are fetched, which in turn
-- is why the API has to over-fetch a large candidate pool on every listing request.
--
-- This migration makes the column agree with the photo path, using exactly the same
-- precedence the application uses, so the filter can move into SQL.
--
-- Note on matching: the toyboy folder is stored URL-encoded as
-- '/seed/Toboys%20or%20Sugarguys/'. '%' is a LIKE wildcard, so every comparison
-- here uses strpos(), which is a literal substring search.
--
-- Safe to re-run. Only rows where is_seed_profile = true are touched, and only
-- when a folder can be identified. Real member accounts are never modified.

BEGIN;

-- Mirrors inferProfileLabel(): photo folder wins, stored label is the fallback.
CREATE OR REPLACE FUNCTION public.seed_label_from_media(
    avatar TEXT,
    photo_list TEXT[],
    stored_label TEXT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
    WITH media AS (
        SELECT lower(coalesce(avatar, '') || ' ' || coalesce(array_to_string(photo_list, ' '), '')) AS blob
    )
    SELECT CASE
        WHEN strpos((SELECT blob FROM media), '/seed/sugarmums/')  > 0 THEN 'sugar_mummy'
        WHEN strpos((SELECT blob FROM media), '/seed/sugar-dads/') > 0 THEN 'sugar_daddy'
        WHEN strpos((SELECT blob FROM media), '/seed/mistresses/') > 0 THEN 'mistress'
        WHEN strpos((SELECT blob FROM media), '/seed/toboys%20or%20sugarguys/') > 0 THEN 'toyboy'
        WHEN strpos((SELECT blob FROM media), '/seed/toboys or sugarguys/')     > 0 THEN 'toyboy'
        WHEN lower(coalesce(stored_label, '')) IN ('sugar_mummy', 'sugar_daddy', 'mistress', 'toyboy')
            THEN lower(stored_label)
        ELSE NULL
    END;
$$;

-- Report the drift before changing anything.
DO $$
DECLARE
    drift_count INTEGER;
BEGIN
    SELECT count(*) INTO drift_count
    FROM public.users
    WHERE coalesce(is_seed_profile, false) = true
      AND public.seed_label_from_media(avatar_url, photos, profile_label) IS NOT NULL
      AND coalesce(profile_label, '') IS DISTINCT FROM
          public.seed_label_from_media(avatar_url, photos, profile_label);
    RAISE NOTICE 'Seed profiles whose profile_label disagrees with their photo folder: %', drift_count;
END $$;

UPDATE public.users u
SET profile_label   = resolved.label,
    member_category = resolved.label,
    looking_for = CASE resolved.label
        WHEN 'sugar_mummy' THEN 'Sugar Guy / Toyboy'
        WHEN 'sugar_daddy' THEN 'Mistress'
        WHEN 'mistress'    THEN 'Sugar Daddy'
        WHEN 'toyboy'      THEN 'Sugar Mummy'
        ELSE u.looking_for
    END,
    updated_at = now()
FROM LATERAL (
    SELECT public.seed_label_from_media(u.avatar_url, u.photos, u.profile_label) AS label
) AS resolved
WHERE coalesce(u.is_seed_profile, false) = true
  AND resolved.label IS NOT NULL
  AND coalesce(u.profile_label, '') IS DISTINCT FROM resolved.label;

-- Index supporting the SQL-side label filter this migration unblocks.
CREATE INDEX IF NOT EXISTS idx_users_profile_label_public
    ON public.users (profile_label)
    WHERE coalesce(is_banned, false) = false
      AND coalesce(is_suspended, false) = false
      AND account_deleted_at IS NULL;

COMMIT;

-- Verification. Run this after the migration; it must return 0 before setting
-- SEED_LABELS_RECONCILED=1 in the environment, which is what turns on the SQL
-- label filter in src/app/api/members/route.js.
--
--   SELECT count(*) AS remaining_drift
--   FROM public.users
--   WHERE coalesce(is_seed_profile, false) = true
--     AND public.seed_label_from_media(avatar_url, photos, profile_label) IS NOT NULL
--     AND coalesce(profile_label, '') IS DISTINCT FROM
--         public.seed_label_from_media(avatar_url, photos, profile_label);
--
-- Seed profiles with no identifiable folder keep whatever label they had. To find
-- them (they will still be filtered in JavaScript, which is correct):
--
--   SELECT id, display_name, profile_label, avatar_url
--   FROM public.users
--   WHERE coalesce(is_seed_profile, false) = true
--     AND public.seed_label_from_media(avatar_url, photos, profile_label) IS NULL;
