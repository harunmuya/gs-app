-- ================================================
-- Genuine Sugarmummies App — Supabase Database Schema
-- ================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================
-- 1. User Profiles (extends auth.users)
-- ==============================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    images TEXT[] DEFAULT '{}',
    bio TEXT DEFAULT '',
    interests TEXT[] DEFAULT '{}',
    gender TEXT CHECK (gender IN ('male', 'female', 'other')),
    looking_for TEXT CHECK (looking_for IN ('sugar_mummy', 'sugar_daddy')),
    age INTEGER CHECK (age >= 18 AND age <= 100),
    location TEXT DEFAULT '',
    phone TEXT,
    is_public BOOLEAN DEFAULT true,
    is_online BOOLEAN DEFAULT false,
    last_seen_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view public profiles" ON public.users FOR SELECT USING (is_public = true OR auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can delete own profile" ON public.users FOR DELETE USING (auth.uid() = id);

-- ==============================
-- 2. User Locations
-- ==============================
CREATE TABLE IF NOT EXISTS public.user_locations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    city TEXT,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own location" ON public.user_locations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view locations" ON public.user_locations FOR SELECT USING (true);

-- ==============================
-- 3. Preferences
-- ==============================
CREATE TABLE IF NOT EXISTS public.preferences (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    min_age INTEGER DEFAULT 18,
    max_age INTEGER DEFAULT 70,
    max_distance_km INTEGER DEFAULT 100,
    gender_preference TEXT,
    notifications_enabled BOOLEAN DEFAULT true,
    email_notifications BOOLEAN DEFAULT false,
    location_enabled BOOLEAN DEFAULT false,
    show_online BOOLEAN DEFAULT true,
    show_age BOOLEAN DEFAULT true,
    UNIQUE(user_id)
);
ALTER TABLE public.preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own preferences" ON public.preferences FOR ALL USING (auth.uid() = user_id);

-- ==============================
-- 4. Likes
-- ==============================
CREATE TABLE IF NOT EXISTS public.likes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    profile_wp_id INTEGER NOT NULL,
    profile_name TEXT,
    profile_image TEXT,
    profile_location TEXT,
    is_super_like BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, profile_wp_id)
);
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own likes" ON public.likes FOR ALL USING (auth.uid() = user_id);

-- ==============================
-- 5. Passes
-- ==============================
CREATE TABLE IF NOT EXISTS public.passes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    profile_wp_id INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, profile_wp_id)
);
ALTER TABLE public.passes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own passes" ON public.passes FOR ALL USING (auth.uid() = user_id);

-- ==============================
-- 6. Matches
-- ==============================
CREATE TABLE IF NOT EXISTS public.matches (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    profile_wp_id INTEGER NOT NULL,
    profile_name TEXT,
    profile_image TEXT,
    profile_location TEXT,
    score INTEGER DEFAULT 0,
    seen BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, profile_wp_id)
);
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own matches" ON public.matches FOR ALL USING (auth.uid() = user_id);

-- ==============================
-- 7. Saved Profiles
-- ==============================
CREATE TABLE IF NOT EXISTS public.saved_profiles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    profile_wp_id INTEGER NOT NULL,
    profile_name TEXT,
    profile_image TEXT,
    profile_location TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, profile_wp_id)
);
ALTER TABLE public.saved_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own saved" ON public.saved_profiles FOR ALL USING (auth.uid() = user_id);

-- ==============================
-- 8. Conversations
-- ==============================
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    match_wp_id INTEGER,
    match_name TEXT,
    match_image TEXT,
    last_message TEXT DEFAULT '',
    last_message_at TIMESTAMPTZ DEFAULT now(),
    unread_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own conversations" ON public.conversations FOR ALL USING (auth.uid() = user_id);

-- ==============================
-- 9. Messages (30-day retention)
-- ==============================
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    sender_name TEXT,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view messages in own conversations" ON public.messages FOR SELECT
    USING (conversation_id IN (SELECT id FROM public.conversations WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert messages in own conversations" ON public.messages FOR INSERT
    WITH CHECK (conversation_id IN (SELECT id FROM public.conversations WHERE user_id = auth.uid()));
CREATE POLICY "Users can update messages in own conversations" ON public.messages FOR UPDATE
    USING (conversation_id IN (SELECT id FROM public.conversations WHERE user_id = auth.uid()));

-- ==============================
-- 10. Activity Log
-- ==============================
CREATE TABLE IF NOT EXISTS public.activity (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL,
    title TEXT,
    message TEXT,
    image TEXT,
    profile_id INTEGER,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own activity" ON public.activity FOR ALL USING (auth.uid() = user_id);

-- ==============================
-- 11. Inbox/Notifications
-- ==============================
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL,
    sender TEXT,
    sender_image TEXT,
    title TEXT,
    body TEXT,
    profile_id INTEGER,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own notifications" ON public.notifications FOR ALL USING (auth.uid() = user_id);

-- ==============================
-- 12. Verification Requests
-- ==============================
CREATE TABLE IF NOT EXISTS public.verification_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    selfie_url TEXT,
    id_doc_url TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'pending_review', 'verified', 'failed')),
    reason TEXT,
    submitted_at TIMESTAMPTZ DEFAULT now(),
    reviewed_at TIMESTAMPTZ,
    UNIQUE(user_id)
);
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own verification" ON public.verification_requests FOR ALL USING (auth.uid() = user_id);

-- ==============================
-- 13. Subscriptions
-- ==============================
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'silver', 'gold', 'diamond')),
    started_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ,
    UNIQUE(user_id)
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own subscription" ON public.subscriptions FOR ALL USING (auth.uid() = user_id);

-- ==============================
-- 14. Reports
-- ==============================
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    reporter_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    target_wp_id INTEGER,
    target_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create reports" ON public.reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Users can view own reports" ON public.reports FOR SELECT USING (auth.uid() = reporter_id);

-- ==============================
-- 15. Blocked Users
-- ==============================
CREATE TABLE IF NOT EXISTS public.blocked_users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    blocker_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    blocked_wp_id INTEGER,
    blocked_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(blocker_id, blocked_wp_id)
);
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own blocks" ON public.blocked_users FOR ALL USING (auth.uid() = blocker_id);

-- ==============================
-- Functions & Triggers
-- ==============================

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, display_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
    );

    INSERT INTO public.preferences (user_id) VALUES (NEW.id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update last_seen on user activity
CREATE OR REPLACE FUNCTION public.update_last_seen()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.users SET last_seen_at = now(), is_online = true WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_activity_update_last_seen ON public.activity;
CREATE TRIGGER on_activity_update_last_seen
    AFTER INSERT ON public.activity
    FOR EACH ROW EXECUTE FUNCTION public.update_last_seen();

-- Auto-cleanup messages older than 30 days
CREATE OR REPLACE FUNCTION public.cleanup_old_messages()
RETURNS void AS $$
BEGIN
    DELETE FROM public.messages WHERE created_at < now() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_user_update ON public.users;
CREATE TRIGGER on_user_update
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ==============================
-- Indexes for Performance
-- ==============================
CREATE INDEX IF NOT EXISTS idx_likes_user ON public.likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_wp ON public.likes(profile_wp_id);
CREATE INDEX IF NOT EXISTS idx_passes_user ON public.passes(user_id);
CREATE INDEX IF NOT EXISTS idx_matches_user ON public.matches(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_user ON public.saved_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON public.messages(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_user ON public.activity(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON public.activity(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_last_seen ON public.users(last_seen_at);
