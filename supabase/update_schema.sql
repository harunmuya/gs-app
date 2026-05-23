-- ================================================
-- SQL Update Migration Script
-- Run this in your Supabase Dashboard SQL Editor
-- ================================================

-- 1. Add admin, ban, and custom_badge columns to public.users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS custom_badge TEXT DEFAULT '';

-- 2. Adjust RLS policies on public.users to allow admins full read/write access
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.users;
CREATE POLICY "Admins can view all profiles" ON public.users FOR SELECT USING (
    (SELECT COALESCE(is_admin, false) FROM public.users WHERE id = auth.uid()) = true
);

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.users;
CREATE POLICY "Admins can update all profiles" ON public.users FOR UPDATE USING (
    (SELECT COALESCE(is_admin, false) FROM public.users WHERE id = auth.uid()) = true
);

-- 3. Adjust RLS policies on public.subscriptions to allow admins full management
DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON public.subscriptions;
CREATE POLICY "Admins can manage all subscriptions" ON public.subscriptions FOR ALL USING (
    (SELECT COALESCE(is_admin, false) FROM public.users WHERE id = auth.uid()) = true
);

-- 4. Adjust RLS policies on public.verification_requests to allow admins full management
DROP POLICY IF EXISTS "Admins can manage all verifications" ON public.verification_requests;
CREATE POLICY "Admins can manage all verifications" ON public.verification_requests FOR ALL USING (
    (SELECT COALESCE(is_admin, false) FROM public.users WHERE id = auth.uid()) = true
);

-- 5. Mark initial admin (Optional - replace with your actual user email/ID)
-- UPDATE public.users SET is_admin = true WHERE email = 'admin@genuinesugarmummies.co.ke';

-- ================================================
-- 6. Create transactions table for financial tracking
-- ================================================
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    email TEXT NOT NULL,
    plan TEXT CHECK (plan IN ('free', 'silver', 'gold', 'diamond')),
    amount NUMERIC DEFAULT 0,
    method TEXT DEFAULT 'M-Pesa Escrow',
    status TEXT DEFAULT 'Completed' CHECK (status IN ('Completed', 'Pending', 'Failed')),
    code TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage all transactions" ON public.transactions;
CREATE POLICY "Admins can manage all transactions" ON public.transactions FOR ALL USING (
    (SELECT COALESCE(is_admin, false) FROM public.users WHERE id = auth.uid()) = true
);

DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT USING (
    auth.uid() = user_id
);

-- ================================================
-- 7. Create app settings table for admin configs
-- ================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default settings
INSERT INTO public.app_settings (key, value) VALUES
('campaigns', '{"bannerAds": true, "intercomPromo": false, "lockMessageLimit": true, "dailySwipeLimit": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read of app settings" ON public.app_settings;
CREATE POLICY "Allow public read of app settings" ON public.app_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage app settings" ON public.app_settings;
CREATE POLICY "Admins can manage app settings" ON public.app_settings FOR ALL USING (
    (SELECT COALESCE(is_admin, false) FROM public.users WHERE id = auth.uid()) = true
);
