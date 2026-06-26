-- ============================================================
-- GenuineSugarmummies App — V2 Migration (Follows, Phone, Profile Type)
-- Run in Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. New columns on users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone_visible BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS profile_type TEXT DEFAULT 'member';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS nationality TEXT;

-- 2. Follows table
CREATE TABLE IF NOT EXISTS public.follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    following_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(follower_id, following_id)
);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "follows_select_all" ON public.follows;
DROP POLICY IF EXISTS "follows_insert_own" ON public.follows;
DROP POLICY IF EXISTS "follows_delete_own" ON public.follows;
CREATE POLICY "follows_select_all" ON public.follows FOR SELECT USING (true);
CREATE POLICY "follows_insert_own" ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "follows_delete_own" ON public.follows FOR DELETE USING (auth.uid() = follower_id);

-- 3. Phone View Requests table
CREATE TABLE IF NOT EXISTS public.phone_view_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    target_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now(),
    reviewed_at TIMESTAMPTZ,
    UNIQUE(requester_id, target_user_id)
);

ALTER TABLE public.phone_view_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pvr_select_own" ON public.phone_view_requests;
DROP POLICY IF EXISTS "pvr_insert_own" ON public.phone_view_requests;
CREATE POLICY "pvr_select_own" ON public.phone_view_requests FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = target_user_id);
CREATE POLICY "pvr_insert_own" ON public.phone_view_requests FOR INSERT WITH CHECK (auth.uid() = requester_id);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows(following_id);
CREATE INDEX IF NOT EXISTS idx_follows_created ON public.follows(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pvr_requester ON public.phone_view_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_pvr_target ON public.phone_view_requests(target_user_id);
CREATE INDEX IF NOT EXISTS idx_pvr_status ON public.phone_view_requests(status);
CREATE INDEX IF NOT EXISTS idx_users_profile_type ON public.users(profile_type);
CREATE INDEX IF NOT EXISTS idx_users_nationality ON public.users(nationality);
