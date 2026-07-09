-- Account creation, profile editing, and deletion support.
-- Non-destructive: adds missing columns/indexes only and keeps existing client data.

create extension if not exists pgcrypto;

alter table if exists public.users
    add column if not exists username text,
    add column if not exists display_name text,
    add column if not exists email text,
    add column if not exists avatar_url text,
    add column if not exists photos jsonb not null default '[]'::jsonb,
    add column if not exists bio text,
    add column if not exists description text,
    add column if not exists age integer,
    add column if not exists location text,
    add column if not exists city text,
    add column if not exists country text,
    add column if not exists phone text,
    add column if not exists phone_number text,
    add column if not exists looking_for text,
    add column if not exists wants text,
    add column if not exists needed_qualities text,
    add column if not exists age_range_preference text,
    add column if not exists profile_label text,
    add column if not exists member_category text,
    add column if not exists show_in_public boolean not null default false,
    add column if not exists admin_approved boolean not null default true,
    add column if not exists package_locked boolean not null default false,
    add column if not exists is_banned boolean not null default false,
    add column if not exists is_suspended boolean not null default false,
    add column if not exists auth_user_id uuid,
    add column if not exists password_hash text,
    add column if not exists password_updated_at timestamptz,
    add column if not exists updated_at timestamptz not null default now(),
    add column if not exists created_at timestamptz not null default now();

update public.users
set
    username = coalesce(
        nullif(username, ''),
        lower(regexp_replace(split_part(coalesce(email, id::text), '@', 1), '[^a-zA-Z0-9_]+', '_', 'g'))
    ),
    display_name = coalesce(nullif(display_name, ''), split_part(coalesce(email, 'GS Member'), '@', 1)),
    phone_number = coalesce(nullif(phone_number, ''), phone),
    phone = coalesce(nullif(phone, ''), phone_number),
    description = coalesce(description, bio),
    bio = coalesce(bio, description),
    city = coalesce(nullif(city, ''), location),
    member_category = coalesce(nullif(member_category, ''), profile_label),
    profile_label = coalesce(nullif(profile_label, ''), member_category, 'member')
where id is not null;

create unique index if not exists users_email_unique_idx
    on public.users (lower(email))
    where email is not null and email <> '';

create unique index if not exists users_username_unique_idx
    on public.users (lower(username))
    where username is not null and username <> '';

create index if not exists users_public_complete_idx
    on public.users (show_in_public, is_banned, is_suspended, updated_at desc);

alter table if exists public.users enable row level security;

drop policy if exists "Users can read public profiles" on public.users;
create policy "Users can read public profiles"
on public.users for select
using (
    show_in_public = true
    or auth.uid() = auth_user_id
);

drop policy if exists "Users can update own account" on public.users;
create policy "Users can update own account"
on public.users for update
using (auth.uid() = auth_user_id)
with check (auth.uid() = auth_user_id);

drop policy if exists "Users can delete own account" on public.users;
create policy "Users can delete own account"
on public.users for delete
using (auth.uid() = auth_user_id);
