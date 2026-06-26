-- Password reset OTP support for Genuine Sugar Mummies
-- Run this once in Supabase SQL editor before using email OTP password reset.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.password_reset_otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    email TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.password_reset_otps ENABLE ROW LEVEL SECURITY;

-- The app writes/reads this table only through service-role API routes.
-- No public/client access is allowed.
DROP POLICY IF EXISTS "No public OTP access" ON public.password_reset_otps;
CREATE POLICY "No public OTP access" ON public.password_reset_otps
    FOR ALL
    USING (false)
    WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_password_reset_otps_email_created
    ON public.password_reset_otps (email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_password_reset_otps_active
    ON public.password_reset_otps (email, expires_at DESC)
    WHERE used_at IS NULL;

-- Optional cleanup: remove old used/expired codes older than 7 days.
DELETE FROM public.password_reset_otps
WHERE created_at < now() - interval '7 days';
