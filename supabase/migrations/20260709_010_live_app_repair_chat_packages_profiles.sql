-- Live app repair: profile labels, package unlocks, messaging, follows, views, stories, live, calls.
-- Safe to rerun. It creates missing objects and updates contradictory labels without deleting users.

create extension if not exists pgcrypto;

alter table public.users
    add column if not exists username text,
    add column if not exists display_name text,
    add column if not exists email text,
    add column if not exists avatar_url text,
    add column if not exists photos text[] not null default '{}',
    add column if not exists profile_label text,
    add column if not exists member_category text,
    add column if not exists preference text,
    add column if not exists looking_for text,
    add column if not exists subscription_tier text not null default 'free',
    add column if not exists package_locked boolean not null default false,
    add column if not exists package_expires_at timestamptz,
    add column if not exists verified boolean not null default false,
    add column if not exists verification_status text not null default 'unsubmitted',
    add column if not exists show_in_public boolean not null default true,
    add column if not exists is_seed_profile boolean not null default false,
    add column if not exists is_suspended boolean not null default false,
    add column if not exists is_banned boolean not null default false,
    add column if not exists total_profile_views integer not null default 0,
    add column if not exists followers_count integer not null default 0,
    add column if not exists following_count integer not null default 0,
    add column if not exists gifts_received_count integer not null default 0,
    add column if not exists boost_expires_at timestamptz,
    add column if not exists boost_score integer not null default 0,
    add column if not exists last_seen_at timestamptz,
    add column if not exists updated_at timestamptz not null default now(),
    add column if not exists created_at timestamptz not null default now();

with classified as (
    select
        id,
        case
            when coalesce(is_seed_profile, false)
                 and lower(coalesce(avatar_url, '') || ' ' || coalesce(photos::text, '')) like '%sugarmums%'
                then 'sugar_mummy'
            when coalesce(is_seed_profile, false)
                 and (
                    lower(coalesce(avatar_url, '') || ' ' || coalesce(photos::text, '')) like '%sugar-dads%'
                    or lower(coalesce(avatar_url, '') || ' ' || coalesce(photos::text, '')) like '%/seed-photos/seed-m-%'
                 )
                then 'sugar_daddy'
            when coalesce(is_seed_profile, false)
                 and lower(coalesce(avatar_url, '') || ' ' || coalesce(photos::text, '')) like '%mistresses%'
                then 'mistress'
            when lower(coalesce(preference, '')) like 'sugar_mummy%' then 'sugar_mummy'
            when lower(coalesce(preference, '')) like 'sugar_daddy%' then 'sugar_daddy'
            when lower(coalesce(preference, '')) like 'mistress%' then 'mistress'
            when lower(coalesce(preference, '')) like 'toyboy%' or lower(coalesce(preference, '')) like 'sugar_guy%' then 'toyboy'
            when lower(replace(coalesce(profile_label, member_category, ''), ' ', '_')) in ('sugar_mummy', 'sugar_daddy', 'mistress', 'toyboy')
                then lower(replace(coalesce(profile_label, member_category, ''), ' ', '_'))
            else 'toyboy'
        end as fixed_label
    from public.users
)
update public.users u
set
    profile_label = c.fixed_label,
    member_category = c.fixed_label,
    looking_for = case c.fixed_label
        when 'sugar_mummy' then 'Sugar Guy / Toyboy'
        when 'sugar_daddy' then 'Mistress'
        when 'mistress' then 'Sugar Daddy'
        when 'toyboy' then 'Sugar Mummy'
        else u.looking_for
    end,
    package_locked = coalesce(u.package_locked, false),
    updated_at = now()
from classified c
where u.id = c.id;

