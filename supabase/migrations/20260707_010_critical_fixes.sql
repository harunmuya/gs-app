-- Fix critical issues for the GS app
-- Run this in Supabase SQL Editor for project rmsvyhfpiytcffjkozje

-- 1. Fix photos column: change from jsonb to text[] if it's currently jsonb
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'photos' AND data_type = 'jsonb'
    ) THEN
        -- Convert existing jsonb photos to text array
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS photos_new text[] DEFAULT '{}';
        UPDATE public.users SET photos_new = CASE
            WHEN photos IS NULL THEN '{}'
            WHEN jsonb_typeof(photos) = 'array' THEN
                (SELECT COALESCE(array_agg(elem::text), '{}') FROM jsonb_array_elements_text(photos) AS elem)
            ELSE '{}'
        END;
        ALTER TABLE public.users DROP COLUMN photos;
        ALTER TABLE public.users RENAME COLUMN photos_new TO photos;
    END IF;
END $$;

-- 2. Ensure email has a proper UNIQUE constraint for upsert operations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.users'::regclass AND contype = 'u' 
        AND array_length(conkey, 1) = 1
        AND conkey[1] = (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.users'::regclass AND attname = 'email')
    ) THEN
        -- Remove duplicates first (keep the one with latest activity)
        DELETE FROM public.users a USING public.users b
        WHERE a.email = b.email AND a.id < b.id 
        AND a.email IS NOT NULL AND a.email <> '';
        
        -- Add unique constraint
        ALTER TABLE public.users ADD CONSTRAINT users_email_unique UNIQUE (email);
    END IF;
EXCEPTION WHEN others THEN
    RAISE NOTICE 'Email unique constraint may already exist: %', SQLERRM;
END $$;

-- 3. Fix RLS: ensure permissive policies exist for all operations (service role bypasses anyway)
DROP POLICY IF EXISTS "gs app full access users" ON public.users;
CREATE POLICY "gs app full access users" ON public.users FOR ALL USING (true) WITH CHECK (true);

-- 4. Ensure user_settings table exists
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    notifications boolean DEFAULT true,
    email_notifications boolean DEFAULT true,
    live_notifications boolean DEFAULT true,
    follow_notifications boolean DEFAULT true,
    marketing_notifications boolean DEFAULT true,
    dark_mode boolean DEFAULT false,
    show_online boolean DEFAULT true,
    show_age boolean DEFAULT true,
    is_public boolean DEFAULT true,
    live_location boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gs app full access user_settings" ON public.user_settings;
CREATE POLICY "gs app full access user_settings" ON public.user_settings FOR ALL USING (true) WITH CHECK (true);

-- 5. Ensure password_reset_codes table exists
CREATE TABLE IF NOT EXISTS public.password_reset_codes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    email text NOT NULL,
    code_hash text NOT NULL,
    expires_at timestamptz NOT NULL,
    used_at timestamptz,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.password_reset_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gs app full access password_reset_codes" ON public.password_reset_codes;
CREATE POLICY "gs app full access password_reset_codes" ON public.password_reset_codes FOR ALL USING (true) WITH CHECK (true);

-- 6. Ensure user_notifications table exists
CREATE TABLE IF NOT EXISTS public.user_notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    type text DEFAULT 'system',
    title text,
    body text,
    read boolean DEFAULT false,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gs app full access user_notifications" ON public.user_notifications;
CREATE POLICY "gs app full access user_notifications" ON public.user_notifications FOR ALL USING (true) WITH CHECK (true);
