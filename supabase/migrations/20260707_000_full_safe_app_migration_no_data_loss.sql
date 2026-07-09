-- Genuine Sugar Mummies app - full safe production migration.
-- Run this in Supabase SQL Editor for genuine-sugarmummies-app.
-- No DROP TABLE, TRUNCATE, or DELETE statements are used.
-- Existing clients remain in public.users; only missing columns/tables are added.

create extension if not exists pgcrypto;

create table if not exists public.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    created_at timestamptz not null default now()
);

alter table public.users add column if not exists created_at timestamptz default now();

alter table public.users
    add column if not exists auth_user_id uuid,
    add column if not exists username text,
    add column if not exists short_id text,
    add column if not exists display_name text,
    add column if not exists avatar_url text,
    add column if not exists photos text[] default '{}',
    add column if not exists bio text default '',
    add column if not exists description text default '',
    add column if not exists age integer,
    add column if not exists location text default '',
    add column if not exists country text default '',
    add column if not exists city text default '',
    add column if not exists latitude double precision,
    add column if not exists longitude double precision,
    add column if not exists geo_updated_at timestamptz,
    add column if not exists phone text default '',
    add column if not exists phone_number text default '',
    add column if not exists profile_label text default 'member',
    add column if not exists member_category text default 'member',
    add column if not exists looking_for text default '',
    add column if not exists intent_summary text default '',
    add column if not exists wants text default '',
    add column if not exists needed_qualities text default '',
    add column if not exists age_range_preference text default '',
    add column if not exists hobbies text[] default '{}',
    add column if not exists interests text[] default '{}',
    add column if not exists body_type text default '',
    add column if not exists gender text default '',
    add column if not exists preference text default '',
    add column if not exists preference_locked boolean default true,
    add column if not exists subscription_tier text default 'free',
    add column if not exists admin_approved boolean default false,
    add column if not exists package_locked boolean default false,
    add column if not exists package_expires_at timestamptz,
    add column if not exists phone_reveal_plan text default 'silver',
    add column if not exists verified boolean default false,
    add column if not exists verification_status text default 'unsubmitted',
    add column if not exists verification_selfie_url text default '',
    add column if not exists verification_document_url text default '',
    add column if not exists verification_document_type text default '',
    add column if not exists verification_phone text default '',
    add column if not exists verification_submitted_at timestamptz,
    add column if not exists verification_rejection_reason text default '',
    add column if not exists show_in_public boolean default true,
    add column if not exists is_seed_profile boolean default false,
    add column if not exists is_suspended boolean default false,
    add column if not exists is_banned boolean default false,
    add column if not exists is_live boolean default false,
    add column if not exists total_profile_views integer default 0,
    add column if not exists followers_count integer default 0,
    add column if not exists following_count integer default 0,
    add column if not exists gifts_received_count integer default 0,
    add column if not exists boost_started_at timestamptz,
    add column if not exists boost_expires_at timestamptz,
    add column if not exists boost_score integer not null default 0,
    add column if not exists password_hash text,
    add column if not exists password_updated_at timestamptz,
    add column if not exists updated_at timestamptz,
    add column if not exists last_seen_at timestamptz,
    add column if not exists last_seen timestamptz;

update public.users
set
    created_at = coalesce(created_at, now()),
    updated_at = coalesce(updated_at, now()),
    show_in_public = coalesce(show_in_public, true),
    subscription_tier = coalesce(nullif(subscription_tier, ''), 'free'),
    verification_status = coalesce(nullif(verification_status, ''), 'unsubmitted'),
    short_id = coalesce(nullif(short_id, ''), left(id::text, 8)),
    username = lower(
        regexp_replace(
            coalesce(nullif(username, ''), nullif(display_name, ''), nullif(split_part(email, '@', 1), ''), 'member_' || left(id::text, 8)),
            '[^a-zA-Z0-9_]+',
            '_',
            'g'
        )
    )
where
    username is null
    or username = ''
    or short_id is null
    or short_id = ''
    or show_in_public is null
    or created_at is null
    or updated_at is null
    or subscription_tier is null
    or verification_status is null;

with ranked as (
    select id, username, row_number() over (partition by lower(username) order by created_at nulls last, id) as rn
    from public.users
    where username is not null and username <> ''
)
update public.users u
set username = left(regexp_replace(u.username, '_+$', '') || '_' || left(u.id::text, 4), 60)
from ranked r
where u.id = r.id and r.rn > 1;

