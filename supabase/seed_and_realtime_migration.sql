-- ============================================================
-- GenuineSugarmummies App — Seed Data & Realtime Migration
-- Run in Supabase Dashboard > SQL Editor
-- All statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
-- Safe to run multiple times
-- ============================================================

-- ==============================
-- 1. Add new columns to users table
-- ==============================
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_seed BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Kenya';


-- ==============================
-- 2. Direct Conversations (1-to-1 messaging)
-- ==============================
CREATE TABLE IF NOT EXISTS public.direct_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_1 UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    participant_2 UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    last_message TEXT DEFAULT '',
    last_message_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.direct_conversations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to make script re-runnable
DROP POLICY IF EXISTS "dc_select_participants" ON public.direct_conversations;
DROP POLICY IF EXISTS "dc_insert_participants" ON public.direct_conversations;
DROP POLICY IF EXISTS "dc_update_participants" ON public.direct_conversations;

CREATE POLICY "dc_select_participants" ON public.direct_conversations
    FOR SELECT USING (
        auth.uid() = participant_1 OR auth.uid() = participant_2
    );

CREATE POLICY "dc_insert_participants" ON public.direct_conversations
    FOR INSERT WITH CHECK (
        auth.uid() = participant_1 OR auth.uid() = participant_2
    );

CREATE POLICY "dc_update_participants" ON public.direct_conversations
    FOR UPDATE USING (
        auth.uid() = participant_1 OR auth.uid() = participant_2
    );


-- ==============================
-- 3. Direct Messages
-- ==============================
CREATE TABLE IF NOT EXISTS public.direct_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.direct_conversations(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text',
    media_url TEXT,
    media_duration INTEGER,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to make script re-runnable
DROP POLICY IF EXISTS "dm_select_conversation_participants" ON public.direct_messages;
DROP POLICY IF EXISTS "dm_insert_conversation_participants" ON public.direct_messages;
DROP POLICY IF EXISTS "dm_update_conversation_participants" ON public.direct_messages;

CREATE POLICY "dm_select_conversation_participants" ON public.direct_messages
    FOR SELECT USING (
        conversation_id IN (
            SELECT id FROM public.direct_conversations
            WHERE participant_1 = auth.uid() OR participant_2 = auth.uid()
        )
    );

CREATE POLICY "dm_insert_conversation_participants" ON public.direct_messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id
        AND conversation_id IN (
            SELECT id FROM public.direct_conversations
            WHERE participant_1 = auth.uid() OR participant_2 = auth.uid()
        )
    );

CREATE POLICY "dm_update_conversation_participants" ON public.direct_messages
    FOR UPDATE USING (
        conversation_id IN (
            SELECT id FROM public.direct_conversations
            WHERE participant_1 = auth.uid() OR participant_2 = auth.uid()
        )
    );


-- ==============================
-- 4. Member Statuses (Stories / 24-hour statuses)
-- ==============================
CREATE TABLE IF NOT EXISTS public.member_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    content TEXT,
    media_url TEXT,
    media_type TEXT DEFAULT 'text',
    background_color TEXT DEFAULT '#FF5A5F',
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ DEFAULT (now() + interval '24 hours')
);

ALTER TABLE public.member_statuses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to make script re-runnable
DROP POLICY IF EXISTS "statuses_select_all" ON public.member_statuses;
DROP POLICY IF EXISTS "statuses_insert_own" ON public.member_statuses;
DROP POLICY IF EXISTS "statuses_delete_own" ON public.member_statuses;
DROP POLICY IF EXISTS "statuses_update_own" ON public.member_statuses;

-- Anyone can view statuses
CREATE POLICY "statuses_select_all" ON public.member_statuses
    FOR SELECT USING (true);

-- Users can insert their own statuses
CREATE POLICY "statuses_insert_own" ON public.member_statuses
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own statuses
CREATE POLICY "statuses_delete_own" ON public.member_statuses
    FOR DELETE USING (auth.uid() = user_id);

-- Users can update their own statuses (e.g., view_count)
CREATE POLICY "statuses_update_own" ON public.member_statuses
    FOR UPDATE USING (auth.uid() = user_id);


-- ==============================
-- 5. Status Views
-- ==============================
CREATE TABLE IF NOT EXISTS public.status_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status_id UUID REFERENCES public.member_statuses(id) ON DELETE CASCADE NOT NULL,
    viewer_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    viewed_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(status_id, viewer_id)
);

ALTER TABLE public.status_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "status_views_select" ON public.status_views;
DROP POLICY IF EXISTS "status_views_insert" ON public.status_views;

-- Status owners can see who viewed; viewers can see their own views
CREATE POLICY "status_views_select" ON public.status_views
    FOR SELECT USING (
        auth.uid() = viewer_id
        OR status_id IN (
            SELECT id FROM public.member_statuses WHERE user_id = auth.uid()
        )
    );

-- Authenticated users can record their own views
CREATE POLICY "status_views_insert" ON public.status_views
    FOR INSERT WITH CHECK (auth.uid() = viewer_id);


-- ==============================
-- 6. Status Reactions
-- ==============================
CREATE TABLE IF NOT EXISTS public.status_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status_id UUID REFERENCES public.member_statuses(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    reaction TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(status_id, user_id)
);

ALTER TABLE public.status_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "status_reactions_select" ON public.status_reactions;
DROP POLICY IF EXISTS "status_reactions_insert" ON public.status_reactions;
DROP POLICY IF EXISTS "status_reactions_delete" ON public.status_reactions;