with seed_daddy_names as (
    select *
    from (values
        (1, 'James Kamau'), (2, 'Joseph Kimani'), (3, 'Peter Mwangi'), (4, 'Samuel Otieno'),
        (5, 'David Karanja'), (6, 'Patrick Njoroge'), (7, 'George Mutua'), (8, 'Daniel Wekesa'),
        (9, 'Martin Kariuki'), (10, 'Anthony Kiplagat'), (11, 'Robert Omondi'), (12, 'Michael Barasa'),
        (13, 'Charles Mwaura'), (14, 'Vincent Odhiambo'), (15, 'Richard Kiptoo'), (16, 'Edward Ndirangu'),
        (17, 'Francis Onyango'), (18, 'Kenneth Muriithi'), (19, 'Brian Ochieng'), (20, 'Eric Maina'),
        (21, 'Victor Mboya'), (22, 'Stephen Kariuki'), (23, 'Alex Muthomi'), (24, 'Collins Barasa'),
        (25, 'Moses Onyango'), (26, 'Isaac Mutiso'), (27, 'Emmanuel Wekesa'), (28, 'Fredrick Otieno'),
        (29, 'Caleb Mwangi'), (30, 'Benard Kiptoo'), (31, 'Dennis Karanja'), (32, 'John Njuguna'),
        (33, 'Paul Muriuki'), (34, 'Mark Ouma'), (35, 'Evans Kipchoge'), (36, 'Geoffrey Njoroge'),
        (37, 'Tony Makori'), (38, 'Cyrus Maina'), (39, 'Dominic Mwenda'), (40, 'Simon Barasa'),
        (41, 'Philip Kiplagat'), (42, 'Andrew Mutua'), (43, 'Nelson Kariuki'), (44, 'Oscar Omondi'),
        (45, 'Felix Wanyama'), (46, 'Lawrence Kimutai'), (47, 'Harrison Odhiambo'), (48, 'Morris Njenga'),
        (49, 'Gideon Wambua'), (50, 'Walter Kosgei'), (51, 'Edwin Muchiri'), (52, 'Allan Kiprono'),
        (53, 'Martin Mbugua'), (54, 'Kelvin Gichuki'), (55, 'Julius Okoth'), (56, 'Stanley Muriithi'),
        (57, 'Ronald Chege'), (58, 'Clifford Mwale'), (59, 'Douglas Njoroge'), (60, 'Albert Simiyu'),
        (61, 'Bernard Onyango'), (62, 'Leonard Karanja'), (63, 'Nicholas Mwangi'), (64, 'Dennis Kiptoo'),
        (65, 'Raymond Ochieng'), (66, 'Tom Muthomi'), (67, 'Gilbert Barasa'), (68, 'Arthur Kimani'),
        (69, 'Solomon Mutiso'), (70, 'Henry Wekesa'), (71, 'Godfrey Otieno'), (72, 'Wilson Kariuki')
    ) as names(position, display_name)
),
seed_daddies as (
    select
        id,
        row_number() over (order by coalesce(created_at, now()), id) as position
    from public.users
    where coalesce(is_seed_profile, false)
      and profile_label = 'sugar_daddy'
)
update public.users u
set
    display_name = n.display_name,
    username = lower(regexp_replace(n.display_name, '[^a-zA-Z0-9]+', '_', 'g')) || '_' || left(u.id::text, 6),
    looking_for = 'Mistress',
    intent_summary = 'I am a sugar daddy looking for Mistress.',
    updated_at = now()
from seed_daddies d
join seed_daddy_names n on n.position = ((d.position - 1) % 72) + 1
where u.id = d.id;

create table if not exists public.package_tiers (
    id text primary key,
    name text not null,
    price_ksh integer not null default 0,
    phone_reveal boolean not null default false,
    daily_message_limit integer not null default 0,
    daily_gift_limit integer not null default 0,
    daily_like_limit integer not null default 0,
    daily_super_like_limit integer not null default 0,
    daily_swipe_limit integer not null default 0,
    daily_profile_view_limit integer not null default 0,
    priority_visibility boolean not null default false,
    international_access boolean not null default false,
    voice_video_access boolean not null default false,
    can_see_who_liked boolean not null default false,
    can_see_who_viewed boolean not null default false,
    can_send_voice_notes boolean not null default false,
    can_send_images boolean not null default false,
    can_go_live boolean not null default false,
    can_send_gifts boolean not null default false,
    can_use_nearby boolean not null default false,
    max_gift_tier integer not null default 0,
    starting_credits integer not null default 0,
    features jsonb not null default '[]'::jsonb,
    updated_at timestamptz not null default now()
);

