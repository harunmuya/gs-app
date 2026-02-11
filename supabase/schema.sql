-- ============================================
-- Genuine Sugar Mummies App - Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  images TEXT[] DEFAULT ARRAY[]::TEXT[],  -- Profile photos
  bio TEXT DEFAULT '',
  interests TEXT[] DEFAULT ARRAY[]::TEXT[], -- Hobbies/Interests
  orientation TEXT, -- Sexual orientation
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User locations for geolocation matching
CREATE TABLE IF NOT EXISTS public.user_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User preferences
CREATE TABLE IF NOT EXISTS public.preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  min_age INTEGER DEFAULT 18,
  max_age INTEGER DEFAULT 60,
  max_distance_km INTEGER DEFAULT 100,
  gender_preference TEXT DEFAULT 'both', -- male, female, both
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Likes (swipe right)
CREATE TABLE IF NOT EXISTS public.likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  profile_wp_id INTEGER NOT NULL,
  profile_name TEXT,
  profile_image TEXT,
  profile_location TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, profile_wp_id)
);

-- Passes (swipe left)
CREATE TABLE IF NOT EXISTS public.passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  profile_wp_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, profile_wp_id)
);

-- Matches
CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  profile_wp_id INTEGER NOT NULL,
  profile_name TEXT,
  profile_image TEXT,
  profile_location TEXT,
  profile_bio TEXT,
  score DOUBLE PRECISION DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, profile_wp_id)
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own data
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can delete own profile" ON public.users
  FOR DELETE USING (auth.uid() = id);

CREATE POLICY "Users can view own location" ON public.user_locations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can upsert own location" ON public.user_locations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own location" ON public.user_locations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own preferences" ON public.preferences
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can upsert own preferences" ON public.preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own preferences" ON public.preferences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own likes" ON public.likes
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own likes" ON public.likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own passes" ON public.passes
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own passes" ON public.passes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own matches" ON public.matches
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own matches" ON public.matches
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own matches" ON public.matches
  FOR DELETE USING (auth.uid() = user_id);

-- Function to auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
  );
  INSERT INTO public.preferences (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