-- Anyone can see reactions
CREATE POLICY "status_reactions_select" ON public.status_reactions
    FOR SELECT USING (true);

-- Users can add their own reactions
CREATE POLICY "status_reactions_insert" ON public.status_reactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can remove their own reactions
CREATE POLICY "status_reactions_delete" ON public.status_reactions
    FOR DELETE USING (auth.uid() = user_id);


-- ==============================
-- 7. Call Logs
-- ==============================
CREATE TABLE IF NOT EXISTS public.call_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caller_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    receiver_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    call_type TEXT DEFAULT 'voice' CHECK (call_type IN ('voice', 'video')),
    status TEXT DEFAULT 'missed' CHECK (status IN ('missed', 'answered', 'declined', 'busy', 'no_answer')),
    duration INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "call_logs_select_own" ON public.call_logs;
DROP POLICY IF EXISTS "call_logs_insert_own" ON public.call_logs;

-- Users can view their own call logs (as caller or receiver)
CREATE POLICY "call_logs_select_own" ON public.call_logs
    FOR SELECT USING (
        auth.uid() = caller_id OR auth.uid() = receiver_id
    );

-- Users can insert call logs where they are the caller
CREATE POLICY "call_logs_insert_own" ON public.call_logs
    FOR INSERT WITH CHECK (auth.uid() = caller_id);


-- ==============================
-- 8. Enable Supabase Realtime for direct_messages
-- ==============================
-- NOTE: This may fail if the table is already in the publication.
-- That is safe — Supabase will just skip it.
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
    EXCEPTION
        WHEN duplicate_object THEN
            RAISE NOTICE 'direct_messages already in supabase_realtime publication';
    END;
END $$;

-- Also add direct_conversations for real-time conversation list updates
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_conversations;
    EXCEPTION
        WHEN duplicate_object THEN
            RAISE NOTICE 'direct_conversations already in supabase_realtime publication';
    END;
END $$;

-- Also add member_statuses for real-time status updates
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.member_statuses;
    EXCEPTION
        WHEN duplicate_object THEN
            RAISE NOTICE 'member_statuses already in supabase_realtime publication';
    END;
END $$;


-- ==============================
-- 9. Auto-update last_message_at on direct_conversations
-- ==============================
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.direct_conversations
    SET last_message = NEW.content,
        last_message_at = NEW.created_at
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_direct_message_insert ON public.direct_messages;
CREATE TRIGGER on_direct_message_insert
    AFTER INSERT ON public.direct_messages
    FOR EACH ROW EXECUTE FUNCTION public.update_conversation_last_message();


-- ==============================
-- 10. Auto-increment view_count on member_statuses
-- ==============================
CREATE OR REPLACE FUNCTION public.increment_status_view_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.member_statuses
    SET view_count = view_count + 1
    WHERE id = NEW.status_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_status_view_insert ON public.status_views;
CREATE TRIGGER on_status_view_insert
    AFTER INSERT ON public.status_views
    FOR EACH ROW EXECUTE FUNCTION public.increment_status_view_count();


-- ==============================
-- 11. Performance Indexes
-- ==============================

-- Direct Conversations
CREATE INDEX IF NOT EXISTS idx_dc_participant_1 ON public.direct_conversations(participant_1);
CREATE INDEX IF NOT EXISTS idx_dc_participant_2 ON public.direct_conversations(participant_2);
CREATE INDEX IF NOT EXISTS idx_dc_last_message_at ON public.direct_conversations(last_message_at DESC);

-- Direct Messages
CREATE INDEX IF NOT EXISTS idx_dm_conversation_id ON public.direct_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_dm_sender_id ON public.direct_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_dm_created_at ON public.direct_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_is_read ON public.direct_messages(is_read) WHERE is_read = false;

-- Member Statuses
CREATE INDEX IF NOT EXISTS idx_statuses_user_id ON public.member_statuses(user_id);
CREATE INDEX IF NOT EXISTS idx_statuses_expires_at ON public.member_statuses(expires_at);
CREATE INDEX IF NOT EXISTS idx_statuses_created_at ON public.member_statuses(created_at DESC);

-- Status Views
CREATE INDEX IF NOT EXISTS idx_status_views_status_id ON public.status_views(status_id);
CREATE INDEX IF NOT EXISTS idx_status_views_viewer_id ON public.status_views(viewer_id);

-- Status Reactions
CREATE INDEX IF NOT EXISTS idx_status_reactions_status_id ON public.status_reactions(status_id);
CREATE INDEX IF NOT EXISTS idx_status_reactions_user_id ON public.status_reactions(user_id);

-- Call Logs
CREATE INDEX IF NOT EXISTS idx_call_logs_caller_id ON public.call_logs(caller_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_receiver_id ON public.call_logs(receiver_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_created_at ON public.call_logs(created_at DESC);

-- Users (seed & country)
CREATE INDEX IF NOT EXISTS idx_users_is_seed ON public.users(is_seed) WHERE is_seed = true;
CREATE INDEX IF NOT EXISTS idx_users_country ON public.users(country);
CREATE INDEX IF NOT EXISTS idx_users_gender ON public.users(gender);
CREATE INDEX IF NOT EXISTS idx_users_looking_for ON public.users(looking_for);


-- ============================================================
-- Migration complete!
-- Tables created: direct_conversations, direct_messages,
--   member_statuses, status_views, status_reactions, call_logs
-- Columns added to users: is_seed, country
-- Realtime enabled for: direct_messages, direct_conversations,
--   member_statuses
-- ============================================================