alter table public.package_tiers
    add column if not exists name text not null default 'Package',
    add column if not exists price_ksh integer not null default 0,
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
    add column if not exists updated_at timestamptz not null default now();

insert into public.package_tiers (id, name, price_ksh, phone_reveal, daily_message_limit, daily_gift_limit, daily_like_limit, daily_super_like_limit, daily_swipe_limit, daily_profile_view_limit, priority_visibility, international_access, voice_video_access, can_see_who_liked, can_see_who_viewed, can_send_voice_notes, can_send_images, can_go_live, can_send_gifts, can_use_nearby, max_gift_tier, starting_credits)
values
('free', 'Free', 0, false, 5, 0, 5, 0, 10, 10, false, false, false, false, false, false, false, false, false, false, 0, 0),
('basic', 'Basic', 650, false, 30, 10, 10, 5, 30, 30, false, false, false, false, false, false, true, false, true, false, 1, 50),
('silver', 'Silver Recommended', 1200, true, 0, 50, 50, 100, 0, 0, true, false, true, true, true, true, true, true, true, true, 3, 200),
('gold', 'Gold International', 3550, true, 0, 0, 0, 0, 0, 0, true, true, true, true, true, true, true, true, true, true, 4, 500)
on conflict (id) do update set
    name = excluded.name,
    price_ksh = excluded.price_ksh,
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
    updated_at = now();

create table if not exists public.user_daily_usage (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.users(id) on delete cascade,
    usage_date date not null default current_date,
    kind text not null,
    count integer not null default 0,
    updated_at timestamptz not null default now(),
    unique(user_id, usage_date, kind)
);

create table if not exists public.conversations (
    id uuid primary key default gen_random_uuid(),
    user_one_id uuid not null references public.users(id) on delete cascade,
    user_two_id uuid not null references public.users(id) on delete cascade,
    status text not null default 'active',
    last_message_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (user_one_id <> user_two_id),
    unique(user_one_id, user_two_id)
);

