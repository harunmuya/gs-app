-- ============================================================
-- GenuineSugarmummies App — Safe Schema Update
-- Run in Supabase Dashboard > SQL Editor
-- All statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
-- ============================================================

-- Support Tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    category text NOT NULL DEFAULT 'other',
    subject text NOT NULL,
    message text NOT NULL,
    status text NOT NULL DEFAULT 'open',
    admin_reply text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Add new columns to transactions (safe, idempotent)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_proof_url text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS admin_notes text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reviewed_by text;

-- Add last_seen to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen timestamptz DEFAULT now();

-- RLS for support_tickets
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own tickets" ON support_tickets;
DROP POLICY IF EXISTS "Users insert own tickets" ON support_tickets;
DROP POLICY IF EXISTS "Service role full access" ON support_tickets;

CREATE POLICY "Users view own tickets" ON support_tickets
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own tickets" ON support_tickets
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Index for fast ticket lookup
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen);
