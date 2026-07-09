-- Delete broken duplicate seeded profiles without touching real users.
-- Safe rules:
-- 1. A row must be identified as seeded/fake by is_seed_profile, seed email, or seed media path.
-- 2. Real users are never selected by this migration.
-- 3. Correct seeded profiles with unique name/photo are kept.
-- 4. No-image seeded rows are deleted because they are broken display records.
-- 5. Duplicate seeded rows keep the best visible/image row and delete only extras.

create extension if not exists pgcrypto;

alter table public.users
    add column if not exists is_seed_profile boolean not null default false,
    add column if not exists show_in_public boolean not null default true,
    add column if not exists is_banned boolean not null default false,
    add column if not exists is_suspended boolean not null default false,
    add column if not exists updated_at timestamptz not null default now();

update public.users
set is_seed_profile = true,
    updated_at = now()
where lower(coalesce(email, '')) like 'seed+%@genuinesugarmummies.com'
   or lower(coalesce(email, '')) like 'seed+app-%@genuinesugarmummies.co.ke'
   or lower(coalesce(email, '')) like 'seed-clean-%@genuinesugarmummies.co.ke'
   or lower(coalesce(email, '')) like '%@gs-seed.app'
   or lower(coalesce(avatar_url, '') || ' ' || coalesce(photos::text, '')) like '%/seed/%'
   or lower(coalesce(avatar_url, '') || ' ' || coalesce(photos::text, '')) like '%/seed-photos/%';

create temp table gs_seed_delete_ids(id uuid primary key) on commit drop;

-- Broken seed rows: no usable image.
insert into gs_seed_delete_ids(id)
select id
from public.users
where coalesce(is_seed_profile, false) = true
  and coalesce(avatar_url, '') = ''
  and coalesce(photos::text, '{}') in ('{}', '[]', '');

-- Duplicates by exact normalized seed identity: name + category + image.
with ranked as (
    select
        id,
        row_number() over (
            partition by
                lower(regexp_replace(coalesce(display_name, username, email, ''), '[^a-z0-9]+', ' ', 'g')),
                lower(coalesce(profile_label, member_category, '')),
                lower(regexp_replace(coalesce(avatar_url, ''), '^https?://[^/]+', '', 'i'))
            order by
                case when coalesce(show_in_public, true) then 0 else 1 end,
                case when coalesce(avatar_url, '') <> '' then 0 else 1 end,
                coalesce(total_profile_views, 0) desc,
                coalesce(followers_count, 0) desc,
                created_at desc nulls last,
                id
        ) as rn
    from public.users
    where coalesce(is_seed_profile, false) = true
      and coalesce(avatar_url, '') <> ''
)
insert into gs_seed_delete_ids(id)
select id from ranked where rn > 1
on conflict (id) do nothing;

-- Duplicates by same seed photo reused in more than one seed row.
with ranked as (
    select
        id,
        row_number() over (
            partition by lower(regexp_replace(coalesce(avatar_url, ''), '^https?://[^/]+', '', 'i'))
            order by
                case when coalesce(show_in_public, true) then 0 else 1 end,
                coalesce(total_profile_views, 0) desc,
                coalesce(followers_count, 0) desc,
                created_at desc nulls last,
                id
        ) as rn
    from public.users
    where coalesce(is_seed_profile, false) = true
      and coalesce(avatar_url, '') <> ''
)
insert into gs_seed_delete_ids(id)
select id from ranked where rn > 1
on conflict (id) do nothing;

do $$
declare
    target record;
begin
    for target in
        select *
        from (values
            ('message_attachments', 'owner_id'), ('voice_notes', 'owner_id'),
            ('messages', 'sender_id'), ('messages', 'receiver_id'),
            ('member_messages', 'member_id'), ('member_messages', 'sender_id'), ('member_messages', 'receiver_id'),
            ('user_follows', 'follower_id'), ('user_follows', 'following_id'),
            ('profile_views', 'viewed_id'), ('profile_views', 'viewer_id'),
            ('call_signals', 'sender_id'), ('call_signals', 'receiver_id'), ('call_events', 'user_id'),
            ('call_sessions', 'caller_id'), ('call_sessions', 'receiver_id'),
            ('story_views', 'viewer_id'), ('story_likes', 'user_id'), ('user_stories', 'user_id'),
            ('live_viewers', 'user_id'), ('live_comments', 'user_id'), ('live_gifts', 'sender_id'), ('live_gifts', 'user_id'),
            ('live_streams', 'host_id'), ('live_streams', 'user_id'),
            ('user_gift_inventory', 'user_id'),
            ('wallet_transactions', 'user_id'), ('credit_wallet', 'user_id'), ('money_wallet', 'user_id'),
            ('gift_wallet', 'user_id'),
            ('user_daily_usage', 'user_id'), ('user_notifications', 'user_id'), ('user_settings', 'user_id'),
            ('user_interactions', 'user_id'), ('member_saves', 'user_id'),
            ('ticket_responses', 'user_id'), ('package_requests', 'user_id'), ('support_tickets', 'user_id'),
            ('profile_boosts', 'user_id')
        ) as t(table_name, column_name)
    loop
        if to_regclass('public.' || target.table_name) is not null
           and exists (
                select 1 from information_schema.columns
                where table_schema = 'public'
                  and table_name = target.table_name
                  and column_name = target.column_name
           )
        then
            execute format(
                'delete from public.%I where %I::text in (select id::text from gs_seed_delete_ids)',
                target.table_name,
                target.column_name
            );
        end if;
    end loop;

    if to_regclass('public.conversations') is not null then
        if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'conversations' and column_name = 'user_one_id') then
            delete from public.conversations where user_one_id::text in (select id::text from gs_seed_delete_ids);
        end if;
        if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'conversations' and column_name = 'user_two_id') then
            delete from public.conversations where user_two_id::text in (select id::text from gs_seed_delete_ids);
        end if;
        if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'conversations' and column_name = 'user_id') then
            delete from public.conversations where user_id::text in (select id::text from gs_seed_delete_ids);
            alter table public.conversations alter column user_id drop not null;
        end if;
    end if;
end $$;

delete from public.users
where id in (select id from gs_seed_delete_ids)
  and coalesce(is_seed_profile, false) = true;

-- Keep all real users visible when their Public Profile setting allows it.
create table if not exists public.user_settings (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.users(id) on delete cascade,
    is_public boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(user_id)
);

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
