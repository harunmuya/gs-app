-- GS app production repair: RLS, profile photos, auth, and admin tables.
-- Safe to run more than once. Does not delete, truncate, or overwrite existing users.

create extension if not exists pgcrypto;

create table if not exists public.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    created_at timestamptz default now()
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
    add column if not exists phone text default '',
    add column if not exists phone_number text default '',
    add column if not exists profile_label text default 'member',
    add column if not exists member_category text default 'member',
    add column if not exists looking_for text default '',
    add column if not exists wants text default '',
    add column if not exists needed_qualities text default '',
    add column if not exists age_range_preference text default '',
    add column if not exists subscription_tier text default 'free',
    add column if not exists admin_approved boolean default true,
    add column if not exists package_locked boolean default false,
    add column if not exists package_expires_at timestamptz,
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
    add column if not exists password_hash text,
    add column if not exists password_updated_at timestamptz,
    add column if not exists updated_at timestamptz,
    add column if not exists last_seen_at timestamptz,
    add column if not exists last_seen timestamptz,
    add column if not exists boost_started_at timestamptz,
    add column if not exists boost_expires_at timestamptz,
    add column if not exists boost_score integer default 0;

update public.users
set
    created_at = coalesce(created_at, now()),
    updated_at = coalesce(updated_at, now()),
    show_in_public = coalesce(show_in_public, true),
    admin_approved = coalesce(admin_approved, true),
    subscription_tier = coalesce(nullif(subscription_tier, ''), 'free'),
    verification_status = coalesce(nullif(verification_status, ''), 'unsubmitted'),
    short_id = coalesce(nullif(short_id, ''), left(id::text, 8)),
    username = lower(regexp_replace(coalesce(nullif(username, ''), nullif(display_name, ''), split_part(email, '@', 1), 'member_' || left(id::text, 8)), '[^a-zA-Z0-9_]+', '_', 'g'))
where username is null
   or username = ''
   or short_id is null
   or short_id = ''
   or show_in_public is null
   or admin_approved is null
   or created_at is null
   or updated_at is null;

create table if not exists public.user_settings (
    user_id uuid primary key references public.users(id) on delete cascade,
    notifications boolean default true,
    email_notifications boolean default false,
    dark_mode boolean default false,
    show_online boolean default true,
    show_age boolean default true,
    is_public boolean default true,
    live_location boolean default false,
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
    read_at timestamptz,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz default now()
);

create table if not exists public.password_reset_codes (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.users(id) on delete cascade,
    email text not null,
    code_hash text not null,
    expires_at timestamptz not null,
    used_at timestamptz,
    created_at timestamptz default now()
);

