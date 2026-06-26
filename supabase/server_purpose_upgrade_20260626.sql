-- Genuine Sugar Mummies Kenya app server-purpose upgrade
-- Run in Supabase SQL Editor for genuine-sugarmummies-app / genuinesugarmummies.co.ke.
-- Safe to run multiple times.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Users / profiles
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    photos TEXT[] DEFAULT '{}',
    images TEXT[] DEFAULT '{}',
    bio TEXT DEFAULT '',
    description TEXT DEFAULT '',
    interests TEXT[] DEFAULT '{}',
    hobbies TEXT[] DEFAULT '{}',
    gender TEXT,
    looking_for TEXT,
    profile_type TEXT DEFAULT 'member',
    profile_label TEXT DEFAULT 'member',
    member_category TEXT DEFAULT 'member',
    age INTEGER,
    location TEXT DEFAULT '',
    country TEXT DEFAULT 'Kenya',
    city TEXT DEFAULT '',
    nationality TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    phone_number TEXT DEFAULT '',
    phone_visible BOOLEAN DEFAULT true,
    is_public BOOLEAN DEFAULT true,
    show_in_public BOOLEAN DEFAULT true,
    is_online BOOLEAN DEFAULT false,
    is_seed BOOLEAN DEFAULT false,
    is_admin BOOLEAN DEFAULT false,
    is_banned BOOLEAN DEFAULT false,
    is_suspended BOOLEAN DEFAULT false,
    custom_badge TEXT DEFAULT '',
    total_profile_views INTEGER DEFAULT 0,
    followers_count INTEGER DEFAULT 0,
    following_count INTEGER DEFAULT 0,
    gifts_received_count INTEGER DEFAULT 0,
    last_seen TIMESTAMPTZ DEFAULT now(),
    last_seen_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS photos TEXT[] DEFAULT '{}';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS hobbies TEXT[] DEFAULT '{}';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS profile_type TEXT DEFAULT 'member';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS profile_label TEXT DEFAULT 'member';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS member_category TEXT DEFAULT 'member';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Kenya';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS city TEXT DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS nationality TEXT DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone_number TEXT DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone_visible BOOLEAN DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS show_in_public BOOLEAN DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_seed BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS custom_badge TEXT DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS total_profile_views INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS gifts_received_count INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT now();

-- Preferences / settings
CREATE TABLE IF NOT EXISTS public.preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    min_age INTEGER DEFAULT 18,
    max_age INTEGER DEFAULT 70,
    max_distance_km INTEGER DEFAULT 100,
    gender_preference TEXT,
    notifications_enabled BOOLEAN DEFAULT true,
    email_notifications BOOLEAN DEFAULT false,
    location_enabled BOOLEAN DEFAULT false,
    show_online BOOLEAN DEFAULT true,
    show_age BOOLEAN DEFAULT true,
    dark_mode BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL,
    value JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.app_settings(key, value) VALUES
('fallback_ledger', '{"custom_badges":{},"user_plans":{},"transactions":[],"support_tickets":[],"verifications":{}}'::jsonb),
('campaigns', '{"bannerAds":true,"intercomPromo":false,"lockMessageLimit":true,"dailySwipeLimit":true,"promoPopupEnabled":false,"welcomeMessageEnabled":true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Swipes, likes, matches, saves
CREATE TABLE IF NOT EXISTS public.likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    profile_wp_id INTEGER NOT NULL,
    profile_name TEXT,
    profile_image TEXT,
    profile_location TEXT,
    is_super_like BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, profile_wp_id)
);

CREATE TABLE IF NOT EXISTS public.passes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    profile_wp_id INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, profile_wp_id)
);

CREATE TABLE IF NOT EXISTS public.matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

CREATE TABLE IF NOT EXISTS public.saved_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    profile_wp_id INTEGER NOT NULL,
    profile_name TEXT,
    profile_image TEXT,
    profile_location TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, profile_wp_id)
);

-- Conversations and messages
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    match_wp_id INTEGER,
    match_name TEXT,
    match_image TEXT,
    last_message TEXT DEFAULT '',
    last_message_at TIMESTAMPTZ DEFAULT now(),
    unread_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    sender_name TEXT,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.direct_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    participant_1 UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    participant_2 UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    last_message TEXT DEFAULT '',
    last_message_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(participant_1, participant_2)
);

