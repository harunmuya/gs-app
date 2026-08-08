-- GS app production full rebuild foundation.
-- Safe for live databases: additive changes only. No deletes, no truncates, no reseeding.

create extension if not exists pgcrypto;

create table if not exists public.package_tiers (
    id text primary key,
    name text not null,
    price_ksh integer not null default 0,
    sort_order integer not null default 0,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

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
    add column if not exists latitude numeric(10, 7),
    add column if not exists longitude numeric(10, 7),
    add column if not exists geo_updated_at timestamptz,
    add column if not exists phone text,
    add column if not exists phone_number text,
    add column if not exists preference text,
    add column if not exists profile_label text,
    add column if not exists member_category text,
    add column if not exists looking_for text,
    add column if not exists intent_summary text,
    add column if not exists wants text,
    add column if not exists needed_qualities text,
    add column if not exists age_range_preference text,
    add column if not exists auth_user_id uuid,
    add column if not exists show_in_public boolean default true,
    add column if not exists admin_approved boolean default true,
    add column if not exists package_locked boolean default false,
    add column if not exists package_expires_at timestamptz,
    add column if not exists is_banned boolean default false,
    add column if not exists is_suspended boolean default false,
    add column if not exists is_seed_profile boolean not null default false,
    add column if not exists real_user boolean not null default true,
    add column if not exists seed_category text,
    add column if not exists seed_source_path text,
    add column if not exists seed_media_ok boolean not null default true,
    add column if not exists account_type text,
    add column if not exists profile_completion_status text not null default 'incomplete',
    add column if not exists profile_completion_percentage integer not null default 0,
    add column if not exists has_approved_primary_photo boolean not null default false,
    add column if not exists onboarding_completed_at timestamptz,
    add column if not exists discoverability_status text not null default 'hidden_until_complete',
    add column if not exists terms_accepted_at timestamptz,
    add column if not exists privacy_accepted_at timestamptz,
    add column if not exists location_consent_at timestamptz,
    add column if not exists precise_location_consent_at timestamptz,
    add column if not exists last_profile_reminder_at timestamptz,
    add column if not exists account_deleted_at timestamptz,
    add column if not exists boost_expires_at timestamptz,
    add column if not exists boost_score integer not null default 0,
    add column if not exists created_at timestamptz not null default now(),
    add column if not exists updated_at timestamptz not null default now();

alter table if exists public.users
    alter column show_in_public set default true,
    alter column admin_approved set default true,
    alter column package_locked set default false,
    alter column is_banned set default false,
    alter column is_suspended set default false;

update public.users
set
    real_user = case when coalesce(is_seed_profile, false) = true or email ilike 'seed+%' then false else true end,
    account_type = coalesce(nullif(account_type, ''), case when coalesce(is_seed_profile, false) = true or email ilike 'seed+%' then 'seeded' else 'real' end),
    phone_number = coalesce(nullif(phone_number, ''), phone),
    phone = coalesce(nullif(phone, ''), phone_number),
    member_category = coalesce(nullif(member_category, ''), nullif(profile_label, ''), nullif(preference, '')),
    profile_label = coalesce(nullif(profile_label, ''), nullif(member_category, ''), nullif(preference, '')),
    looking_for = coalesce(nullif(looking_for, ''), nullif(wants, '')),
    show_in_public = coalesce(show_in_public, true),
    admin_approved = coalesce(admin_approved, true),
    package_locked = coalesce(package_locked, false),
    is_banned = coalesce(is_banned, false),
    is_suspended = coalesce(is_suspended, false),
    updated_at = now()
where id is not null;

do $$
declare
    photos_udt text;
begin
    select udt_name into photos_udt
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'photos';

    if photos_udt = '_text' then
        execute $sql$
            update public.users
            set
                has_approved_primary_photo = case
                    when coalesce(avatar_url, '') <> '' then true
                    when cardinality(photos) > 0 then true
                    else false
                end,
                profile_completion_percentage =
                    (case when coalesce(display_name, '') <> '' then 15 else 0 end) +
                    (case when coalesce(avatar_url, '') <> '' or cardinality(photos) > 0 then 25 else 0 end) +
                    (case when coalesce(age, 0) >= 18 then 15 else 0 end) +
                    (case when coalesce(location, city, '') <> '' then 15 else 0 end) +
                    (case when coalesce(profile_label, member_category, preference, '') <> '' then 15 else 0 end) +
                    (case when coalesce(looking_for, wants, '') <> '' then 15 else 0 end)
            where id is not null
        $sql$;
    else
        execute $sql$
            update public.users
            set
                has_approved_primary_photo = case
                    when coalesce(avatar_url, '') <> '' then true
                    when jsonb_typeof(photos) = 'array' and jsonb_array_length(photos) > 0 then true
                    else false
                end,
                profile_completion_percentage =
                    (case when coalesce(display_name, '') <> '' then 15 else 0 end) +
                    (case when coalesce(avatar_url, '') <> '' or (jsonb_typeof(photos) = 'array' and jsonb_array_length(photos) > 0) then 25 else 0 end) +
                    (case when coalesce(age, 0) >= 18 then 15 else 0 end) +
                    (case when coalesce(location, city, '') <> '' then 15 else 0 end) +
                    (case when coalesce(profile_label, member_category, preference, '') <> '' then 15 else 0 end) +
                    (case when coalesce(looking_for, wants, '') <> '' then 15 else 0 end)
            where id is not null
        $sql$;
    end if;
end $$;

update public.users
set
    profile_completion_status = case
        when coalesce(is_seed_profile, false) = true or email ilike 'seed+%' then 'complete'
        when profile_completion_percentage >= 85 then 'complete'
        else 'incomplete'
    end,
    discoverability_status = case
        when coalesce(is_banned, false) = true then 'banned'
        when coalesce(is_suspended, false) = true then 'suspended'
        when coalesce(is_seed_profile, false) = true or email ilike 'seed+%' then 'visible'
        when profile_completion_percentage >= 85 and has_approved_primary_photo = true then 'visible'
        else 'hidden_until_complete'
    end,
    onboarding_completed_at = case
        when profile_completion_percentage >= 85 then coalesce(onboarding_completed_at, now())
        else onboarding_completed_at
    end
where id is not null;

alter table if exists public.package_tiers
    add column if not exists features jsonb default '[]'::jsonb,
    add column if not exists daily_like_limit integer default 5,
    add column if not exists daily_super_like_limit integer default 0,
    add column if not exists daily_swipe_limit integer default 10,
    add column if not exists daily_profile_view_limit integer default 10,
    add column if not exists can_see_who_liked boolean default false,
    add column if not exists can_see_who_viewed boolean default false,
    add column if not exists can_send_voice_notes boolean default false,
    add column if not exists can_send_images boolean default false,
    add column if not exists can_go_live boolean default false,
    add column if not exists can_send_gifts boolean default false,
    add column if not exists can_use_nearby boolean default false,
    add column if not exists max_gift_tier integer default 0,
    add column if not exists starting_credits integer default 0,
    add column if not exists badge_label text default '',
    add column if not exists badge_color text default '',
    add column if not exists description text default '',
    add column if not exists updated_at timestamptz not null default now();

create table if not exists public.conversations (
    id uuid primary key default gen_random_uuid(),
    user_one_id uuid references public.users(id) on delete cascade,
    user_two_id uuid references public.users(id) on delete cascade,
    status text not null default 'active',
    last_message_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table if exists public.conversations
    add column if not exists user_one_id uuid references public.users(id) on delete cascade,
    add column if not exists user_two_id uuid references public.users(id) on delete cascade,
    add column if not exists status text not null default 'active',
    add column if not exists last_message_at timestamptz,
    add column if not exists updated_at timestamptz not null default now();

do $$
begin
    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'conversations' and column_name = 'user_id'
    ) then
        execute 'alter table public.conversations alter column user_id drop not null';
    end if;
end $$;

create table if not exists public.messages (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid references public.conversations(id) on delete cascade,
    sender_id uuid references public.users(id) on delete set null,
    receiver_id uuid references public.users(id) on delete set null,
    body text default '',
    content text not null default '',
    message_type text not null default 'text',
    status text not null default 'sent',
    read_at timestamptz,
    delivered_at timestamptz,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

alter table if exists public.messages
    add column if not exists conversation_id uuid references public.conversations(id) on delete cascade,
    add column if not exists sender_id uuid references public.users(id) on delete set null,
    add column if not exists receiver_id uuid references public.users(id) on delete set null,
    add column if not exists body text default '',
    add column if not exists content text not null default '',
    add column if not exists message_type text not null default 'text',
    add column if not exists status text not null default 'sent',
    add column if not exists read_at timestamptz,
    add column if not exists delivered_at timestamptz,
    add column if not exists metadata jsonb not null default '{}'::jsonb,
    add column if not exists created_at timestamptz not null default now();

update public.messages
set
    body = coalesce(nullif(body, ''), nullif(content, ''), ''),
    content = coalesce(nullif(content, ''), nullif(body, ''), '')
where id is not null;

create table if not exists public.user_terms_acceptances (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.users(id) on delete cascade,
    terms_version text not null default '2026-07-10',
    privacy_version text not null default '2026-07-10',
    platform text not null default 'web',
    ip_address text,
    user_agent text,
    accepted_at timestamptz not null default now()
);

create table if not exists public.profile_completion_reminders (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.users(id) on delete cascade,
    email text,
    reminder_number integer not null default 1,
    status text not null default 'queued',
    attempts integer not null default 0,
    last_error text default '',
    scheduled_for timestamptz not null default now(),
    sent_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(user_id, reminder_number)
);

create table if not exists public.admin_attention_items (
    id uuid primary key default gen_random_uuid(),
    section text not null,
    item_type text not null,
    user_id uuid references public.users(id) on delete set null,
    severity text not null default 'normal',
    title text not null,
    body text default '',
    status text not null default 'open',
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    resolved_at timestamptz
);

create table if not exists public.payment_provider_configs (
    id uuid primary key default gen_random_uuid(),
    provider text not null unique,
    display_name text not null,
    is_active boolean not null default false,
    supported_countries text[] not null default array[]::text[],
    supported_currencies text[] not null default array[]::text[],
    supports_mpesa_delivery boolean not null default false,
    android_url text default '',
    ios_url text default '',
    web_url text default '',
    logo_url text default '',
    admin_notes text default '',
    last_verified_at timestamptz,
    public_metadata jsonb not null default '{}'::jsonb,
    private_metadata jsonb not null default '{}'::jsonb,
    sort_order integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.payment_events (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.users(id) on delete set null,
    provider text not null,
    package_id text,
    amount_ksh integer,
    provider_reference text,
    status text not null default 'pending',
    raw_payload jsonb not null default '{}'::jsonb,
    reviewed_by uuid references public.users(id) on delete set null,
    reviewed_at timestamptz,
    created_at timestamptz not null default now(),
    unique(provider, provider_reference)
);

create table if not exists public.package_usage_events (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.users(id) on delete cascade,
    package_id text not null default 'free',
    feature text not null,
    action text not null,
    allowed boolean not null default true,
    reason text default '',
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists users_discoverability_idx on public.users (discoverability_status, show_in_public, is_banned, is_suspended, created_at desc);
create index if not exists users_seed_integrity_idx on public.users (is_seed_profile, real_user, seed_category);
create index if not exists users_category_idx on public.users (profile_label, member_category, preference);
create index if not exists users_location_idx on public.users (latitude, longitude) where latitude is not null and longitude is not null;
create index if not exists conversations_pair_idx on public.conversations (user_one_id, user_two_id, updated_at desc);
create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at desc);
create index if not exists profile_completion_reminders_due_idx on public.profile_completion_reminders (status, scheduled_for);
create index if not exists admin_attention_open_idx on public.admin_attention_items (status, section, severity, created_at desc);
create index if not exists payment_events_user_idx on public.payment_events (user_id, created_at desc);
create index if not exists package_usage_user_feature_idx on public.package_usage_events (user_id, feature, created_at desc);

create or replace view public.admin_seed_profile_audit as
select
    count(*) filter (where coalesce(is_seed_profile, false) = true or email ilike 'seed+%') as total_seed_profiles,
    count(*) filter (where coalesce(is_seed_profile, false) = true and coalesce(real_user, true) = true) as seeds_marked_real,
    count(*) filter (where coalesce(is_seed_profile, false) = false and email ilike 'seed+%') as seed_email_not_flagged,
    count(*) filter (where coalesce(is_seed_profile, false) = true and coalesce(auth_user_id::text, '') <> '') as seeded_with_auth_owner,
    count(*) filter (where coalesce(is_seed_profile, false) = true and coalesce(avatar_url, '') = '') as seeded_missing_avatar,
    count(*) filter (where coalesce(is_seed_profile, false) = true and coalesce(seed_category, '') = '') as seeded_missing_category
from public.users;

create or replace view public.admin_legacy_user_repair_audit as
select
    count(*) filter (where coalesce(is_seed_profile, false) = false) as real_users,
    count(*) filter (where coalesce(is_seed_profile, false) = false and profile_completion_status = 'complete') as complete_real_users,
    count(*) filter (where coalesce(is_seed_profile, false) = false and profile_completion_status <> 'complete') as incomplete_real_users,
    count(*) filter (where coalesce(is_seed_profile, false) = false and has_approved_primary_photo = false) as real_users_missing_primary_photo,
    count(*) filter (where coalesce(is_seed_profile, false) = false and discoverability_status = 'visible') as visible_real_users,
    count(*) filter (where coalesce(is_seed_profile, false) = false and discoverability_status = 'hidden_until_complete') as hidden_until_complete_real_users,
    count(*) filter (where coalesce(is_banned, false) = true) as banned_users,
    count(*) filter (where coalesce(is_suspended, false) = true) as suspended_users
from public.users;

create or replace view public.admin_package_schema_audit as
select
    count(*) filter (where id = 'free') as free_rows,
    count(*) filter (where id = 'basic') as basic_rows,
    count(*) filter (where id = 'silver') as silver_rows,
    count(*) filter (where id = 'gold') as gold_rows,
    count(*) filter (where can_see_who_viewed is null) as missing_viewer_gate,
    count(*) filter (where can_send_voice_notes is null) as missing_voice_note_gate,
    count(*) filter (where can_go_live is null) as missing_live_gate,
    count(*) filter (where daily_swipe_limit is null) as missing_swipe_limit
from public.package_tiers;

alter table public.user_terms_acceptances enable row level security;
alter table public.profile_completion_reminders enable row level security;
alter table public.admin_attention_items enable row level security;
alter table public.payment_provider_configs enable row level security;
alter table public.payment_events enable row level security;
alter table public.package_usage_events enable row level security;

drop policy if exists "Users read own terms acceptances" on public.user_terms_acceptances;
create policy "Users read own terms acceptances" on public.user_terms_acceptances
for select using (auth.uid() in (select auth_user_id from public.users where id = user_id));

drop policy if exists "Users read own reminders" on public.profile_completion_reminders;
create policy "Users read own reminders" on public.profile_completion_reminders
for select using (auth.uid() in (select auth_user_id from public.users where id = user_id));

drop policy if exists "Public read active payment providers" on public.payment_provider_configs;
create policy "Public read active payment providers" on public.payment_provider_configs
for select using (is_active = true);

drop policy if exists "Users read own payments" on public.payment_events;
create policy "Users read own payments" on public.payment_events
for select using (auth.uid() in (select auth_user_id from public.users where id = user_id));

drop policy if exists "Users read own package usage" on public.package_usage_events;
create policy "Users read own package usage" on public.package_usage_events
for select using (auth.uid() in (select auth_user_id from public.users where id = user_id));

insert into public.admin_attention_items (section, item_type, severity, title, body, metadata)
select 'seed_mgmt', 'seed_integrity', 'high', 'Seed profile integrity needs review',
       'Seeded profiles should be separated from real users and must not have real auth owners.',
       jsonb_build_object('source', 'admin_seed_profile_audit')
from public.admin_seed_profile_audit
where (
    seeds_marked_real > 0
    or seed_email_not_flagged > 0
    or seeded_with_auth_owner > 0
    or seeded_missing_avatar > 0
    or seeded_missing_category > 0
)
  and not exists (
      select 1 from public.admin_attention_items
      where section = 'seed_mgmt'
        and item_type = 'seed_integrity'
        and status = 'open'
  );

insert into public.admin_attention_items (section, item_type, severity, title, body, metadata)
select 'users', 'legacy_incomplete_profiles', 'normal', 'Legacy users need profile completion',
       'Some real users can log in but are hidden until they complete required profile fields and upload a usable primary photo.',
       jsonb_build_object('source', 'admin_legacy_user_repair_audit')
from public.admin_legacy_user_repair_audit
where (
    incomplete_real_users > 0
    or real_users_missing_primary_photo > 0
)
  and not exists (
      select 1 from public.admin_attention_items
      where section = 'users'
        and item_type = 'legacy_incomplete_profiles'
        and status = 'open'
  );
