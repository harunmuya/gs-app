-- Live stream schema repair for the live app.
-- Safe for existing data: only adds missing columns/tables and backfills defaults.

create extension if not exists pgcrypto;

create table if not exists public.live_streams (
    id uuid primary key default gen_random_uuid(),
    host_id uuid references public.users(id) on delete cascade,
    title text,
    created_at timestamptz not null default now()
);

alter table public.live_streams
    add column if not exists status text not null default 'active',
    add column if not exists is_active boolean not null default true,
    add column if not exists viewer_count integer not null default 0,
    add column if not exists total_gifts integer not null default 0,
    add column if not exists total_coins integer not null default 0,
    add column if not exists total_likes integer not null default 0,
    add column if not exists total_comments integer not null default 0,
    add column if not exists total_views integer not null default 0,
    add column if not exists started_at timestamptz not null default now(),
    add column if not exists ended_at timestamptz,
    add column if not exists updated_at timestamptz not null default now();

update public.live_streams
set is_active = case
        when ended_at is not null then false
        when lower(coalesce(status, 'active')) in ('ended', 'stopped', 'closed') then false
        else true
    end,
    status = case
        when ended_at is not null then 'ended'
        when lower(coalesce(status, 'active')) in ('ended', 'stopped', 'closed') then 'ended'
        else 'active'
    end,
    started_at = coalesce(started_at, created_at, now()),
    updated_at = now();

create table if not exists public.live_viewers (
    id uuid primary key default gen_random_uuid(),
    stream_id uuid not null references public.live_streams(id) on delete cascade,
    user_id uuid references public.users(id) on delete cascade,
    joined_at timestamptz not null default now(),
    unique(stream_id, user_id)
);

create table if not exists public.live_comments (
    id uuid primary key default gen_random_uuid(),
    stream_id uuid not null references public.live_streams(id) on delete cascade,
    user_id uuid references public.users(id) on delete set null,
    content text not null default '',
    created_at timestamptz not null default now()
);

create table if not exists public.live_gifts (
    id uuid primary key default gen_random_uuid(),
    stream_id uuid not null references public.live_streams(id) on delete cascade,
    sender_id uuid references public.users(id) on delete set null,
    user_id uuid references public.users(id) on delete set null,
    gift_name text not null default 'Gift',
    gift_visual text,
    gift_cost integer not null default 0,
    created_at timestamptz not null default now()
);

create index if not exists live_streams_active_started_idx
    on public.live_streams (is_active, started_at desc);

create index if not exists live_viewers_stream_idx
    on public.live_viewers (stream_id, joined_at desc);

create index if not exists live_comments_stream_idx
    on public.live_comments (stream_id, created_at desc);

create index if not exists live_gifts_stream_idx
    on public.live_gifts (stream_id, created_at desc);