CREATE TABLE IF NOT EXISTS public.direct_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES public.direct_conversations(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text',
    media_url TEXT DEFAULT '',
    media_duration INTEGER,
    is_read BOOLEAN DEFAULT false,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    reactions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Alerts and activity
CREATE TABLE IF NOT EXISTS public.activity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL,
    title TEXT,
    message TEXT,
    image TEXT,
    profile_id INTEGER,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    type TEXT DEFAULT 'system',
    sender TEXT DEFAULT 'GS Support',
    sender_image TEXT DEFAULT '/gs-logo.png',
    title TEXT DEFAULT 'Notification',
    body TEXT DEFAULT '',
    profile_id INTEGER,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Verification and subscriptions
CREATE TABLE IF NOT EXISTS public.verification_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    selfie_url TEXT,
    id_doc_url TEXT,
    status TEXT DEFAULT 'pending_review',
    reason TEXT,
    submitted_at TIMESTAMPTZ DEFAULT now(),
    reviewed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    plan TEXT DEFAULT 'free',
    started_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ
);

ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;

-- Normalize old/invalid plan names before adding the stricter package check.
-- Existing apps may have rows such as diamond, premium, VIP, blank, or NULL.
UPDATE public.subscriptions
SET plan = CASE
    WHEN plan IS NULL OR btrim(plan) = '' THEN 'free'
    WHEN lower(btrim(plan)) IN ('free', 'trial') THEN 'free'
    WHEN lower(btrim(plan)) IN ('basic', 'bronze', 'starter') THEN 'basic'
    WHEN lower(btrim(plan)) IN ('silver', 'standard') THEN 'silver'
    WHEN lower(btrim(plan)) IN ('gold', 'diamond', 'premium', 'vip', 'international') THEN 'gold'
    ELSE 'free'
END;

ALTER TABLE public.subscriptions ALTER COLUMN plan SET DEFAULT 'free';
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_plan_check CHECK (plan IN ('free','basic','silver','gold'));

CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY DEFAULT ('TX-' || substr(md5(random()::text), 1, 10)),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    email TEXT,
    plan TEXT NOT NULL,
    amount NUMERIC DEFAULT 0,
    method TEXT DEFAULT 'Mobile Money',
    status TEXT DEFAULT 'Pending',
    code TEXT UNIQUE,
    ticket_id TEXT,
    payment_proof_url TEXT,
    payment_proof_base64 TEXT,
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    reviewed_at TIMESTAMPTZ
);

-- Members social
CREATE TABLE IF NOT EXISTS public.follows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    following_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(follower_id, following_id)
);

CREATE TABLE IF NOT EXISTS public.member_statuses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    content TEXT DEFAULT '',
    media_url TEXT DEFAULT '',
    media_type TEXT DEFAULT 'text',
    background_color TEXT DEFAULT '#FF5A5F',
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ DEFAULT (now() + interval '24 hours')
);

CREATE TABLE IF NOT EXISTS public.status_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    status_id UUID REFERENCES public.member_statuses(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(status_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.status_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    status_id UUID REFERENCES public.member_statuses(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    reaction TEXT DEFAULT 'like',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(status_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.call_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    caller_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    receiver_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    call_type TEXT DEFAULT 'voice',
    status TEXT DEFAULT 'missed',
    duration INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    email TEXT,
    category TEXT DEFAULT 'support',
    subject TEXT DEFAULT 'Support request',
    message TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    admin_reply TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: app uses Supabase Auth client plus service-role admin routes.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Permissive policies for this app. Service role still bypasses RLS for admin panel.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','preferences','app_settings','likes','passes','matches','saved_profiles','conversations','messages','direct_conversations','direct_messages','activity','notifications','verification_requests','subscriptions','transactions','follows','member_statuses','status_views','status_reactions','call_logs','support_tickets'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "app all %1$s" ON public.%1$I', t);
    EXECUTE format('CREATE POLICY "app all %1$s" ON public.%1$I FOR ALL USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

-- Realtime publications, skip safely if already added.
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; EXCEPTION WHEN duplicate_object OR undefined_table THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations; EXCEPTION WHEN duplicate_object OR undefined_table THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages; EXCEPTION WHEN duplicate_object OR undefined_table THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_conversations; EXCEPTION WHEN duplicate_object OR undefined_table THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; EXCEPTION WHEN duplicate_object OR undefined_table THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.verification_requests; EXCEPTION WHEN duplicate_object OR undefined_table THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.subscriptions; EXCEPTION WHEN duplicate_object OR undefined_table THEN NULL; END;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_public ON public.users(show_in_public, is_banned, is_suspended);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_last_seen ON public.users(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_likes_user ON public.likes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_passes_user ON public.passes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_matches_user ON public.matches(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_user ON public.saved_profiles(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON public.conversations(user_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON public.messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_direct_conv_p1 ON public.direct_conversations(participant_1, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_direct_conv_p2 ON public.direct_conversations(participant_2, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_direct_messages_conv ON public.direct_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_email ON public.transactions(email);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows(following_id);
CREATE INDEX IF NOT EXISTS idx_member_statuses_user ON public.member_statuses(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status, created_at DESC);