create table if not exists public.package_requests (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.users(id) on delete set null,
    email text,
    display_name text,
    tier text default 'basic',
    amount_ksh integer default 0,
    status text default 'pending',
    payment_reference text,
    note text,
    admin_note text,
    reviewed_at timestamptz,
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

create table if not exists public.profile_views (
    id uuid primary key default gen_random_uuid(),
    viewed_id uuid references public.users(id) on delete cascade,
    viewer_id uuid references public.users(id) on delete set null,
    viewer_key text,
    source text default 'member',
    created_at timestamptz default now()
);

create table if not exists public.user_follows (
    id uuid primary key default gen_random_uuid(),
    follower_id uuid references public.users(id) on delete cascade,
    following_id uuid references public.users(id) on delete cascade,
    created_at timestamptz default now()
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

-- Add columns for partially-created tables.
alter table public.user_settings add column if not exists email_notifications boolean default false;
alter table public.user_settings add column if not exists dark_mode boolean default false;
alter table public.user_settings add column if not exists show_online boolean default true;
alter table public.user_settings add column if not exists show_age boolean default true;
alter table public.user_settings add column if not exists is_public boolean default true;
alter table public.user_settings add column if not exists live_location boolean default false;
alter table public.user_settings add column if not exists updated_at timestamptz default now();
alter table public.user_notifications add column if not exists type text default 'system';
alter table public.user_notifications add column if not exists title text;
alter table public.user_notifications add column if not exists body text;
alter table public.user_notifications add column if not exists read boolean default false;
alter table public.user_notifications add column if not exists metadata jsonb default '{}'::jsonb;
alter table public.user_notifications add column if not exists read_at timestamptz;
alter table public.user_notifications add column if not exists created_at timestamptz default now();
alter table public.password_reset_codes add column if not exists user_id uuid references public.users(id) on delete cascade;
alter table public.password_reset_codes add column if not exists email text;
alter table public.password_reset_codes add column if not exists code_hash text;
alter table public.password_reset_codes add column if not exists expires_at timestamptz;
alter table public.password_reset_codes add column if not exists used_at timestamptz;
alter table public.password_reset_codes add column if not exists created_at timestamptz default now();
alter table public.package_requests add column if not exists user_id uuid references public.users(id) on delete set null;
alter table public.package_requests add column if not exists email text;
alter table public.package_requests add column if not exists display_name text;
alter table public.package_requests add column if not exists tier text default 'basic';
alter table public.package_requests add column if not exists amount_ksh integer default 0;
alter table public.package_requests add column if not exists status text default 'pending';
alter table public.package_requests add column if not exists payment_reference text;
alter table public.package_requests add column if not exists note text;
alter table public.package_requests add column if not exists admin_note text;
alter table public.package_requests add column if not exists reviewed_at timestamptz;
alter table public.package_requests add column if not exists created_at timestamptz default now();
alter table public.support_tickets add column if not exists user_id uuid references public.users(id) on delete set null;
alter table public.support_tickets add column if not exists subject text;
alter table public.support_tickets add column if not exists body text;
alter table public.support_tickets add column if not exists service text default 'general';
alter table public.support_tickets add column if not exists status text default 'open';
alter table public.support_tickets add column if not exists priority text default 'normal';
alter table public.support_tickets add column if not exists closed_at timestamptz;
alter table public.support_tickets add column if not exists created_at timestamptz default now();
alter table public.ticket_responses add column if not exists ticket_id uuid references public.support_tickets(id) on delete cascade;
alter table public.ticket_responses add column if not exists responder text default 'admin';
alter table public.ticket_responses add column if not exists body text;
alter table public.ticket_responses add column if not exists created_at timestamptz default now();
alter table public.email_outbox add column if not exists to_email text;
alter table public.email_outbox add column if not exists subject text;
alter table public.email_outbox add column if not exists body text;
alter table public.email_outbox add column if not exists status text default 'queued';
alter table public.email_outbox add column if not exists provider_response text;
alter table public.email_outbox add column if not exists sent_at timestamptz;
alter table public.email_outbox add column if not exists created_at timestamptz default now();
alter table public.broadcasts add column if not exists title text;
alter table public.broadcasts add column if not exists body text;
alter table public.broadcasts add column if not exists target_segment text default 'all';
alter table public.broadcasts add column if not exists status text default 'sent';
alter table public.broadcasts add column if not exists created_at timestamptz default now();
alter table public.admin_logs add column if not exists action text;
alter table public.admin_logs add column if not exists details jsonb default '{}'::jsonb;
alter table public.admin_logs add column if not exists created_at timestamptz default now();
alter table public.member_messages add column if not exists member_id uuid references public.users(id) on delete set null;
alter table public.member_messages add column if not exists sender_key text;
alter table public.member_messages add column if not exists sender_name text;
alter table public.member_messages add column if not exists body text;
alter table public.member_messages add column if not exists attachment_url text;
alter table public.member_messages add column if not exists attachment_type text;
alter table public.member_messages add column if not exists attachment_name text;
alter table public.member_messages add column if not exists voice_url text;
alter table public.member_messages add column if not exists is_read boolean default false;
alter table public.member_messages add column if not exists created_at timestamptz default now();
alter table public.member_gifts add column if not exists member_id uuid references public.users(id) on delete set null;
alter table public.member_gifts add column if not exists sender_key text;
alter table public.member_gifts add column if not exists sender_name text;
alter table public.member_gifts add column if not exists gift_name text;
alter table public.member_gifts add column if not exists emoji text;
alter table public.member_gifts add column if not exists message text;
alter table public.member_gifts add column if not exists created_at timestamptz default now();
alter table public.call_requests add column if not exists member_id uuid references public.users(id) on delete set null;
alter table public.call_requests add column if not exists requester_key text;
alter table public.call_requests add column if not exists requester_name text;
alter table public.call_requests add column if not exists call_type text default 'voice';
alter table public.call_requests add column if not exists status text default 'pending';
alter table public.call_requests add column if not exists note text;
alter table public.call_requests add column if not exists created_at timestamptz default now();
alter table public.wallet_transactions add column if not exists user_id uuid references public.users(id) on delete set null;
alter table public.wallet_transactions add column if not exists wallet_type text default 'credit';
alter table public.wallet_transactions add column if not exists direction text default 'credit';
alter table public.wallet_transactions add column if not exists amount integer default 0;
alter table public.wallet_transactions add column if not exists balance_after integer;
alter table public.wallet_transactions add column if not exists source text default 'member';
alter table public.wallet_transactions add column if not exists status text default 'pending';
alter table public.wallet_transactions add column if not exists reference text;
alter table public.wallet_transactions add column if not exists admin_note text;
alter table public.wallet_transactions add column if not exists created_at timestamptz default now();

create index if not exists users_email_idx on public.users (email);
create index if not exists users_public_idx on public.users (show_in_public, created_at desc);
create index if not exists notifications_user_created_idx on public.user_notifications (user_id, created_at desc);
create index if not exists package_requests_status_idx on public.package_requests (status, created_at desc);
create index if not exists support_tickets_status_idx on public.support_tickets (status, created_at desc);
create index if not exists profile_views_viewed_idx on public.profile_views (viewed_id, created_at desc);

do $$
declare t text;
begin
    foreach t in array array[
        'users','user_settings','user_notifications','password_reset_codes',
        'package_requests','support_tickets','ticket_responses','email_outbox',
        'broadcasts','admin_logs','app_limits','member_messages','member_gifts',
        'call_requests','profile_views','user_follows','wallet_transactions','gift_catalog'
    ] loop
        execute format('alter table public.%I enable row level security', t);
        execute format('drop policy if exists "gs app service access %s" on public.%I', t, t);
        execute format('create policy "gs app service access %s" on public.%I for all using (true) with check (true)', t, t);
    end loop;
end $$;

insert into storage.buckets (id, name, public)
values
    ('profile-media', 'profile-media', true),
    ('story-media', 'story-media', true),
    ('message-attachments', 'message-attachments', true),
    ('gift-assets', 'gift-assets', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "GS app public media read" on storage.objects;
create policy "GS app public media read"
on storage.objects for select
using (bucket_id in ('profile-media', 'story-media', 'message-attachments', 'gift-assets'));

drop policy if exists "GS app media upload" on storage.objects;
create policy "GS app media upload"
on storage.objects for insert
with check (bucket_id in ('profile-media', 'story-media', 'message-attachments', 'gift-assets'));

drop policy if exists "GS app media update" on storage.objects;
create policy "GS app media update"
on storage.objects for update
using (bucket_id in ('profile-media', 'story-media', 'message-attachments', 'gift-assets'))
with check (bucket_id in ('profile-media', 'story-media', 'message-attachments', 'gift-assets'));
