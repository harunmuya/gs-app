-- Restore Members visibility after the stricter settings sync hid older/incomplete profiles.
-- Safe for existing clients: no accounts are deleted. Banned/suspended users stay hidden.

create extension if not exists pgcrypto;

create table if not exists public.user_settings (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.users(id) on delete cascade,
    notifications boolean not null default true,
    email_notifications boolean not null default false,
    dark_mode boolean not null default false,
    show_online boolean not null default true,
    show_age boolean not null default true,
    is_public boolean not null default true,
    live_location boolean not null default false,
    location_enabled boolean not null default false,
    push_token text,
    push_platform text,
    notification_permission text default 'default',
    preferences jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(user_id)
);

alter table public.users
    add column if not exists show_in_public boolean not null default true,
    add column if not exists is_banned boolean not null default false,
    add column if not exists is_suspended boolean not null default false,
    add column if not exists updated_at timestamptz not null default now();

insert into public.user_settings (user_id, notifications, email_notifications, dark_mode, show_online, show_age, is_public, live_location, location_enabled, updated_at)
select id, true, false, false, true, true, true, false, false, now()
from public.users
where id is not null
on conflict (user_id) do nothing;

update public.users u
set show_in_public = true,
    updated_at = now()
from public.user_settings s
where s.user_id = u.id
  and s.is_public = true
  and coalesce(u.is_banned, false) = false
  and coalesce(u.is_suspended, false) = false;

update public.users u
set show_in_public = false,
    updated_at = now()
from public.user_settings s
where s.user_id = u.id
  and s.is_public = false;

update public.users
set show_in_public = false,
    updated_at = now()
where coalesce(is_banned, false) = true
   or coalesce(is_suspended, false) = true;

create index if not exists users_members_visibility_idx
    on public.users (show_in_public, is_banned, is_suspended);
