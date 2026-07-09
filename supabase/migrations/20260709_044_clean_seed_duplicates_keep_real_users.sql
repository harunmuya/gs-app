-- Clean duplicate/no-image seeded profiles without losing real users.
-- This only targets rows already identified as seed/fake by flags, seed emails, or seed media paths.
-- Real client accounts are restored/kept public when their Public Profile setting is on.

create extension if not exists pgcrypto;

alter table public.users
    add column if not exists is_seed_profile boolean not null default false,
    add column if not exists show_in_public boolean not null default true,
    add column if not exists is_banned boolean not null default false,
    add column if not exists is_suspended boolean not null default false,
    add column if not exists updated_at timestamptz not null default now();

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
    preferences jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(user_id)
);

update public.users
set is_seed_profile = true,
    updated_at = now()
where lower(coalesce(email, '')) like 'seed+%@genuinesugarmummies.com'
   or lower(coalesce(email, '')) like 'seed+app-%@genuinesugarmummies.co.ke'
   or lower(coalesce(email, '')) like 'seed-clean-%@genuinesugarmummies.co.ke'
   or lower(coalesce(email, '')) like '%@gs-seed.app'
   or lower(coalesce(avatar_url, '') || ' ' || coalesce(photos::text, '')) like '%/seed/%'
   or lower(coalesce(avatar_url, '') || ' ' || coalesce(photos::text, '')) like '%/seed-photos/%';

-- Hide seed rows that have no image. Do not apply this rule to real users.
update public.users
set show_in_public = false,
    updated_at = now()
where coalesce(is_seed_profile, false) = true
  and coalesce(avatar_url, '') = ''
  and coalesce(photos::text, '{}') in ('{}', '[]', '');

-- Keep one visible seeded profile per normalized name/category/image. Prefer visible rows with images and newer clean rows.
with ranked_seed as (
    select
        id,
        row_number() over (
            partition by
                lower(regexp_replace(coalesce(display_name, username, email, ''), '[^a-z0-9]+', ' ', 'g')),
                lower(coalesce(profile_label, member_category, '')),
                lower(coalesce(avatar_url, ''))
            order by
                case when coalesce(show_in_public, true) then 0 else 1 end,
                case when coalesce(avatar_url, '') <> '' then 0 else 1 end,
                created_at desc nulls last,
                id
        ) as rn
    from public.users
    where coalesce(is_seed_profile, false) = true
)
update public.users u
set show_in_public = false,
    updated_at = now()
from ranked_seed r
where u.id = r.id
  and r.rn > 1;

-- Restore real users that were hidden by strict completeness rules, as long as privacy allows it.
insert into public.user_settings (user_id, is_public, updated_at)
select id, true, now()
from public.users
where coalesce(is_seed_profile, false) = false
on conflict (user_id) do nothing;

update public.users u
set show_in_public = true,
    updated_at = now()
from public.user_settings s
where s.user_id = u.id
  and coalesce(u.is_seed_profile, false) = false
  and coalesce(s.is_public, true) = true
  and coalesce(u.is_banned, false) = false
  and coalesce(u.is_suspended, false) = false;

update public.users
set show_in_public = false,
    updated_at = now()
where coalesce(is_banned, false) = true
   or coalesce(is_suspended, false) = true;

create index if not exists users_seed_visibility_idx
    on public.users (is_seed_profile, show_in_public);