with ranked as (
    select id, short_id, row_number() over (partition by short_id order by created_at nulls last, id) as rn
    from public.users
    where short_id is not null and short_id <> ''
)
update public.users u
set short_id = left(u.id::text, 8)
from ranked r
where u.id = r.id and r.rn > 1;

create unique index if not exists users_username_lower_unique_idx on public.users (lower(username)) where username is not null and username <> '';
create unique index if not exists users_short_id_unique_idx on public.users (short_id) where short_id is not null and short_id <> '';
create index if not exists users_public_created_idx on public.users (show_in_public, created_at desc);
create index if not exists users_live_boost_idx on public.users (is_live, boost_expires_at desc, boost_score desc);
create index if not exists users_seed_public_idx on public.users (is_seed_profile, show_in_public);

create table if not exists public.package_tiers (
    id text primary key,
    name text not null,
    price_ksh integer not null default 0,
    badge_label text default '',
    features jsonb not null default '[]'::jsonb,
    phone_reveal boolean default false,
    daily_message_limit integer default 0,
    daily_gift_limit integer default 0,
    priority_visibility boolean default false,
    international_access boolean default false,
    voice_video_access boolean default false,
    sort_order integer default 0,
    active boolean default true,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

alter table public.package_tiers
    add column if not exists name text,
    add column if not exists price_ksh integer not null default 0,
    add column if not exists badge_label text default '',
    add column if not exists features jsonb not null default '[]'::jsonb,
    add column if not exists phone_reveal boolean default false,
    add column if not exists daily_message_limit integer default 0,
    add column if not exists daily_gift_limit integer default 0,
    add column if not exists priority_visibility boolean default false,
    add column if not exists international_access boolean default false,
    add column if not exists voice_video_access boolean default false,
    add column if not exists sort_order integer default 0,
    add column if not exists active boolean default true,
    add column if not exists created_at timestamptz default now(),
    add column if not exists updated_at timestamptz default now();

insert into public.package_tiers (id, name, price_ksh, badge_label, features, phone_reveal, daily_message_limit, daily_gift_limit, priority_visibility, international_access, voice_video_access, sort_order, active)
values
('free', 'Free Preview', 0, 'Start free', '["Create account instantly","Browse public members","Receive alerts","Submit badge verification"]'::jsonb, false, 3, 0, false, false, false, 0, true),
('basic', 'Basic Access', 650, 'Start messaging', '["30 messages daily","10 likes daily","5 super likes daily","Gift access Tier 1","One direct connection request","50 GS credits after activation"]'::jsonb, false, 30, 5, false, false, false, 10, true),
('silver', 'Silver Plus', 1200, 'Recommended', '["Unlimited messaging","Phone reveal","Voice and video calls","Voice notes and media chat","Go Live","24 hour stories","Profile boost","My likes, my views, followers","200 GS credits after activation"]'::jsonb, true, 0, 25, true, false, true, 20, true),
('gold', 'Gold Elite', 3550, 'Highest access', '["International profile access","Unlimited activity","Priority boosts","All gift tiers","Premium live reach","Gold profile badge","Fastest support","500 GS credits after activation"]'::jsonb, true, 0, 0, true, true, true, 30, true)
on conflict (id) do update set
    name = excluded.name,
    price_ksh = excluded.price_ksh,
    badge_label = excluded.badge_label,
    features = excluded.features,
    phone_reveal = excluded.phone_reveal,
    daily_message_limit = excluded.daily_message_limit,
    daily_gift_limit = excluded.daily_gift_limit,
    priority_visibility = excluded.priority_visibility,
    international_access = excluded.international_access,
    voice_video_access = excluded.voice_video_access,
    sort_order = excluded.sort_order,
    active = excluded.active,
    updated_at = now();

create table if not exists public.package_requests (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.users(id) on delete set null,
    email text,
    display_name text,
    tier text not null default 'basic',
    amount_ksh integer default 0,
    payment_reference text,
    note text,
    status text not null default 'pending',
    reviewed_at timestamptz,
    created_at timestamptz default now()
);

create table if not exists public.user_settings (
    user_id uuid primary key references public.users(id) on delete cascade,
    email_notifications boolean default true,
    live_notifications boolean default true,
    follow_notifications boolean default true,
    marketing_notifications boolean default true,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create table if not exists public.user_notifications (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.users(id) on delete cascade,
    type text default 'system',
    title text,
    body text,
    read boolean default false,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz default now()
);

create table if not exists public.support_tickets (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.users(id) on delete set null,
    subject text not null,
    body text,
    service text default 'general',
    status text default 'open',
    priority text default 'normal',
    closed_at timestamptz,
    created_at timestamptz default now()
);

create table if not exists public.ticket_responses (
    id uuid primary key default gen_random_uuid(),
    ticket_id uuid references public.support_tickets(id) on delete cascade,
    responder text default 'admin',
    body text not null,
    created_at timestamptz default now()
);

create table if not exists public.email_outbox (
    id uuid primary key default gen_random_uuid(),
    to_email text,
    subject text,
    body text,
    status text default 'queued',
    provider_response text,
    sent_at timestamptz,
    created_at timestamptz default now()
);

create table if not exists public.broadcasts (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    body text,
    target_segment text default 'all',
    status text default 'sent',
    created_at timestamptz default now()
);

create table if not exists public.admin_logs (
    id uuid primary key default gen_random_uuid(),
    action text not null,
    details jsonb default '{}'::jsonb,
    created_at timestamptz default now()
);

create table if not exists public.app_limits (
    id text primary key default 'global',
    daily_message_limit integer default 3,
    daily_gift_limit integer default 0,
    max_photos_per_user integer default 6,
    require_manual_verification boolean default false,
    ads_enabled boolean default true,
    updated_at timestamptz default now()
);

insert into public.app_limits (id) values ('global') on conflict (id) do nothing;

create table if not exists public.member_likes (
    id uuid primary key default gen_random_uuid(),
    liker_id uuid references public.users(id) on delete cascade,
    liked_id uuid references public.users(id) on delete cascade,
    profile_key text,
    profile_name text,
    profile_image text,
    action text default 'like',
    is_super_like boolean default false,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create table if not exists public.member_swipes (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.users(id) on delete cascade,
    target_id uuid references public.users(id) on delete cascade,
    direction text not null,
    created_at timestamptz default now()
);

create table if not exists public.member_saves (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.users(id) on delete cascade,
    saved_id uuid references public.users(id) on delete cascade,
    saved_key text,
    saved_name text,
    saved_image text,
    created_at timestamptz default now()
);

create table if not exists public.user_follows (
    id uuid primary key default gen_random_uuid(),
    follower_id uuid references public.users(id) on delete cascade,
    following_id uuid references public.users(id) on delete cascade,
    created_at timestamptz default now()
);

create table if not exists public.member_messages (
    id uuid primary key default gen_random_uuid(),
    member_id uuid references public.users(id) on delete set null,
    sender_key text,
    sender_name text,
    body text,
    attachment_url text,
    attachment_type text,
    attachment_name text,
    voice_url text,
    is_read boolean default false,
    created_at timestamptz default now()
);

create table if not exists public.member_gifts (
    id uuid primary key default gen_random_uuid(),
    member_id uuid references public.users(id) on delete set null,
    sender_key text,
    sender_name text,
    gift_name text,
    emoji text,
    message text,
    created_at timestamptz default now()
);

create table if not exists public.call_requests (
    id uuid primary key default gen_random_uuid(),
    member_id uuid references public.users(id) on delete set null,
    requester_key text,
    requester_name text,
    call_type text default 'voice',
    status text default 'pending',
    note text,
    created_at timestamptz default now()
);

create table if not exists public.conversations (
    id uuid primary key default gen_random_uuid(),
    user_one_id uuid references public.users(id) on delete cascade,
    user_two_id uuid references public.users(id) on delete cascade,
    status text default 'active',
    last_message_at timestamptz,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create table if not exists public.messages (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid references public.conversations(id) on delete cascade,
    sender_id uuid references public.users(id) on delete set null,
    receiver_id uuid references public.users(id) on delete set null,
    body text,
    message_type text default 'text',
    status text default 'sent',
    metadata jsonb default '{}'::jsonb,
    read_at timestamptz,
    delivered_at timestamptz,
    created_at timestamptz default now()
);

create table if not exists public.message_attachments (
    id uuid primary key default gen_random_uuid(),
    message_id uuid references public.messages(id) on delete cascade,
    file_url text not null,
    file_type text,
    file_name text,
    created_at timestamptz default now()
);

create table if not exists public.voice_notes (
    id uuid primary key default gen_random_uuid(),
    message_id uuid references public.messages(id) on delete cascade,
    user_id uuid references public.users(id) on delete set null,
    audio_url text not null,
    duration_seconds integer default 0,
    created_at timestamptz default now()
);

create table if not exists public.call_sessions (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid references public.conversations(id) on delete cascade,
    caller_id uuid references public.users(id) on delete set null,
    receiver_id uuid references public.users(id) on delete set null,
    call_type text default 'voice',
    status text default 'ringing',
    started_at timestamptz,
    ended_at timestamptz,
    created_at timestamptz default now()
);

create table if not exists public.call_signals (
    id uuid primary key default gen_random_uuid(),
    call_id uuid references public.call_sessions(id) on delete cascade,
    sender_id uuid references public.users(id) on delete set null,
    type text not null,
    payload jsonb default '{}'::jsonb,
    created_at timestamptz default now()
);

create table if not exists public.live_streams (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.users(id) on delete cascade,
    title text,
    status text default 'live',
    viewer_count integer default 0,
    like_count integer default 0,
    gift_count integer default 0,
    comment_count integer default 0,
    started_at timestamptz default now(),
    ended_at timestamptz,
    created_at timestamptz default now()
);

create table if not exists public.live_viewers (
    id uuid primary key default gen_random_uuid(),
    stream_id uuid references public.live_streams(id) on delete cascade,
    user_id uuid references public.users(id) on delete set null,
    viewer_key text,
    joined_at timestamptz default now(),
    left_at timestamptz,
    created_at timestamptz default now()
);

create table if not exists public.live_comments (
    id uuid primary key default gen_random_uuid(),
    stream_id uuid references public.live_streams(id) on delete cascade,
    user_id uuid references public.users(id) on delete set null,
    body text not null,
    created_at timestamptz default now()
);

create table if not exists public.live_gifts (
    id uuid primary key default gen_random_uuid(),
    stream_id uuid references public.live_streams(id) on delete cascade,
    sender_id uuid references public.users(id) on delete set null,
    gift_name text,
    emoji text,
    credits_spent integer default 0,
    created_at timestamptz default now()
);

create table if not exists public.gift_catalog (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    category text default 'Classic',
    gif_url text,
    icon_url text,
    credit_cost integer default 0,
    money_cost_ksh integer default 0,
    tier text default 'basic',
    emoji text,
    is_active boolean default true,
    sort_order integer default 0,
    created_at timestamptz default now()
);

alter table public.gift_catalog
    add column if not exists name text,
    add column if not exists category text default 'Classic',
    add column if not exists gif_url text,
    add column if not exists icon_url text,
    add column if not exists credit_cost integer default 0,
    add column if not exists money_cost_ksh integer default 0,
    add column if not exists tier text default 'basic',
    add column if not exists emoji text,
    add column if not exists is_active boolean default true,
    add column if not exists sort_order integer default 0,
    add column if not exists created_at timestamptz default now();

create table if not exists public.gift_wallet (
    user_id uuid primary key references public.users(id) on delete cascade,
    balance integer default 0,
    updated_at timestamptz default now()
);

create table if not exists public.credit_wallet (
    user_id uuid primary key references public.users(id) on delete cascade,
    balance integer default 0,
    updated_at timestamptz default now()
);

create table if not exists public.wallet_transactions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.users(id) on delete set null,
    wallet_type text default 'credit',
    direction text default 'credit',
    amount integer default 0,
    balance_after integer,
    source text default 'member',
    status text default 'pending',
    reference text,
    admin_note text,
    created_at timestamptz default now()
);

create table if not exists public.user_gift_inventory (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.users(id) on delete cascade,
    gift_id uuid references public.gift_catalog(id) on delete set null,
    quantity integer default 1,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

insert into public.gift_catalog (name, category, icon_url, credit_cost, tier, emoji, sort_order, is_active)
values
('Rose', 'Classic', '/gifts/rose.webp', 15, 'basic', 'Rose', 10, true),
('Coffee Date', 'Classic', '/gifts/coffee.webp', 25, 'basic', 'Coffee', 20, true),
('Gold Necklace', 'Luxury', '/gifts/gold-necklace.webp', 200, 'silver', 'Gold', 260, true),
('Golden Crown', 'Premium', '/gifts/golden-crown.webp', 299, 'gold', 'Crown', 280, true)
on conflict do nothing;

create table if not exists public.profile_views (
    id uuid primary key default gen_random_uuid(),
    viewed_id uuid references public.users(id) on delete cascade,
    viewer_id uuid references public.users(id) on delete set null,
    viewer_key text,
    source text default 'member',
    created_at timestamptz default now()
);

create table if not exists public.profile_boosts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.users(id) on delete cascade,
    tier text default 'silver',
    status text default 'active',
    source text default 'member',
    starts_at timestamptz default now(),
    expires_at timestamptz default (now() + interval '24 hours'),
    created_at timestamptz default now()
);

create table if not exists public.user_stories (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.users(id) on delete cascade,
    caption text,
    media_url text,
    media_type text default 'image',
    background text,
    status text default 'active',
    created_at timestamptz default now(),
    expires_at timestamptz default (now() + interval '24 hours')
);

create table if not exists public.story_views (
    id uuid primary key default gen_random_uuid(),
    story_id uuid references public.user_stories(id) on delete cascade,
    viewer_id uuid references public.users(id) on delete set null,
    viewer_key text,
    created_at timestamptz default now()
);

create table if not exists public.story_likes (
    id uuid primary key default gen_random_uuid(),
    story_id uuid references public.user_stories(id) on delete cascade,
    user_id uuid references public.users(id) on delete cascade,
    created_at timestamptz default now()
);

-- Repair columns if any feature table existed from a partial failed migration.
alter table public.package_requests add column if not exists amount_ksh integer default 0;
alter table public.package_requests add column if not exists payment_reference text;
alter table public.package_requests add column if not exists note text;
alter table public.package_requests add column if not exists reviewed_at timestamptz;
alter table public.package_requests add column if not exists created_at timestamptz default now();
alter table public.user_notifications add column if not exists metadata jsonb default '{}'::jsonb;
alter table public.user_notifications add column if not exists read boolean default false;
alter table public.user_notifications add column if not exists created_at timestamptz default now();
alter table public.support_tickets add column if not exists user_id uuid references public.users(id) on delete set null;
alter table public.support_tickets add column if not exists service text default 'general';
alter table public.support_tickets add column if not exists priority text default 'normal';
alter table public.support_tickets add column if not exists closed_at timestamptz;
alter table public.support_tickets add column if not exists created_at timestamptz default now();
alter table public.wallet_transactions add column if not exists admin_note text;
alter table public.wallet_transactions add column if not exists created_at timestamptz default now();
alter table public.member_likes add column if not exists liker_id uuid references public.users(id) on delete cascade;
alter table public.member_likes add column if not exists liked_id uuid references public.users(id) on delete cascade;
alter table public.member_likes add column if not exists is_super_like boolean default false;
alter table public.member_likes add column if not exists metadata jsonb default '{}'::jsonb;
alter table public.member_likes add column if not exists created_at timestamptz default now();
alter table public.user_follows add column if not exists follower_id uuid references public.users(id) on delete cascade;
alter table public.user_follows add column if not exists following_id uuid references public.users(id) on delete cascade;
alter table public.user_follows add column if not exists created_at timestamptz default now();
alter table public.live_streams add column if not exists viewer_count integer default 0;
alter table public.live_streams add column if not exists like_count integer default 0;
alter table public.live_streams add column if not exists gift_count integer default 0;
alter table public.live_streams add column if not exists comment_count integer default 0;
alter table public.live_streams add column if not exists started_at timestamptz default now();
alter table public.live_streams add column if not exists created_at timestamptz default now();
alter table public.profile_views add column if not exists viewed_id uuid references public.users(id) on delete cascade;
alter table public.profile_views add column if not exists viewer_id uuid references public.users(id) on delete set null;
alter table public.profile_views add column if not exists viewer_key text;
alter table public.profile_views add column if not exists source text default 'member';
alter table public.profile_views add column if not exists created_at timestamptz default now();
alter table public.profile_boosts add column if not exists user_id uuid references public.users(id) on delete cascade;
alter table public.profile_boosts add column if not exists status text default 'active';
alter table public.profile_boosts add column if not exists expires_at timestamptz default (now() + interval '24 hours');
alter table public.profile_boosts add column if not exists created_at timestamptz default now();
alter table public.user_stories add column if not exists user_id uuid references public.users(id) on delete cascade;
alter table public.user_stories add column if not exists media_url text;
alter table public.user_stories add column if not exists media_type text default 'image';
alter table public.user_stories add column if not exists status text default 'active';
alter table public.user_stories add column if not exists expires_at timestamptz default (now() + interval '24 hours');
alter table public.user_stories add column if not exists created_at timestamptz default now();
alter table public.story_views add column if not exists story_id uuid references public.user_stories(id) on delete cascade;
alter table public.story_views add column if not exists viewer_id uuid references public.users(id) on delete set null;
alter table public.story_views add column if not exists viewer_key text;
alter table public.story_views add column if not exists created_at timestamptz default now();
alter table public.story_likes add column if not exists story_id uuid references public.user_stories(id) on delete cascade;
alter table public.story_likes add column if not exists user_id uuid references public.users(id) on delete cascade;
alter table public.story_likes add column if not exists created_at timestamptz default now();

create index if not exists package_requests_status_created_idx on public.package_requests (status, created_at desc);
create index if not exists user_notifications_user_created_idx on public.user_notifications (user_id, created_at desc);
create index if not exists support_tickets_status_created_idx on public.support_tickets (status, created_at desc);
create index if not exists member_likes_liked_created_idx on public.member_likes (liked_id, created_at desc);
create index if not exists member_likes_liker_created_idx on public.member_likes (liker_id, created_at desc);
create index if not exists user_follows_follower_created_idx on public.user_follows (follower_id, created_at desc);
create index if not exists user_follows_following_created_idx on public.user_follows (following_id, created_at desc);
create index if not exists messages_conversation_created_idx on public.messages (conversation_id, created_at desc);
create index if not exists live_streams_status_started_idx on public.live_streams (status, started_at desc);
create index if not exists live_comments_stream_created_idx on public.live_comments (stream_id, created_at desc);
create index if not exists live_gifts_stream_created_idx on public.live_gifts (stream_id, created_at desc);
create index if not exists wallet_transactions_user_created_idx on public.wallet_transactions (user_id, created_at desc);
create index if not exists profile_views_viewed_created_idx on public.profile_views (viewed_id, created_at desc);
create index if not exists profile_boosts_user_created_idx on public.profile_boosts (user_id, created_at desc);
create index if not exists user_stories_active_created_idx on public.user_stories (status, expires_at desc, created_at desc);
create index if not exists story_views_story_created_idx on public.story_views (story_id, created_at desc);
create index if not exists story_likes_story_created_idx on public.story_likes (story_id, created_at desc);

do $$
begin
    if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'user_follows_unique_pair_idx')
       and not exists (
           select 1 from (
               select follower_id, following_id, count(*)
               from public.user_follows
               where follower_id is not null and following_id is not null
               group by follower_id, following_id
               having count(*) > 1
           ) duplicates
       ) then
        create unique index user_follows_unique_pair_idx on public.user_follows (follower_id, following_id);
    end if;
end $$;

do $$
declare t text;
begin
    foreach t in array array[
        'users','package_tiers','package_requests','user_settings','user_notifications',
        'support_tickets','ticket_responses','email_outbox','broadcasts','admin_logs',
        'app_limits','member_likes','member_swipes','member_saves','user_follows',
        'member_messages','member_gifts','call_requests','conversations','messages',
        'message_attachments','voice_notes','call_sessions','call_signals','live_streams',
        'live_viewers','live_comments','live_gifts','gift_catalog','gift_wallet',
        'credit_wallet','wallet_transactions','user_gift_inventory','profile_views',
        'profile_boosts','user_stories','story_views','story_likes'
    ] loop
        execute format('alter table public.%I enable row level security', t);
        execute format('drop policy if exists "app all %s" on public.%I', t, t);
        execute format('create policy "app all %s" on public.%I for all using (true) with check (true)', t, t);
    end loop;
end $$;

insert into storage.buckets (id, name, public)
values
    ('profile-media', 'profile-media', true),
    ('story-media', 'story-media', true),
    ('message-attachments', 'message-attachments', true),
    ('gift-assets', 'gift-assets', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "GS public media read" on storage.objects;
create policy "GS public media read"
on storage.objects for select
using (bucket_id in ('profile-media', 'story-media', 'message-attachments', 'gift-assets'));

drop policy if exists "GS authenticated media insert" on storage.objects;
create policy "GS authenticated media insert"
on storage.objects for insert
with check (bucket_id in ('profile-media', 'story-media', 'message-attachments', 'gift-assets'));

-- Mark only known seeded profiles. Real client users are not converted into seed users.
update public.users
set is_seed_profile = true, admin_approved = true, show_in_public = true
where email like 'seed+%@genuinesugarmummies.com'
   or email like 'seed+%@genuinesugarmummies.co.ke';

-- Keep existing real accounts visible after migration unless they were explicitly banned.
update public.users
set show_in_public = true
where coalesce(is_banned, false) = false
  and show_in_public is distinct from true;