create table if not exists public.messages (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references public.conversations(id) on delete cascade,
    sender_id uuid not null references public.users(id) on delete cascade,
    receiver_id uuid not null references public.users(id) on delete cascade,
    body text not null default '',
    message_type text not null default 'text',
    status text not null default 'sent',
    read_at timestamptz,
    delivered_at timestamptz,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create table if not exists public.message_attachments (
    id uuid primary key default gen_random_uuid(),
    message_id uuid references public.messages(id) on delete cascade,
    owner_id uuid references public.users(id) on delete cascade,
    storage_path text,
    public_url text,
    attachment_type text,
    file_name text,
    created_at timestamptz not null default now()
);

create table if not exists public.voice_notes (
    id uuid primary key default gen_random_uuid(),
    message_id uuid references public.messages(id) on delete cascade,
    owner_id uuid references public.users(id) on delete cascade,
    storage_path text,
    public_url text,
    duration_seconds integer not null default 0,
    created_at timestamptz not null default now()
);

create table if not exists public.member_messages (
    id uuid primary key default gen_random_uuid(),
    member_id uuid references public.users(id) on delete cascade,
    sender_id uuid references public.users(id) on delete set null,
    receiver_id uuid references public.users(id) on delete set null,
    sender_key text,
    sender_name text,
    body text not null default '',
    attachment_url text,
    attachment_type text,
    attachment_name text,
    voice_url text,
    is_read boolean not null default false,
    created_at timestamptz not null default now()
);

create table if not exists public.user_follows (
    id uuid primary key default gen_random_uuid(),
    follower_id uuid not null references public.users(id) on delete cascade,
    following_id uuid not null references public.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    check (follower_id <> following_id),
    unique(follower_id, following_id)
);

create table if not exists public.profile_views (
    id uuid primary key default gen_random_uuid(),
    viewed_id uuid not null references public.users(id) on delete cascade,
    viewer_id uuid references public.users(id) on delete set null,
    viewer_key text,
    source text not null default 'member',
    created_at timestamptz not null default now()
);

create table if not exists public.user_stories (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.users(id) on delete cascade,
    caption text,
    media_url text not null,
    media_type text not null default 'image',
    background text,
    status text not null default 'active',
    created_at timestamptz not null default now(),
    expires_at timestamptz not null default (now() + interval '24 hours')
);

create table if not exists public.story_views (
    id uuid primary key default gen_random_uuid(),
    story_id uuid not null references public.user_stories(id) on delete cascade,
    viewer_id uuid references public.users(id) on delete set null,
    viewer_key text,
    created_at timestamptz not null default now(),
    unique(story_id, viewer_id)
);

create table if not exists public.story_likes (
    id uuid primary key default gen_random_uuid(),
    story_id uuid not null references public.user_stories(id) on delete cascade,
    user_id uuid not null references public.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    unique(story_id, user_id)
);

create table if not exists public.live_streams (
    id uuid primary key default gen_random_uuid(),
    host_id uuid not null references public.users(id) on delete cascade,
    title text,
    status text not null default 'live',
    viewer_count integer not null default 0,
    total_views integer not null default 0,
    total_likes integer not null default 0,
    total_gifts integer not null default 0,
    started_at timestamptz not null default now(),
    ended_at timestamptz,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create table if not exists public.live_comments (
    id uuid primary key default gen_random_uuid(),
    stream_id uuid not null references public.live_streams(id) on delete cascade,
    user_id uuid references public.users(id) on delete set null,
    display_name text,
    body text not null,
    created_at timestamptz not null default now()
);

create table if not exists public.live_gifts (
    id uuid primary key default gen_random_uuid(),
    stream_id uuid not null references public.live_streams(id) on delete cascade,
    sender_id uuid references public.users(id) on delete set null,
    gift_id uuid,
    gift_name text,
    credit_cost integer not null default 0,
    created_at timestamptz not null default now()
);

create table if not exists public.call_sessions (
    id uuid primary key default gen_random_uuid(),
    caller_id uuid references public.users(id) on delete set null,
    receiver_id uuid references public.users(id) on delete set null,
    call_type text not null default 'voice',
    status text not null default 'ringing',
    started_at timestamptz not null default now(),
    accepted_at timestamptz,
    ended_at timestamptz,
    missed_at timestamptz,
    duration_seconds integer not null default 0,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create table if not exists public.call_signals (
    id uuid primary key default gen_random_uuid(),
    call_session_id uuid not null references public.call_sessions(id) on delete cascade,
    sender_id uuid references public.users(id) on delete set null,
    receiver_id uuid references public.users(id) on delete set null,
    signal_type text not null,
    payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create table if not exists public.call_events (
    id uuid primary key default gen_random_uuid(),
    call_session_id uuid references public.call_sessions(id) on delete cascade,
    user_id uuid references public.users(id) on delete set null,
    event_type text not null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

alter table public.user_daily_usage
    add column if not exists user_id uuid references public.users(id) on delete cascade,
    add column if not exists usage_date date not null default current_date,
    add column if not exists kind text,
    add column if not exists count integer not null default 0,
    add column if not exists updated_at timestamptz not null default now();

alter table public.conversations
    add column if not exists user_one_id uuid references public.users(id) on delete cascade,
    add column if not exists user_two_id uuid references public.users(id) on delete cascade,
    add column if not exists status text not null default 'active',
    add column if not exists last_message_at timestamptz,
    add column if not exists created_at timestamptz not null default now(),
    add column if not exists updated_at timestamptz not null default now();

do $$
begin
    if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'conversations'
          and column_name = 'user_id'
    ) then
        update public.conversations
        set user_id = coalesce(user_id, user_one_id, user_two_id)
        where user_id is null;

        alter table public.conversations alter column user_id drop not null;
    end if;
end $$;

alter table public.messages
    add column if not exists conversation_id uuid references public.conversations(id) on delete cascade,
    add column if not exists sender_id uuid references public.users(id) on delete cascade,
    add column if not exists receiver_id uuid references public.users(id) on delete cascade,
    add column if not exists body text not null default '',
    add column if not exists message_type text not null default 'text',
    add column if not exists status text not null default 'sent',
    add column if not exists read_at timestamptz,
    add column if not exists delivered_at timestamptz,
    add column if not exists metadata jsonb not null default '{}'::jsonb,
    add column if not exists created_at timestamptz not null default now();

alter table public.message_attachments
    add column if not exists message_id uuid references public.messages(id) on delete cascade,
    add column if not exists owner_id uuid references public.users(id) on delete cascade,
    add column if not exists storage_path text,
    add column if not exists public_url text,
    add column if not exists attachment_type text,
    add column if not exists file_name text,
    add column if not exists created_at timestamptz not null default now();

alter table public.voice_notes
    add column if not exists message_id uuid references public.messages(id) on delete cascade,
    add column if not exists owner_id uuid references public.users(id) on delete cascade,
    add column if not exists storage_path text,
    add column if not exists public_url text,
    add column if not exists duration_seconds integer not null default 0,
    add column if not exists created_at timestamptz not null default now();

alter table public.member_messages
    add column if not exists member_id uuid references public.users(id) on delete cascade,
    add column if not exists sender_id uuid references public.users(id) on delete set null,
    add column if not exists receiver_id uuid references public.users(id) on delete set null,
    add column if not exists sender_key text,
    add column if not exists sender_name text,
    add column if not exists body text not null default '',
    add column if not exists attachment_url text,
    add column if not exists attachment_type text,
    add column if not exists attachment_name text,
    add column if not exists voice_url text,
    add column if not exists is_read boolean not null default false,
    add column if not exists created_at timestamptz not null default now();

alter table public.user_follows
    add column if not exists follower_id uuid references public.users(id) on delete cascade,
    add column if not exists following_id uuid references public.users(id) on delete cascade,
    add column if not exists created_at timestamptz not null default now();

alter table public.profile_views
    add column if not exists viewed_id uuid references public.users(id) on delete cascade,
    add column if not exists viewer_id uuid references public.users(id) on delete set null,
    add column if not exists viewer_key text,
    add column if not exists source text not null default 'member',
    add column if not exists created_at timestamptz not null default now();

alter table public.user_stories
    add column if not exists user_id uuid references public.users(id) on delete cascade,
    add column if not exists caption text,
    add column if not exists media_url text,
    add column if not exists media_type text not null default 'image',
    add column if not exists background text,
    add column if not exists status text not null default 'active',
    add column if not exists created_at timestamptz not null default now(),
    add column if not exists expires_at timestamptz not null default (now() + interval '24 hours');

alter table public.story_views
    add column if not exists story_id uuid references public.user_stories(id) on delete cascade,
    add column if not exists viewer_id uuid references public.users(id) on delete set null,
    add column if not exists viewer_key text,
    add column if not exists created_at timestamptz not null default now();

alter table public.story_likes
    add column if not exists story_id uuid references public.user_stories(id) on delete cascade,
    add column if not exists user_id uuid references public.users(id) on delete cascade,
    add column if not exists created_at timestamptz not null default now();

alter table public.live_streams
    add column if not exists host_id uuid references public.users(id) on delete cascade,
    add column if not exists title text,
    add column if not exists status text not null default 'live',
    add column if not exists viewer_count integer not null default 0,
    add column if not exists total_views integer not null default 0,
    add column if not exists total_likes integer not null default 0,
    add column if not exists total_gifts integer not null default 0,
    add column if not exists started_at timestamptz not null default now(),
    add column if not exists ended_at timestamptz,
    add column if not exists metadata jsonb not null default '{}'::jsonb,
    add column if not exists created_at timestamptz not null default now();

alter table public.live_comments
    add column if not exists stream_id uuid references public.live_streams(id) on delete cascade,
    add column if not exists user_id uuid references public.users(id) on delete set null,
    add column if not exists display_name text,
    add column if not exists body text not null default '',
    add column if not exists created_at timestamptz not null default now();

alter table public.live_gifts
    add column if not exists stream_id uuid references public.live_streams(id) on delete cascade,
    add column if not exists sender_id uuid references public.users(id) on delete set null,
    add column if not exists gift_id uuid,
    add column if not exists gift_name text,
    add column if not exists credit_cost integer not null default 0,
    add column if not exists created_at timestamptz not null default now();

alter table public.call_sessions
    add column if not exists caller_id uuid references public.users(id) on delete set null,
    add column if not exists receiver_id uuid references public.users(id) on delete set null,
    add column if not exists call_type text not null default 'voice',
    add column if not exists status text not null default 'ringing',
    add column if not exists started_at timestamptz not null default now(),
    add column if not exists accepted_at timestamptz,
    add column if not exists ended_at timestamptz,
    add column if not exists missed_at timestamptz,
    add column if not exists duration_seconds integer not null default 0,
    add column if not exists metadata jsonb not null default '{}'::jsonb,
    add column if not exists created_at timestamptz not null default now();

alter table public.call_signals
    add column if not exists call_session_id uuid references public.call_sessions(id) on delete cascade,
    add column if not exists sender_id uuid references public.users(id) on delete set null,
    add column if not exists receiver_id uuid references public.users(id) on delete set null,
    add column if not exists signal_type text not null default 'offer',
    add column if not exists payload jsonb not null default '{}'::jsonb,
    add column if not exists created_at timestamptz not null default now();

alter table public.call_events
    add column if not exists call_session_id uuid references public.call_sessions(id) on delete cascade,
    add column if not exists user_id uuid references public.users(id) on delete set null,
    add column if not exists event_type text not null default 'event',
    add column if not exists metadata jsonb not null default '{}'::jsonb,
    add column if not exists created_at timestamptz not null default now();

create index if not exists users_profile_label_idx on public.users(profile_label);
create index if not exists users_public_seen_idx on public.users(show_in_public, is_banned, is_suspended, last_seen_at desc);
create index if not exists conversations_user_one_idx on public.conversations(user_one_id, updated_at desc);
create index if not exists conversations_user_two_idx on public.conversations(user_two_id, updated_at desc);
create index if not exists messages_conversation_created_idx on public.messages(conversation_id, created_at);
create index if not exists user_follows_follower_idx on public.user_follows(follower_id, created_at desc);
create index if not exists user_follows_following_idx on public.user_follows(following_id, created_at desc);
create index if not exists profile_views_viewed_created_idx on public.profile_views(viewed_id, created_at desc);
create index if not exists story_views_story_idx on public.story_views(story_id, created_at desc);
create index if not exists live_streams_status_idx on public.live_streams(status, started_at desc);
create index if not exists call_sessions_user_idx on public.call_sessions(caller_id, receiver_id, created_at desc);

insert into storage.buckets (id, name, public)
values
    ('message-attachments', 'message-attachments', true),
    ('story-media', 'story-media', true)
on conflict (id) do update set public = excluded.public;

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.message_attachments enable row level security;
alter table public.voice_notes enable row level security;
alter table public.package_tiers enable row level security;
alter table public.user_daily_usage enable row level security;
alter table public.member_messages enable row level security;
alter table public.user_follows enable row level security;
alter table public.profile_views enable row level security;
alter table public.user_stories enable row level security;
alter table public.story_views enable row level security;
alter table public.story_likes enable row level security;
alter table public.live_streams enable row level security;
alter table public.live_comments enable row level security;
alter table public.live_gifts enable row level security;
alter table public.call_sessions enable row level security;
alter table public.call_signals enable row level security;
alter table public.call_events enable row level security;

drop policy if exists "GS app server readable conversations" on public.conversations;
create policy "GS app server readable conversations" on public.conversations for all using (true) with check (true);
drop policy if exists "GS app server readable messages" on public.messages;
create policy "GS app server readable messages" on public.messages for all using (true) with check (true);
drop policy if exists "GS app server readable message attachments" on public.message_attachments;
create policy "GS app server readable message attachments" on public.message_attachments for all using (true) with check (true);
drop policy if exists "GS app server readable voice notes" on public.voice_notes;
create policy "GS app server readable voice notes" on public.voice_notes for all using (true) with check (true);
drop policy if exists "GS app readable packages" on public.package_tiers;
create policy "GS app readable packages" on public.package_tiers for select using (true);
drop policy if exists "GS app server writable packages" on public.package_tiers;
create policy "GS app server writable packages" on public.package_tiers for all using (true) with check (true);
drop policy if exists "GS app server readable usage" on public.user_daily_usage;
create policy "GS app server readable usage" on public.user_daily_usage for all using (true) with check (true);
drop policy if exists "GS app server readable member messages" on public.member_messages;
create policy "GS app server readable member messages" on public.member_messages for all using (true) with check (true);
drop policy if exists "GS app server readable follows" on public.user_follows;
create policy "GS app server readable follows" on public.user_follows for all using (true) with check (true);
drop policy if exists "GS app server readable views" on public.profile_views;
create policy "GS app server readable views" on public.profile_views for all using (true) with check (true);
drop policy if exists "GS app server readable stories" on public.user_stories;
create policy "GS app server readable stories" on public.user_stories for all using (true) with check (true);
drop policy if exists "GS app server readable story views" on public.story_views;
create policy "GS app server readable story views" on public.story_views for all using (true) with check (true);
drop policy if exists "GS app server readable story likes" on public.story_likes;
create policy "GS app server readable story likes" on public.story_likes for all using (true) with check (true);
drop policy if exists "GS app server readable live" on public.live_streams;
create policy "GS app server readable live" on public.live_streams for all using (true) with check (true);
drop policy if exists "GS app server readable live comments" on public.live_comments;
create policy "GS app server readable live comments" on public.live_comments for all using (true) with check (true);
drop policy if exists "GS app server readable live gifts" on public.live_gifts;
create policy "GS app server readable live gifts" on public.live_gifts for all using (true) with check (true);
drop policy if exists "GS app server readable calls" on public.call_sessions;
create policy "GS app server readable calls" on public.call_sessions for all using (true) with check (true);
drop policy if exists "GS app server readable call signals" on public.call_signals;
create policy "GS app server readable call signals" on public.call_signals for all using (true) with check (true);
drop policy if exists "GS app server readable call events" on public.call_events;
create policy "GS app server readable call events" on public.call_events for all using (true) with check (true);

drop policy if exists "Message attachments public read" on storage.objects;
create policy "Message attachments public read" on storage.objects for select using (bucket_id = 'message-attachments');
drop policy if exists "Message attachments authenticated insert" on storage.objects;
create policy "Message attachments authenticated insert" on storage.objects for insert with check (bucket_id = 'message-attachments');
drop policy if exists "Story media public read" on storage.objects;
create policy "Story media public read" on storage.objects for select using (bucket_id = 'story-media');
drop policy if exists "Story media authenticated insert" on storage.objects;
create policy "Story media authenticated insert" on storage.objects for insert with check (bucket_id = 'story-media');
