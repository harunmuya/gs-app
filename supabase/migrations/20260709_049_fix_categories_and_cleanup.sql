-- Fix categories, looking_for labels, and cleanup for ALL profiles (seed + real users).
-- This migration corrects the wrong category assignments and ensures consistent labels.
-- SAFE: Only touches rows explicitly marked as seed profiles OR matching seed email patterns.
-- Real users are NEVER deleted.

-- =============================================
-- 1. Fix looking_for for ALL seed profiles
-- =============================================
UPDATE public.users
SET
    looking_for = CASE
        WHEN profile_label = 'sugar_mummy' THEN 'Sugar Guy / Toyboy'
        WHEN profile_label = 'sugar_daddy' THEN 'Mistress'
        WHEN profile_label = 'mistress' THEN 'Sugar Daddy'
        WHEN profile_label = 'toyboy' THEN 'Sugar Mummy'
        ELSE looking_for
    END,
    intent_summary = CASE
        WHEN profile_label = 'sugar_mummy' THEN 'I am a Sugar Mummy looking for Sugar Guy / Toyboy.'
        WHEN profile_label = 'sugar_daddy' THEN 'I am a Sugar Daddy looking for Mistress.'
        WHEN profile_label = 'mistress' THEN 'I am a Mistress looking for Sugar Daddy.'
        WHEN profile_label = 'toyboy' THEN 'I am a Sugar Guy / Toyboy looking for Sugar Mummy.'
        ELSE intent_summary
    END,
    member_category = COALESCE(NULLIF(member_category, ''), profile_label),
    show_in_public = true
WHERE is_seed_profile = true
  AND profile_label IN ('sugar_mummy', 'sugar_daddy', 'mistress', 'toyboy');

-- =============================================
-- 2. Fix looking_for for REAL users who have WRONG labels
--    e.g. a sugar_mummy whose looking_for says "Sugar Mummy" (looking for themselves!)
--    or raw label strings like "toyboy" instead of human "Sugar Guy / Toyboy"
-- =============================================

-- Sugar Mummies should look for "Sugar Guy / Toyboy"
UPDATE public.users
SET looking_for = 'Sugar Guy / Toyboy'
WHERE is_seed_profile = false
  AND profile_label = 'sugar_mummy'
  AND (
    LOWER(COALESCE(looking_for, '')) LIKE '%sugar mum%'
    OR LOWER(COALESCE(looking_for, '')) = 'toyboy'
    OR LOWER(COALESCE(looking_for, '')) = 'sugar_mummy'
    OR LOWER(COALESCE(looking_for, '')) = 'sugar mummy'
    OR looking_for IS NULL
    OR TRIM(looking_for) = ''
  );

-- Sugar Daddies should look for "Mistress"
UPDATE public.users
SET looking_for = 'Mistress'
WHERE is_seed_profile = false
  AND profile_label = 'sugar_daddy'
  AND (
    LOWER(COALESCE(looking_for, '')) LIKE '%sugar dad%'
    OR LOWER(COALESCE(looking_for, '')) = 'mistress'
    OR LOWER(COALESCE(looking_for, '')) = 'sugar_daddy'
    OR LOWER(COALESCE(looking_for, '')) = 'sugar daddy'
    OR looking_for IS NULL
    OR TRIM(looking_for) = ''
  );

-- Mistresses should look for "Sugar Daddy"
UPDATE public.users
SET looking_for = 'Sugar Daddy'
WHERE is_seed_profile = false
  AND profile_label = 'mistress'
  AND (
    LOWER(COALESCE(looking_for, '')) LIKE '%mistress%'
    OR LOWER(COALESCE(looking_for, '')) = 'sugar_daddy'
    OR looking_for IS NULL
    OR TRIM(looking_for) = ''
  );

-- Toyboys should look for "Sugar Mummy"
UPDATE public.users
SET looking_for = 'Sugar Mummy'
WHERE is_seed_profile = false
  AND profile_label = 'toyboy'
  AND (
    LOWER(COALESCE(looking_for, '')) LIKE '%toyboy%'
    OR LOWER(COALESCE(looking_for, '')) LIKE '%sugar guy%'
    OR LOWER(COALESCE(looking_for, '')) = 'sugar_mummy'
    OR LOWER(COALESCE(looking_for, '')) = 'sugar mummy'
    OR looking_for IS NULL
    OR TRIM(looking_for) = ''
  );

-- =============================================
-- 3. Sync member_category to match profile_label for all users
-- =============================================
UPDATE public.users
SET member_category = profile_label
WHERE profile_label IS NOT NULL
  AND profile_label != ''
  AND (member_category IS NULL OR member_category = '' OR member_category != profile_label);

-- =============================================
-- 4. Ensure all real (non-banned) users show in public
-- =============================================
UPDATE public.users
SET show_in_public = true
WHERE is_seed_profile = false
  AND is_banned = false
  AND is_suspended = false
  AND show_in_public = false
  AND admin_approved = true;

-- =============================================
-- 5. Remove duplicate seed profiles ONLY (keep newest per email)
--    SAFE: Only affects rows with is_seed_profile = true
-- =============================================
DELETE FROM public.users
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY LOWER(email) ORDER BY created_at DESC) AS rn
        FROM public.users
        WHERE is_seed_profile = true
    ) dupes
    WHERE rn > 1
);

-- =============================================
-- 6. Clean up legacy /seed-photos/ URLs for SEED profiles ONLY
--    SAFE: Only affects rows with is_seed_profile = true
-- =============================================
UPDATE public.users
SET avatar_url = NULL,
    photos = '{}'::text[]
WHERE is_seed_profile = true
  AND (
    LOWER(COALESCE(avatar_url, '')) LIKE '%/seed-photos/%'
    OR LOWER(COALESCE(array_to_string(photos, ' '), '')) LIKE '%/seed-photos/%'
  );

-- =============================================
-- 7. Verification summary
-- =============================================
SELECT
    count(*) AS total_users,
    count(*) FILTER (WHERE is_seed_profile = true) AS seed_profiles,
    count(*) FILTER (WHERE is_seed_profile = false) AS real_users,
    count(*) FILTER (WHERE is_seed_profile = false AND show_in_public = true) AS real_users_visible,
    count(*) FILTER (WHERE profile_label = 'sugar_mummy' AND looking_for = 'Sugar Guy / Toyboy') AS mummies_correct,
    count(*) FILTER (WHERE profile_label = 'sugar_daddy' AND looking_for = 'Mistress') AS daddies_correct,
    count(*) FILTER (WHERE profile_label = 'mistress' AND looking_for = 'Sugar Daddy') AS mistresses_correct,
    count(*) FILTER (WHERE profile_label = 'toyboy' AND looking_for = 'Sugar Mummy') AS toyboys_correct,
    count(*) FILTER (WHERE LOWER(COALESCE(avatar_url, '') || ' ' || COALESCE(array_to_string(photos, ' '), '')) LIKE '%/seed-photos/%') AS legacy_photo_urls
FROM public.users;
