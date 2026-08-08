-- Clear fabricated engagement metrics from seeded profiles.
--
-- Why this is needed even though the code was already fixed:
--
-- The application used to invent these numbers at request time
-- (seedViewFloor / seedFollowerFloor / seedGiftFloor in api/members/route.js).
-- Those were removed. But the reseed migrations also wrote fixed fake values
-- straight into the table — every seeded row carries
-- total_profile_views = 900, followers_count = 35, gifts_received_count = 4
-- (see 20260710_020_seed_names_tiers_public_cleanup.sql).
--
-- So removing the runtime fabrication did not make the numbers true; it made the
-- API report the stored fiction faithfully. A member still sees "900 views" on a
-- profile nobody has ever viewed. This clears the stored values so the counts
-- reflect real recorded activity, which is the whole point of the change.
--
-- last_seen_at is also cleared for seeded rows. There is no one signed in behind
-- these profiles, so any value is a claim of activity that did not happen — and a
-- non-null value feeds the activity signal in the discovery ranking, letting
-- unattended profiles outrank real members.
--
-- Real member accounts are never touched. Safe to re-run.

BEGIN;

DO $$
DECLARE
    affected INTEGER;
BEGIN
    SELECT count(*) INTO affected
    FROM public.users
    WHERE coalesce(is_seed_profile, false) = true
      AND (
        coalesce(total_profile_views, 0) <> 0
        OR coalesce(followers_count, 0) <> 0
        OR coalesce(gifts_received_count, 0) <> 0
        OR last_seen_at IS NOT NULL
        OR last_seen IS NOT NULL
      );
    RAISE NOTICE 'Seed profiles carrying fabricated engagement or presence: %', affected;
END $$;

UPDATE public.users
SET total_profile_views = 0,
    followers_count = 0,
    gifts_received_count = 0,
    last_seen_at = NULL,
    last_seen = NULL,
    updated_at = now()
WHERE coalesce(is_seed_profile, false) = true
  AND (
    coalesce(total_profile_views, 0) <> 0
    OR coalesce(followers_count, 0) <> 0
    OR coalesce(gifts_received_count, 0) <> 0
    OR last_seen_at IS NOT NULL
    OR last_seen IS NOT NULL
  );

COMMIT;

-- Verification. Must return 0.
--
--   SELECT count(*) AS seeded_with_fake_engagement
--   FROM public.users
--   WHERE coalesce(is_seed_profile, false) = true
--     AND (coalesce(total_profile_views,0) <> 0
--          OR coalesce(followers_count,0) <> 0
--          OR coalesce(gifts_received_count,0) <> 0
--          OR last_seen_at IS NOT NULL);
--
-- NOTE for future reseeds: the seed generator and the reseed migrations must stop
-- emitting these values, or this will need running again after every reseed.
-- scripts/generate-seed-members.mjs and src/lib/localSeedMembers.js have already
-- been corrected; any new reseed SQL should insert 0 / NULL for these columns.
