-- Story view/like reliability and privacy support.
-- Safe for live databases: creates missing tables/columns/indexes only.

create extension if not exists pgcrypto;

create table if not exists public.user_stories (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.users(id) on delete cascade,
    caption text,
    media_url text default '',
    media_type text not null default 'image',
    background text,
    status text not null default 'active',
    created_at timestamptz not null default now(),
    expires_at timestamptz not null default (now() + interval '24 hours')
);

alter table public.user_stories
    add column if not exists user_id uuid references public.users(id) on delete cascade,
    add column if not exists caption text,
    add column if not exists media_url text default '',
    add column if not exists media_type text not null default 'image',
    add column if not exists background text,
    add column if not exists status text not null default 'active',
    add column if not exists created_at timestamptz not null default now(),
    add column if not exists expires_at timestamptz not null default (now() + interval '24 hours');

create table if not exists public.story_views (
    id uuid primary key default gen_random_uuid(),
    story_id uuid not null references public.user_stories(id) on delete cascade,
    viewer_id uuid references public.users(id) on delete set null,
    viewer_key text,
    created_at timestamptz not null default now()
);

alter table public.story_views
    add column if not exists story_id uuid references public.user_stories(id) on delete cascade,
    add column if not exists viewer_id uuid references public.users(id) on delete set null,
    add column if not exists viewer_key text,
    add column if not exists created_at timestamptz not null default now();

create table if not exists public.story_likes (
    id uuid primary key default gen_random_uuid(),
    story_id uuid not null references public.user_stories(id) on delete cascade,
    user_id uuid not null references public.users(id) on delete cascade,
    created_at timestamptz not null default now()
);

alter table public.story_likes
    add column if not exists story_id uuid references public.user_stories(id) on delete cascade,
    add column if not exists user_id uuid references public.users(id) on delete cascade,
    add column if not exists created_at timestamptz not null default now();

delete from public.story_views old_row
using public.story_views keep_row
where old_row.ctid < keep_row.ctid
  and old_row.story_id = keep_row.story_id
  and old_row.viewer_id is not null
  and old_row.viewer_id = keep_row.viewer_id;

delete from public.story_likes old_row
using public.story_likes keep_row
where old_row.ctid < keep_row.ctid
  and old_row.story_id = keep_row.story_id
  and old_row.user_id = keep_row.user_id;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'story_views_story_viewer_key'
          and conrelid = 'public.story_views'::regclass
    ) then
        alter table public.story_views
            add constraint story_views_story_viewer_key unique (story_id, viewer_id);
    end if;

    if not exists (
        select 1 from pg_constraint
        where conname = 'story_likes_story_user_key'
          and conrelid = 'public.story_likes'::regclass
    ) then
        alter table public.story_likes
            add constraint story_likes_story_user_key unique (story_id, user_id);
    end if;
end $$;

create index if not exists user_stories_active_idx on public.user_stories (status, expires_at desc, created_at desc);
create index if not exists user_stories_user_idx on public.user_stories (user_id, created_at desc);
create index if not exists story_views_story_idx on public.story_views (story_id, created_at desc);
create index if not exists story_views_viewer_idx on public.story_views (viewer_id, created_at desc);
create index if not exists story_likes_story_idx on public.story_likes (story_id, created_at desc);
create index if not exists story_likes_user_idx on public.story_likes (user_id, created_at desc);

insert into storage.buckets (id, name, public)
values ('story-media', 'story-media', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Story media public read" on storage.objects;
create policy "Story media public read"
on storage.objects for select
using (bucket_id = 'story-media');

drop policy if exists "Story media authenticated insert" on storage.objects;
create policy "Story media authenticated insert"
on storage.objects for insert
with check (bucket_id = 'story-media');

alter table public.user_stories enable row level security;
alter table public.story_views enable row level security;
alter table public.story_likes enable row level security;

drop policy if exists "Users read active stories" on public.user_stories;
create policy "Users read active stories"
on public.user_stories for select
using (status = 'active' and expires_at > now());

drop policy if exists "Users insert own stories" on public.user_stories;
create policy "Users insert own stories"
on public.user_stories for insert
with check (auth.uid() in (select auth_user_id from public.users where id = user_id));

drop policy if exists "Users read story views for own stories" on public.story_views;
create policy "Users read story views for own stories"
on public.story_views for select
using (
    auth.uid() in (
        select users.auth_user_id
        from public.user_stories stories
        join public.users users on users.id = stories.user_id
        where stories.id = story_id
    )
    or auth.uid() in (select auth_user_id from public.users where id = viewer_id)
);

drop policy if exists "Users insert own story views" on public.story_views;
create policy "Users insert own story views"
on public.story_views for insert
with check (auth.uid() in (select auth_user_id from public.users where id = viewer_id));

drop policy if exists "Users read story likes for own stories" on public.story_likes;
create policy "Users read story likes for own stories"
on public.story_likes for select
using (
    auth.uid() in (
        select users.auth_user_id
        from public.user_stories stories
        join public.users users on users.id = stories.user_id
        where stories.id = story_id
    )
    or auth.uid() in (select auth_user_id from public.users where id = user_id)
);

drop policy if exists "Users insert own story likes" on public.story_likes;
create policy "Users insert own story likes"
on public.story_likes for insert
with check (auth.uid() in (select auth_user_id from public.users where id = user_id));
