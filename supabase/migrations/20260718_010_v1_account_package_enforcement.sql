-- V1 account/package enforcement hardening.
-- Safe for production: additive schema changes plus package tier metadata updates only.

create extension if not exists pgcrypto;

alter table if exists public.users
    add column if not exists is_banned boolean not null default false,
    add column if not exists is_suspended boolean not null default false,
    add column if not exists account_deleted_at timestamptz,
    add column if not exists show_in_public boolean not null default true,
    add column if not exists admin_approved boolean not null default true,
    add column if not exists package_locked boolean not null default false,
    add column if not exists package_expires_at timestamptz,
    add column if not exists phone_reveal_plan text,
    add column if not exists auth_user_id uuid,
    add column if not exists updated_at timestamptz not null default now();

update public.users
set
    show_in_public = false,
    updated_at = now()
where coalesce(is_banned, false) = true
   or coalesce(is_suspended, false) = true
   or account_deleted_at is not null;

create table if not exists public.account_deletions (
    email_hash text primary key,
    user_id text,
    deleted_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);

alter table public.account_deletions enable row level security;
revoke all on table public.account_deletions from anon, authenticated;
grant all on table public.account_deletions to service_role;

create index if not exists users_access_status_idx
    on public.users (is_banned, is_suspended, show_in_public, package_locked);

create table if not exists public.package_tiers (
    id text primary key,
    name text not null,
    price_ksh integer not null default 0,
    sort_order integer not null default 0,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

alter table public.package_tiers
    add column if not exists phone_reveal boolean not null default false,
    add column if not exists daily_message_limit integer not null default 0,
    add column if not exists daily_gift_limit integer not null default 0,
    add column if not exists daily_like_limit integer not null default 0,
    add column if not exists daily_super_like_limit integer not null default 0,
    add column if not exists daily_swipe_limit integer not null default 0,
    add column if not exists daily_profile_view_limit integer not null default 0,
    add column if not exists priority_visibility boolean not null default false,
    add column if not exists international_access boolean not null default false,
    add column if not exists voice_video_access boolean not null default false,
    add column if not exists can_see_who_liked boolean not null default false,
    add column if not exists can_see_who_viewed boolean not null default false,
    add column if not exists can_send_voice_notes boolean not null default false,
    add column if not exists can_send_images boolean not null default false,
    add column if not exists can_go_live boolean not null default false,
    add column if not exists can_send_gifts boolean not null default false,
    add column if not exists can_use_nearby boolean not null default false,
    add column if not exists max_gift_tier integer not null default 0,
    add column if not exists starting_credits integer not null default 0,
    add column if not exists features jsonb not null default '[]'::jsonb,
    add column if not exists badge_label text not null default '',
    add column if not exists badge_color text not null default '',
    add column if not exists description text not null default '',
    add column if not exists updated_at timestamptz not null default now();

insert into public.package_tiers (
    id, name, price_ksh, sort_order, is_active, phone_reveal,
    daily_message_limit, daily_gift_limit, daily_like_limit, daily_super_like_limit,
    daily_swipe_limit, daily_profile_view_limit, priority_visibility, international_access,
    voice_video_access, can_see_who_liked, can_see_who_viewed, can_send_voice_notes,
    can_send_images, can_go_live, can_send_gifts, can_use_nearby, max_gift_tier,
    starting_credits, badge_label, badge_color, description, features, updated_at
)
values
    ('free', 'Free', 0, 0, true, false, 5, 0, 5, 0, 10, 10, false, false, false, false, false, false, false, false, false, false, 0, 0, 'Free', '#6b7280', 'Basic browsing with strict daily limits.', '[]'::jsonb, now()),
    ('basic', 'Basic', 650, 10, true, false, 0, 10, 20, 5, 30, 30, false, false, false, false, false, false, true, false, true, false, 1, 50, 'Basic', '#2563eb', 'Unlimited messages, images, gifts, and stronger daily limits.', '["unlimited_messages","image_messages","gifts","higher_daily_limits"]'::jsonb, now()),
    ('silver', 'Silver Recommended', 1200, 20, true, true, 0, 50, 50, 100, 0, 0, true, false, true, true, true, true, true, true, true, true, 3, 200, 'Recommended', '#c026d3', 'Phone reveal, calls, live, activity insights, and priority visibility.', '["phone_reveal","calls","voice_notes","live","who_liked","who_viewed","nearby"]'::jsonb, now()),
    ('gold', 'Gold International', 3550, 30, true, true, 0, 0, 0, 0, 0, 0, true, true, true, true, true, true, true, true, true, true, 4, 500, 'International', '#ca8a04', 'Full international access with unlimited daily usage.', '["international","unlimited_usage","top_gifts","priority_visibility"]'::jsonb, now())
on conflict (id) do update set
    name = excluded.name,
    price_ksh = excluded.price_ksh,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active,
    phone_reveal = excluded.phone_reveal,
    daily_message_limit = excluded.daily_message_limit,
    daily_gift_limit = excluded.daily_gift_limit,
    daily_like_limit = excluded.daily_like_limit,
    daily_super_like_limit = excluded.daily_super_like_limit,
    daily_swipe_limit = excluded.daily_swipe_limit,
    daily_profile_view_limit = excluded.daily_profile_view_limit,
    priority_visibility = excluded.priority_visibility,
    international_access = excluded.international_access,
    voice_video_access = excluded.voice_video_access,
    can_see_who_liked = excluded.can_see_who_liked,
    can_see_who_viewed = excluded.can_see_who_viewed,
    can_send_voice_notes = excluded.can_send_voice_notes,
    can_send_images = excluded.can_send_images,
    can_go_live = excluded.can_go_live,
    can_send_gifts = excluded.can_send_gifts,
    can_use_nearby = excluded.can_use_nearby,
    max_gift_tier = excluded.max_gift_tier,
    starting_credits = excluded.starting_credits,
    badge_label = excluded.badge_label,
    badge_color = excluded.badge_color,
    description = excluded.description,
    features = excluded.features,
    updated_at = now();
