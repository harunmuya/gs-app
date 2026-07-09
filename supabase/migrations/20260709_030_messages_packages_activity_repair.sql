-- Production repair for messaging, packages, story engagement, and one known profile correction.
-- Safe for existing clients: this does not delete real users.

create extension if not exists pgcrypto;

do $$
begin
    if to_regclass('public.messages') is not null then
        alter table public.messages add column if not exists content text;
        update public.messages
        set content = coalesce(nullif(content, ''), body, '')
        where content is null or content = '';
        alter table public.messages alter column content set default '';
        alter table public.messages alter column content set not null;
    end if;

    if to_regclass('public.conversations') is not null
       and exists (
           select 1 from information_schema.columns
           where table_schema = 'public'
             and table_name = 'conversations'
             and column_name = 'user_id'
       )
    then
        alter table public.conversations alter column user_id drop not null;
    end if;
end $$;

create table if not exists public.package_tiers (
    id text primary key
);

alter table public.package_tiers
    add column if not exists name text,
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

insert into public.package_tiers (
    id, name, price_ksh, phone_reveal, daily_message_limit, daily_gift_limit,
    daily_like_limit, daily_super_like_limit, daily_swipe_limit, daily_profile_view_limit,
    priority_visibility, international_access, voice_video_access, can_see_who_liked,
    can_see_who_viewed, can_send_voice_notes, can_send_images, can_go_live,
    can_send_gifts, can_use_nearby, max_gift_tier, starting_credits, features, updated_at
)
values
    ('free', 'Free', 0, false, 5, 0, 5, 0, 10, 10, false, false, false, false, false, false, false, false, false, false, 0, 0,
     '["Browse public members","Limited likes","Limited profile views"]'::jsonb, now()),
    ('basic', 'Basic', 650, false, 30, 10, 20, 5, 40, 40, false, false, false, false, false, false, true, false, true, false, 1, 50,
     '["More daily messages","Send images","Send starter gifts","More daily swipes"]'::jsonb, now()),
    ('silver', 'Silver', 1200, true, 0, 50, 0, 0, 0, 0, true, false, true, true, true, true, true, true, true, true, 3, 200,
     '["Unlimited swipes","Unlimited profile views","See who viewed you","See who liked you","Voice notes","Voice and video calls","Go live","Profile boost"]'::jsonb, now()),
    ('gold', 'Gold International', 3550, true, 0, 0, 0, 0, 0, 0, true, true, true, true, true, true, true, true, true, true, 4, 500,
     '["All Silver features","International visibility","Unlimited gifts","Top profile priority","Maximum credits"]'::jsonb, now())
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
    features = excluded.features,
    updated_at = now();

alter table public.users
    add column if not exists profile_label text,
    add column if not exists member_category text,
    add column if not exists looking_for text,
    add column if not exists intent_summary text,
    add column if not exists subscription_tier text not null default 'free',
    add column if not exists package_locked boolean not null default false,
    add column if not exists admin_approved boolean not null default true,
    add column if not exists show_in_public boolean not null default true,
    add column if not exists is_seed_profile boolean not null default false,
    add column if not exists created_at timestamptz not null default now(),
    add column if not exists updated_at timestamptz not null default now();

update public.users
set package_locked = false,
    admin_approved = true,
    updated_at = now()
where lower(coalesce(subscription_tier, 'free')) in ('basic', 'silver', 'gold', 'diamond');

update public.users
set profile_label = 'sugar_daddy',
    member_category = 'sugar_daddy',
    looking_for = 'Mistress',
    intent_summary = 'Sugar Daddy seeking Mistress.',
    updated_at = now()
where lower(coalesce(email, '')) = 'kingsleypinzy@gmail.com'
   or id::text = '4143208b-ea92-49d1-9c5c-ff15aa89a238';

update public.users
set profile_label = case
        when lower(coalesce(profile_label, member_category, '')) in ('sugarmummy', 'sugar mummy', 'sugar_mum') then 'sugar_mummy'
        when lower(coalesce(profile_label, member_category, '')) in ('sugardaddy', 'sugar daddy') then 'sugar_daddy'
        when lower(coalesce(profile_label, member_category, '')) in ('sugarguy', 'sugar guy', 'sugarboy', 'sugar boy', 'toy boy') then 'toyboy'
        else lower(coalesce(profile_label, member_category, 'sugar_mummy'))
    end,
    member_category = case
        when lower(coalesce(member_category, profile_label, '')) in ('sugarmummy', 'sugar mummy', 'sugar_mum') then 'sugar_mummy'
        when lower(coalesce(member_category, profile_label, '')) in ('sugardaddy', 'sugar daddy') then 'sugar_daddy'
        when lower(coalesce(member_category, profile_label, '')) in ('sugarguy', 'sugar guy', 'sugarboy', 'sugar boy', 'toy boy') then 'toyboy'
        else lower(coalesce(member_category, profile_label, 'sugar_mummy'))
    end,
    updated_at = now()
where profile_label is not null or member_category is not null;

update public.users
set looking_for = case
        when profile_label = 'sugar_mummy' then 'Sugar Guy / Toyboy'
        when profile_label = 'sugar_daddy' then 'Mistress'
        when profile_label = 'mistress' then 'Sugar Daddy'
        when profile_label = 'toyboy' then 'Sugar Mummy'
        else coalesce(looking_for, '')
    end,
    intent_summary = case
        when profile_label = 'sugar_mummy' then 'Sugar Mummy seeking Sugar Guy / Toyboy.'
        when profile_label = 'sugar_daddy' then 'Sugar Daddy seeking Mistress.'
        when profile_label = 'mistress' then 'Mistress seeking Sugar Daddy.'
        when profile_label = 'toyboy' then 'Sugar Guy / Toyboy seeking Sugar Mummy.'
        else intent_summary
    end,
    updated_at = now()
where coalesce(is_seed_profile, false) = true;

do $$
begin
    if to_regclass('public.story_views') is not null then
        delete from public.story_views a
        using public.story_views b
        where a.ctid < b.ctid
          and a.story_id = b.story_id
          and a.viewer_id is not distinct from b.viewer_id
          and a.viewer_id is not null;
        create unique index if not exists story_views_story_viewer_unique_idx
            on public.story_views (story_id, viewer_id)
            where viewer_id is not null;
    end if;

    if to_regclass('public.story_likes') is not null then
        delete from public.story_likes a
        using public.story_likes b
        where a.ctid < b.ctid
          and a.story_id = b.story_id
          and a.user_id = b.user_id;
        create unique index if not exists story_likes_story_user_unique_idx
            on public.story_likes (story_id, user_id);
    end if;
end $$;

create index if not exists users_real_priority_idx
    on public.users (is_seed_profile, show_in_public, created_at desc);
