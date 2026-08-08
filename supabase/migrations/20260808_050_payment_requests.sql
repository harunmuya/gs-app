-- Harden the existing manual payment flow.
--
-- Payments already live in `package_requests`, and the admin panel already
-- approves them and grants the package. This does not add a second table — a
-- parallel payment system would drift from the one administrators actually use,
-- which is the failure mode this codebase has repeatedly suffered from.
--
-- What was missing was the part that makes a manual flow trustworthy:
--
--  * `payment_reference` had no uniqueness constraint. The same M-Pesa SMS code
--    could be submitted by any number of accounts and every one would look
--    equally legitimate to a reviewer. This is the easiest way to cheat a
--    manual flow and it cost nothing to attempt.
--  * There was no record of which network was used, so a reviewer had to guess
--    whether to check the M-Pesa or Airtel statement.
--  * There was no record of the paying number, which is the first thing you
--    match against a statement line.
--
-- Safe to re-run.

BEGIN;

ALTER TABLE public.package_requests ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'mpesa';
ALTER TABLE public.package_requests ADD COLUMN IF NOT EXISTS payer_phone TEXT DEFAULT '';
ALTER TABLE public.package_requests ADD COLUMN IF NOT EXISTS granted_at TIMESTAMPTZ;

-- Normalise anything already stored, so the unique index below can be created.
UPDATE public.package_requests
SET payment_reference = upper(regexp_replace(coalesce(payment_reference, ''), '[^A-Za-z0-9]', '', 'g'))
WHERE payment_reference IS DISTINCT FROM
      upper(regexp_replace(coalesce(payment_reference, ''), '[^A-Za-z0-9]', '', 'g'));

-- One receipt, one activation.
--
-- Partial, because historical rows may legitimately have an empty reference and
-- those must not collide with each other. If this fails to create, there are
-- existing duplicates — find them with the query at the foot of this file and
-- resolve them before re-running.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_package_requests_reference
    ON public.package_requests (upper(payment_reference))
    WHERE payment_reference IS NOT NULL AND payment_reference <> '';

CREATE INDEX IF NOT EXISTS idx_package_requests_user_created
    ON public.package_requests (user_id, created_at DESC);

COMMIT;

-- If the unique index fails, these are the duplicates blocking it:
--
--   SELECT upper(payment_reference) AS reference, count(*), array_agg(id) AS rows
--   FROM public.package_requests
--   WHERE payment_reference <> ''
--   GROUP BY 1 HAVING count(*) > 1
--   ORDER BY 2 DESC;
--
-- Each group is either an honest double submission (keep one) or a reused code
-- (worth investigating before deleting).
