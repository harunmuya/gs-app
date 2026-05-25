-- ============================================================
-- GenuineSugarmummies App — Safe Schema Update
-- Run in Supabase Dashboard > SQL Editor
-- All statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
-- ============================================================

-- 1. App Settings / Fallback Ledger table
CREATE TABLE IF NOT EXISTS public.app_settings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    key text UNIQUE NOT NULL,
    value jsonb NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- RLS for app_settings
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Allow insert app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Allow update app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Allow delete app_settings" ON public.app_settings;

CREATE POLICY "Allow read app_settings" ON public.app_settings
    FOR SELECT USING (true);

CREATE POLICY "Allow insert app_settings" ON public.app_settings
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update app_settings" ON public.app_settings
    FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow delete app_settings" ON public.app_settings
    FOR DELETE USING (true);


-- 2. Transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    email text,
    amount numeric DEFAULT 0,
    plan text,
    code text UNIQUE,
    method text DEFAULT 'M-Pesa Escrow',
    status text DEFAULT 'Pending',
    ticket_id text,
    payment_proof_url text,
    admin_notes text,
    reviewed_at timestamptz,
    reviewed_by text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Add new columns to transactions if table existed but lacked them
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS payment_proof_url text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS admin_notes text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS reviewed_by text;

-- RLS for transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select own transactions" ON public.transactions;
CREATE POLICY "Allow select own transactions" ON public.transactions
    FOR SELECT USING (auth.uid() = user_id);


-- 3. Support Tickets table
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    category text NOT NULL DEFAULT 'other',
    subject text NOT NULL,
    message text NOT NULL,
    status text NOT NULL DEFAULT 'open',
    admin_reply text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- RLS for support_tickets
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users insert own tickets" ON public.support_tickets;

CREATE POLICY "Users view own tickets" ON public.support_tickets
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own tickets" ON public.support_tickets
    FOR INSERT WITH CHECK (auth.uid() = user_id);


-- 4. User Presence updates
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_seen timestamptz DEFAULT now();


-- 5. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_users_last_seen ON public.users(last_seen);

-- 6. Add hobbies column to public.users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS hobbies TEXT[] DEFAULT '{}';

