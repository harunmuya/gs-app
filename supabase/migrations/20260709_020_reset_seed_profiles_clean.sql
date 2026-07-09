-- Clean seed profile reset for genuine-sugarmummies-app.
-- Deletes ONLY seeded/fake profile rows and their related activity, then inserts a clean balanced seed set.
-- Real client accounts are not targeted.

create extension if not exists pgcrypto;

alter table public.users
    add column if not exists username text,
    add column if not exists display_name text,
    add column if not exists email text,
    add column if not exists avatar_url text,
    add column if not exists photos text[] not null default '{}',
    add column if not exists bio text,
    add column if not exists description text,
    add column if not exists age integer,
    add column if not exists location text,
    add column if not exists country text,
    add column if not exists city text,
    add column if not exists phone text,
    add column if not exists phone_number text,
    add column if not exists password_hash text,
    add column if not exists profile_label text,
    add column if not exists member_category text,
    add column if not exists looking_for text,
    add column if not exists intent_summary text,
    add column if not exists wants text,
    add column if not exists needed_qualities text,
    add column if not exists age_range_preference text,
    add column if not exists hobbies text[] not null default '{}',
    add column if not exists interests text[] not null default '{}',
    add column if not exists subscription_tier text not null default 'free',
    add column if not exists verified boolean not null default false,
    add column if not exists verification_status text not null default 'unsubmitted',
    add column if not exists show_in_public boolean not null default true,
    add column if not exists is_seed_profile boolean not null default false,
    add column if not exists is_banned boolean not null default false,
    add column if not exists is_suspended boolean not null default false,
    add column if not exists total_profile_views integer not null default 0,
    add column if not exists followers_count integer not null default 0,
    add column if not exists gifts_received_count integer not null default 0,
    add column if not exists admin_approved boolean not null default true,
    add column if not exists package_locked boolean not null default false,
    add column if not exists phone_reveal_plan text,
    add column if not exists boost_expires_at timestamptz,
    add column if not exists boost_score integer not null default 0,
    add column if not exists created_at timestamptz not null default now(),
    add column if not exists updated_at timestamptz not null default now(),
    add column if not exists last_seen_at timestamptz;

create temp table gs_seed_user_ids(id uuid primary key) on commit drop;

insert into gs_seed_user_ids(id)
select id
from public.users
where coalesce(is_seed_profile, false)
   or lower(coalesce(email, '')) like '%@gs-seed.app'
   or lower(coalesce(email, '')) like 'seed+app-%@genuinesugarmummies.co.ke'
   or lower(coalesce(email, '')) like 'seed-clean-%@genuinesugarmummies.co.ke'
   or lower(coalesce(avatar_url, '') || ' ' || coalesce(photos::text, '')) like '%/seed/%'
   or lower(coalesce(avatar_url, '') || ' ' || coalesce(photos::text, '')) like '%/seed-photos/%';

do $$
declare
    target record;
begin
    if to_regclass('public.messages') is not null
       and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'messages' and column_name = 'sender_id')
       and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'messages' and column_name = 'receiver_id')
    then
        if to_regclass('public.message_attachments') is not null
           and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'message_attachments' and column_name = 'message_id')
        then
            delete from public.message_attachments
            where message_id::text in (
                select id::text from public.messages
                where sender_id::text in (select id::text from gs_seed_user_ids)
                   or receiver_id::text in (select id::text from gs_seed_user_ids)
            );
        end if;

        if to_regclass('public.voice_notes') is not null
           and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'voice_notes' and column_name = 'message_id')
        then
            delete from public.voice_notes
            where message_id::text in (
                select id::text from public.messages
                where sender_id::text in (select id::text from gs_seed_user_ids)
                   or receiver_id::text in (select id::text from gs_seed_user_ids)
            );
        end if;
    end if;

    if to_regclass('public.user_stories') is not null
       and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_stories' and column_name = 'user_id')
    then
        if to_regclass('public.story_views') is not null
           and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'story_views' and column_name = 'story_id')
        then
            delete from public.story_views
            where story_id::text in (
                select id::text from public.user_stories
                where user_id::text in (select id::text from gs_seed_user_ids)
            );
        end if;

        if to_regclass('public.story_likes') is not null
           and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'story_likes' and column_name = 'story_id')
        then
            delete from public.story_likes
            where story_id::text in (
                select id::text from public.user_stories
                where user_id::text in (select id::text from gs_seed_user_ids)
            );
        end if;
    end if;

    if to_regclass('public.live_streams') is not null
       and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'live_streams' and column_name = 'host_id')
    then
        if to_regclass('public.live_viewers') is not null
           and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'live_viewers' and column_name = 'stream_id')
        then
            delete from public.live_viewers
            where stream_id::text in (
                select id::text from public.live_streams
                where host_id::text in (select id::text from gs_seed_user_ids)
            );
        end if;

        if to_regclass('public.live_comments') is not null
           and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'live_comments' and column_name = 'stream_id')
        then
            delete from public.live_comments
            where stream_id::text in (
                select id::text from public.live_streams
                where host_id::text in (select id::text from gs_seed_user_ids)
            );
        end if;

        if to_regclass('public.live_gifts') is not null
           and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'live_gifts' and column_name = 'stream_id')
        then
            delete from public.live_gifts
            where stream_id::text in (
                select id::text from public.live_streams
                where host_id::text in (select id::text from gs_seed_user_ids)
            );
        end if;
    end if;

    if to_regclass('public.call_sessions') is not null
       and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'call_sessions' and column_name = 'caller_id')
       and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'call_sessions' and column_name = 'receiver_id')
    then
        if to_regclass('public.call_signals') is not null
           and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'call_signals' and column_name = 'call_session_id')
        then
            delete from public.call_signals
            where call_session_id::text in (
                select id::text from public.call_sessions
                where caller_id::text in (select id::text from gs_seed_user_ids)
                   or receiver_id::text in (select id::text from gs_seed_user_ids)
            );
        end if;

        if to_regclass('public.call_events') is not null
           and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'call_events' and column_name = 'call_session_id')
        then
            delete from public.call_events
            where call_session_id::text in (
                select id::text from public.call_sessions
                where caller_id::text in (select id::text from gs_seed_user_ids)
                   or receiver_id::text in (select id::text from gs_seed_user_ids)
            );
        end if;
    end if;

    for target in
        select *
        from (values
            ('message_attachments', 'owner_id'), ('voice_notes', 'owner_id'),
            ('messages', 'sender_id'), ('messages', 'receiver_id'),
            ('member_messages', 'member_id'),
            ('member_messages', 'sender_id'), ('member_messages', 'receiver_id'),
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
                'delete from public.%I where %I::text in (select id::text from gs_seed_user_ids)',
                target.table_name,
                target.column_name
            );
        end if;
    end loop;

    if to_regclass('public.conversations') is not null then
        if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'conversations' and column_name = 'user_one_id') then
            delete from public.conversations where user_one_id::text in (select id::text from gs_seed_user_ids);
        end if;
        if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'conversations' and column_name = 'user_two_id') then
            delete from public.conversations where user_two_id::text in (select id::text from gs_seed_user_ids);
        end if;
        if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'conversations' and column_name = 'user_id') then
            delete from public.conversations where user_id::text in (select id::text from gs_seed_user_ids);
            alter table public.conversations alter column user_id drop not null;
        end if;
    end if;
end $$;

delete from public.users where id in (select id from gs_seed_user_ids);

insert into public.users (
    id, username, display_name, email, avatar_url, photos, bio, description, age, location, country, city,
    phone, phone_number, password_hash, profile_label, member_category, looking_for, intent_summary, wants, needed_qualities,
    age_range_preference, hobbies, interests, subscription_tier, verified, verification_status, show_in_public,
    is_seed_profile, is_banned, is_suspended, total_profile_views, followers_count, gifts_received_count,
    admin_approved, package_locked, phone_reveal_plan, boost_expires_at, boost_score, created_at, updated_at, last_seen_at
)
select
    gen_random_uuid(),
    username,
    display_name,
    email,
    avatar_url,
    array[avatar_url],
    bio,
    bio,
    age,
    location,
    country,
    location,
    '',
    '',
    'seed-profile-no-login',
    profile_label,
    profile_label,
    looking_for,
    'I am a ' || replace(profile_label, '_', ' ') || ' looking for ' || looking_for || '.',
    'A respectful connection with clear communication and real interest.',
    'respectful, honest, serious, kind',
    case when profile_label = 'sugar_mummy' then '21-36' when profile_label = 'mistress' then '38-68' else '23-42' end,
    array['travel', 'private dates', 'fine dining'],
    array['verified members', 'respectful companionship', 'lifestyle support'],
    'silver',
    true,
    'verified',
    true,
    true,
    false,
    false,
    1200 + (rn * 97),
    45 + (rn * 7),
    6 + (rn % 80),
    true,
    false,
    'silver',
    case when rn <= 18 then now() + interval '18 hours' else null end,
    case when rn <= 18 then 900 - (rn * 7) else 0 end,
    now() - ((rn + 4) * interval '1 day'),
    now(),
    now() - ((rn % 16) * interval '23 minutes')
from (
select row_number() over (order by profile_label, username) as rn, *
from (values
    ('mary_wanjiku_seed', 'Mary Wanjiku', 'seed-clean-001@genuinesugarmummies.co.ke', '/seed/sugarmums/photo_100_2026-06-25_14-21-42.jpg', 44, 'Nairobi', 'Kenya', 'sugar_mummy', 'Sugar Guy / Toyboy', 'A warm, mature woman ready for respectful companionship.'),
    ('grace_achieng_seed', 'Grace Achieng', 'seed-clean-002@genuinesugarmummies.co.ke', '/seed/sugarmums/photo_10_2026-06-24_14-00-45.jpg', 39, 'Kisumu', 'Kenya', 'sugar_mummy', 'Sugar Guy / Toyboy', 'Interested in a kind younger man who communicates clearly.'),
    ('rose_njeri_seed', 'Rose Njeri', 'seed-clean-003@genuinesugarmummies.co.ke', '/seed/sugarmums/photo_11_2026-06-24_14-00-45.jpg', 48, 'Nakuru', 'Kenya', 'sugar_mummy', 'Sugar Guy / Toyboy', 'Looking for a serious sugar guy with good manners.'),
    ('janet_atieno_seed', 'Janet Atieno', 'seed-clean-004@genuinesugarmummies.co.ke', '/seed/sugarmums/photo_12_2026-06-24_14-00-45.jpg', 42, 'Mombasa', 'Kenya', 'sugar_mummy', 'Sugar Guy / Toyboy', 'Ready to meet a genuine toyboy for private conversations.'),
    ('catherine_muthoni_seed', 'Catherine Muthoni', 'seed-clean-005@genuinesugarmummies.co.ke', '/seed/sugarmums/photo_12_2026-06-25_14-22-09.jpg', 51, 'Thika', 'Kenya', 'sugar_mummy', 'Sugar Guy / Toyboy', 'Seeking a calm younger man who respects boundaries.'),
    ('naomi_chebet_seed', 'Naomi Chebet', 'seed-clean-006@genuinesugarmummies.co.ke', '/seed/sugarmums/photo_13_2026-06-24_14-00-45.jpg', 46, 'Eldoret', 'Kenya', 'sugar_mummy', 'Sugar Guy / Toyboy', 'I value honesty, discretion, and steady communication.'),
    ('lilian_nyambura_seed', 'Lilian Nyambura', 'seed-clean-007@genuinesugarmummies.co.ke', '/seed/sugarmums/photo_14_2026-06-24_14-00-45.jpg', 43, 'Nairobi', 'Kenya', 'sugar_mummy', 'Sugar Guy / Toyboy', 'Interested in a clean, respectful and confident sugar guy.'),
    ('tabitha_okello_seed', 'Tabitha Okello', 'seed-clean-008@genuinesugarmummies.co.ke', '/seed/sugarmums/photo_15_2026-06-24_14-00-45.jpg', 55, 'Kampala', 'Uganda', 'sugar_mummy', 'Sugar Guy / Toyboy', 'Looking for patient companionship and real interest.'),
    ('priscilla_kamau_seed', 'Priscilla Kamau', 'seed-clean-009@genuinesugarmummies.co.ke', '/seed/sugarmums/photo_16_2026-06-24_14-00-45.jpg', 49, 'Dar es Salaam', 'Tanzania', 'sugar_mummy', 'Sugar Guy / Toyboy', 'I prefer direct communication and mature respect.'),
    ('sarah_nambooze_seed', 'Sarah Nambooze', 'seed-clean-010@genuinesugarmummies.co.ke', '/seed/sugarmums/photo_17_2026-06-24_14-00-45.jpg', 45, 'Kampala', 'Uganda', 'sugar_mummy', 'Sugar Guy / Toyboy', 'Seeking a genuine younger man with a warm personality.'),
    ('caroline_wambui_seed', 'Caroline Wambui', 'seed-clean-011@genuinesugarmummies.co.ke', '/seed/sugarmums/photo_18_2026-06-24_14-00-45.jpg', 47, 'Nairobi', 'Kenya', 'sugar_mummy', 'Sugar Guy / Toyboy', 'Looking for a respectful toyboy who keeps promises.'),
    ('esther_njeri_seed', 'Esther Njeri', 'seed-clean-012@genuinesugarmummies.co.ke', '/seed/sugarmums/photo_19_2026-06-24_14-00-45.jpg', 50, 'Nakuru', 'Kenya', 'sugar_mummy', 'Sugar Guy / Toyboy', 'I enjoy calm dates and honest conversations.'),
    ('lucy_atieno_seed', 'Lucy Atieno', 'seed-clean-013@genuinesugarmummies.co.ke', '/seed/sugarmums/photo_20_2026-06-24_14-00-45.jpg', 41, 'Kisumu', 'Kenya', 'sugar_mummy', 'Sugar Guy / Toyboy', 'Seeking one serious sugar guy for a genuine connection.'),
    ('mercy_karanja_seed', 'Mercy Karanja', 'seed-clean-014@genuinesugarmummies.co.ke', '/seed/sugarmums/photo_24_2026-06-24_14-00-45.jpg', 46, 'Nairobi', 'Kenya', 'sugar_mummy', 'Sugar Guy / Toyboy', 'Discreet, kind, and ready to connect with the right person.'),
    ('stella_naliaka_seed', 'Stella Naliaka', 'seed-clean-015@genuinesugarmummies.co.ke', '/seed/sugarmums/photo_22_2026-06-24_14-00-45.jpg', 52, 'Eldoret', 'Kenya', 'sugar_mummy', 'Sugar Guy / Toyboy', 'I like confidence, respect, and good conversation.'),
    ('ruth_nyambura_seed', 'Ruth Nyambura', 'seed-clean-016@genuinesugarmummies.co.ke', '/seed/sugarmums/photo_23_2026-06-24_14-00-45.jpg', 43, 'Thika', 'Kenya', 'sugar_mummy', 'Sugar Guy / Toyboy', 'Looking for a serious younger man with good energy.'),
    ('monica_moraa_seed', 'Monica Moraa', 'seed-clean-017@genuinesugarmummies.co.ke', '/seed/sugarmums/photo_31_2026-06-24_14-00-45.jpg', 45, 'Kisii', 'Kenya', 'sugar_mummy', 'Sugar Guy / Toyboy', 'I want honest attention and respectful companionship.'),
    ('beatrice_awino_seed', 'Beatrice Awino', 'seed-clean-018@genuinesugarmummies.co.ke', '/seed/sugarmums/photo_32_2026-06-24_14-00-45.jpg', 49, 'Kisumu', 'Kenya', 'sugar_mummy', 'Sugar Guy / Toyboy', 'Seeking a real toyboy who is patient and discreet.'),
    ('james_kamau_seed', 'James Kamau', 'seed-clean-101@genuinesugarmummies.co.ke', '/seed/sugar-dads/photo_10_2026-06-25_14-22-09.jpg', 56, 'Nairobi', 'Kenya', 'sugar_daddy', 'Mistress', 'A mature sugar daddy looking for a confident mistress.'),
    ('joseph_kimani_seed', 'Joseph Kimani', 'seed-clean-102@genuinesugarmummies.co.ke', '/seed/sugar-dads/photo_11_2026-06-25_14-22-09.jpg', 52, 'Nakuru', 'Kenya', 'sugar_daddy', 'Mistress', 'Seeking a respectful mistress who values honesty.'),
    ('peter_mwangi_seed', 'Peter Mwangi', 'seed-clean-103@genuinesugarmummies.co.ke', '/seed/sugar-dads/photo_13_2026-06-25_14-22-09.jpg', 60, 'Nairobi', 'Kenya', 'sugar_daddy', 'Mistress', 'Interested in meaningful companionship with a mistress.'),
    ('samuel_otieno_seed', 'Samuel Otieno', 'seed-clean-104@genuinesugarmummies.co.ke', '/seed/sugar-dads/photo_14_2026-06-25_14-22-09.jpg', 58, 'Kisumu', 'Kenya', 'sugar_daddy', 'Mistress', 'Calm, generous, and interested in a genuine mistress.'),
    ('david_karanja_seed', 'David Karanja', 'seed-clean-105@genuinesugarmummies.co.ke', '/seed/sugar-dads/photo_15_2026-06-25_14-22-09.jpg', 54, 'Thika', 'Kenya', 'sugar_daddy', 'Mistress', 'Looking for a discreet and mature connection.'),
    ('patrick_njoroge_seed', 'Patrick Njoroge', 'seed-clean-106@genuinesugarmummies.co.ke', '/seed/sugar-dads/photo_16_2026-06-25_14-22-09.jpg', 62, 'Mombasa', 'Kenya', 'sugar_daddy', 'Mistress', 'Seeking a mistress who is honest and confident.'),
    ('george_mutua_seed', 'George Mutua', 'seed-clean-107@genuinesugarmummies.co.ke', '/seed/sugar-dads/photo_17_2026-06-25_14-22-09.jpg', 57, 'Nairobi', 'Kenya', 'sugar_daddy', 'Mistress', 'I value privacy, respect, and direct communication.'),
    ('daniel_wekesa_seed', 'Daniel Wekesa', 'seed-clean-108@genuinesugarmummies.co.ke', '/seed/sugar-dads/photo_18_2026-06-25_14-22-09.jpg', 59, 'Eldoret', 'Kenya', 'sugar_daddy', 'Mistress', 'Looking for a genuine mistress with a warm personality.'),
    ('martin_kariuki_seed', 'Martin Kariuki', 'seed-clean-109@genuinesugarmummies.co.ke', '/seed/sugar-dads/photo_19_2026-06-25_14-22-09.jpg', 53, 'Nakuru', 'Kenya', 'sugar_daddy', 'Mistress', 'Ready for a clear and respectful arrangement.'),
    ('anthony_kiplagat_seed', 'Anthony Kiplagat', 'seed-clean-110@genuinesugarmummies.co.ke', '/seed/sugar-dads/photo_20_2026-06-25_14-22-09.jpg', 61, 'Eldoret', 'Kenya', 'sugar_daddy', 'Mistress', 'Interested in a confident mistress who knows what she wants.'),
    ('robert_omondi_seed', 'Robert Omondi', 'seed-clean-111@genuinesugarmummies.co.ke', '/seed/sugar-dads/photo_21_2026-06-25_14-22-09.jpg', 55, 'Kisumu', 'Kenya', 'sugar_daddy', 'Mistress', 'A calm sugar daddy looking for a real connection.'),
    ('michael_barasa_seed', 'Michael Barasa', 'seed-clean-112@genuinesugarmummies.co.ke', '/seed/sugar-dads/photo_22_2026-06-25_14-22-09.jpg', 58, 'Kampala', 'Uganda', 'sugar_daddy', 'Mistress', 'Seeking maturity, discretion, and kindness.'),
    ('aisha_kamau_seed', 'Aisha Kamau', 'seed-clean-201@genuinesugarmummies.co.ke', '/seed/mistresses/photo_10_2026-06-25_14-21-41.jpg', 27, 'Nairobi', 'Kenya', 'mistress', 'Sugar Daddy', 'A confident mistress looking for a mature sugar daddy.'),
    ('brenda_kariuki_seed', 'Brenda Kariuki', 'seed-clean-202@genuinesugarmummies.co.ke', '/seed/mistresses/photo_11_2026-06-25_14-21-41.jpg', 29, 'Thika', 'Kenya', 'mistress', 'Sugar Daddy', 'Looking for a respectful sugar daddy with clear intentions.'),
    ('cynthia_nambooze_seed', 'Cynthia Nambooze', 'seed-clean-203@genuinesugarmummies.co.ke', '/seed/mistresses/photo_12_2026-06-25_14-21-41.jpg', 25, 'Kampala', 'Uganda', 'mistress', 'Sugar Daddy', 'I value confidence, honesty, and good support.'),
    ('diana_nkurunziza_seed', 'Diana Nkurunziza', 'seed-clean-204@genuinesugarmummies.co.ke', '/seed/mistresses/photo_13_2026-06-25_14-21-41.jpg', 31, 'Kigali', 'Rwanda', 'mistress', 'Sugar Daddy', 'Seeking a mature sugar daddy for a genuine connection.'),
    ('evelyn_okello_seed', 'Evelyn Okello', 'seed-clean-205@genuinesugarmummies.co.ke', '/seed/mistresses/photo_14_2026-06-25_14-21-41.jpg', 28, 'Kisumu', 'Kenya', 'mistress', 'Sugar Daddy', 'Confident, warm, and looking for a serious sugar daddy.'),
    ('faith_chebet_seed', 'Faith Chebet', 'seed-clean-206@genuinesugarmummies.co.ke', '/seed/mistresses/photo_15_2026-06-25_14-21-41.jpg', 26, 'Eldoret', 'Kenya', 'mistress', 'Sugar Daddy', 'Interested in respectful companionship with a mature man.'),
    ('irene_wairimu_seed', 'Irene Wairimu', 'seed-clean-207@genuinesugarmummies.co.ke', '/seed/mistresses/photo_16_2026-06-25_14-21-41.jpg', 30, 'Nairobi', 'Kenya', 'mistress', 'Sugar Daddy', 'Looking for a generous sugar daddy who communicates well.'),
    ('joyce_njeri_seed', 'Joyce Njeri', 'seed-clean-208@genuinesugarmummies.co.ke', '/seed/mistresses/photo_17_2026-06-25_14-21-41.jpg', 24, 'Nakuru', 'Kenya', 'mistress', 'Sugar Daddy', 'Seeking maturity, privacy, and consistency.'),
    ('miriam_achieng_seed', 'Miriam Achieng', 'seed-clean-209@genuinesugarmummies.co.ke', '/seed/mistresses/photo_18_2026-06-25_14-21-41.jpg', 28, 'Kisumu', 'Kenya', 'mistress', 'Sugar Daddy', 'Ready for real attention and honest support.'),
    ('norah_kamene_seed', 'Norah Kamene', 'seed-clean-210@genuinesugarmummies.co.ke', '/seed/mistresses/photo_19_2026-06-25_14-21-41.jpg', 27, 'Mombasa', 'Kenya', 'mistress', 'Sugar Daddy', 'A classy mistress looking for a steady sugar daddy.'),
    ('patricia_chebet_seed', 'Patricia Chebet', 'seed-clean-211@genuinesugarmummies.co.ke', '/seed/mistresses/photo_20_2026-06-25_14-21-41.jpg', 29, 'Eldoret', 'Kenya', 'mistress', 'Sugar Daddy', 'I like respectful men who are serious and generous.'),
    ('veronica_moraa_seed', 'Veronica Moraa', 'seed-clean-212@genuinesugarmummies.co.ke', '/seed/mistresses/photo_21_2026-06-25_14-21-41.jpg', 26, 'Kisii', 'Kenya', 'mistress', 'Sugar Daddy', 'Seeking one mature sugar daddy for a genuine connection.'),
    ('alice_mwikali_seed', 'Alice Mwikali', 'seed-clean-019@genuinesugarmummies.co.ke', '/seed/sugarmums/photo_33_2026-06-24_14-00-45.jpg', 44, 'Nairobi', 'Kenya', 'sugar_mummy', 'Sugar Guy / Toyboy', 'Looking for a kind sugar guy who is serious and respectful.'),
    ('josephine_akinyi_seed', 'Josephine Akinyi', 'seed-clean-020@genuinesugarmummies.co.ke', '/seed/sugarmums/photo_34_2026-06-24_14-00-45.jpg', 47, 'Kisumu', 'Kenya', 'sugar_mummy', 'Sugar Guy / Toyboy', 'I want a respectful younger man with genuine interest.'),
    ('margaret_nyambura_seed', 'Margaret Nyambura', 'seed-clean-021@genuinesugarmummies.co.ke', '/seed/sugarmums/photo_35_2026-06-24_14-00-45.jpg', 53, 'Nakuru', 'Kenya', 'sugar_mummy', 'Sugar Guy / Toyboy', 'Seeking companionship, honesty, and steady communication.'),
    ('teresa_achieng_seed', 'Teresa Achieng', 'seed-clean-022@genuinesugarmummies.co.ke', '/seed/sugarmums/photo_36_2026-06-24_14-00-45.jpg', 46, 'Mombasa', 'Kenya', 'sugar_mummy', 'Sugar Guy / Toyboy', 'Looking for a clean and confident toyboy.'),
    ('eunice_kerubo_seed', 'Eunice Kerubo', 'seed-clean-023@genuinesugarmummies.co.ke', '/seed/sugarmums/photo_37_2026-06-24_14-00-45.jpg', 48, 'Kisii', 'Kenya', 'sugar_mummy', 'Sugar Guy / Toyboy', 'I value respect, privacy, and real effort.'),
    ('anne_wairimu_seed', 'Anne Wairimu', 'seed-clean-024@genuinesugarmummies.co.ke', '/seed/sugarmums/photo_38_2026-06-25_14-21-42.jpg', 45, 'Thika', 'Kenya', 'sugar_mummy', 'Sugar Guy / Toyboy', 'Seeking a serious sugar guy for meaningful companionship.'),
    ('nancy_mbithe_seed', 'Nancy Mbithe', 'seed-clean-025@genuinesugarmummies.co.ke', '/seed/sugarmums/photo_41_2026-06-25_14-21-42.jpg', 50, 'Machakos', 'Kenya', 'sugar_mummy', 'Sugar Guy / Toyboy', 'A mature woman looking for respectful attention.'),
    ('gladys_chepkorir_seed', 'Gladys Chepkorir', 'seed-clean-026@genuinesugarmummies.co.ke', '/seed/sugarmums/photo_42_2026-06-25_14-21-42.jpg', 43, 'Eldoret', 'Kenya', 'sugar_mummy', 'Sugar Guy / Toyboy', 'Looking for honesty, confidence, and discretion.'),
    ('victor_mboya_seed', 'Victor Mboya', 'seed-clean-113@genuinesugarmummies.co.ke', '/seed/sugar-dads/photo_23_2026-06-25_14-22-09.jpg', 57, 'Nairobi', 'Kenya', 'sugar_daddy', 'Mistress', 'Seeking a confident mistress who enjoys good communication.'),
    ('stephen_kariuki_seed', 'Stephen Kariuki', 'seed-clean-114@genuinesugarmummies.co.ke', '/seed/sugar-dads/photo_24_2026-06-25_14-22-09.jpg', 61, 'Nakuru', 'Kenya', 'sugar_daddy', 'Mistress', 'A mature sugar daddy looking for a serious mistress.'),
    ('alex_muthomi_seed', 'Alex Muthomi', 'seed-clean-115@genuinesugarmummies.co.ke', '/seed/sugar-dads/photo_25_2026-06-25_14-22-09.jpg', 55, 'Meru', 'Kenya', 'sugar_daddy', 'Mistress', 'Looking for a discreet mistress with a warm personality.'),
    ('collins_barasa_seed', 'Collins Barasa', 'seed-clean-116@genuinesugarmummies.co.ke', '/seed/sugar-dads/photo_26_2026-06-25_14-22-09.jpg', 59, 'Kakamega', 'Kenya', 'sugar_daddy', 'Mistress', 'I value respect, maturity, and clear intentions.'),
    ('moses_onyango_seed', 'Moses Onyango', 'seed-clean-117@genuinesugarmummies.co.ke', '/seed/sugar-dads/photo_27_2026-06-25_14-22-09.jpg', 58, 'Kisumu', 'Kenya', 'sugar_daddy', 'Mistress', 'Seeking a mistress who is honest and confident.'),
    ('isaac_mutiso_seed', 'Isaac Mutiso', 'seed-clean-118@genuinesugarmummies.co.ke', '/seed/sugar-dads/photo_28_2026-06-25_14-22-09.jpg', 54, 'Machakos', 'Kenya', 'sugar_daddy', 'Mistress', 'Looking for calm companionship and mutual respect.'),
    ('emmanuel_wekesa_seed', 'Emmanuel Wekesa', 'seed-clean-119@genuinesugarmummies.co.ke', '/seed/sugar-dads/photo_39_2026-06-24_14-00-45.jpg', 60, 'Eldoret', 'Kenya', 'sugar_daddy', 'Mistress', 'Interested in a mature and private connection.'),
    ('fredrick_otieno_seed', 'Fredrick Otieno', 'seed-clean-120@genuinesugarmummies.co.ke', '/seed/sugar-dads/photo_40_2026-06-24_14-00-45.jpg', 56, 'Kisumu', 'Kenya', 'sugar_daddy', 'Mistress', 'Seeking one serious mistress with clear communication.'),
    ('caleb_mwangi_seed', 'Caleb Mwangi', 'seed-clean-121@genuinesugarmummies.co.ke', '/seed/sugar-dads/photo_41_2026-06-24_14-00-45.jpg', 53, 'Nairobi', 'Kenya', 'sugar_daddy', 'Mistress', 'A steady sugar daddy looking for a confident mistress.'),
    ('benard_kiptoo_seed', 'Benard Kiptoo', 'seed-clean-122@genuinesugarmummies.co.ke', '/seed/sugar-dads/photo_42_2026-06-24_14-00-45.jpg', 62, 'Eldoret', 'Kenya', 'sugar_daddy', 'Mistress', 'Looking for discretion, respect, and genuine attention.'),
    ('sharon_wanjiru_seed', 'Sharon Wanjiru', 'seed-clean-213@genuinesugarmummies.co.ke', '/seed/mistresses/photo_22_2026-06-25_14-21-41.jpg', 27, 'Nairobi', 'Kenya', 'mistress', 'Sugar Daddy', 'Looking for a mature sugar daddy who is respectful.'),
    ('doreen_akoth_seed', 'Doreen Akoth', 'seed-clean-214@genuinesugarmummies.co.ke', '/seed/mistresses/photo_23_2026-06-25_14-21-41.jpg', 25, 'Kisumu', 'Kenya', 'mistress', 'Sugar Daddy', 'Seeking support, kindness, and mature companionship.'),
    ('melissa_wairimu_seed', 'Melissa Wairimu', 'seed-clean-215@genuinesugarmummies.co.ke', '/seed/mistresses/photo_24_2026-06-25_14-21-41.jpg', 30, 'Thika', 'Kenya', 'mistress', 'Sugar Daddy', 'I want a confident sugar daddy with clear intentions.'),
    ('karen_moraa_seed', 'Karen Moraa', 'seed-clean-216@genuinesugarmummies.co.ke', '/seed/mistresses/photo_25_2026-06-25_14-21-41.jpg', 28, 'Kisii', 'Kenya', 'mistress', 'Sugar Daddy', 'Looking for a respectful sugar daddy and real chemistry.'),
    ('sandra_chebet_seed', 'Sandra Chebet', 'seed-clean-217@genuinesugarmummies.co.ke', '/seed/mistresses/photo_26_2026-06-25_14-21-41.jpg', 29, 'Eldoret', 'Kenya', 'mistress', 'Sugar Daddy', 'Seeking a mature man who values privacy.'),
    ('linda_njeri_seed', 'Linda Njeri', 'seed-clean-218@genuinesugarmummies.co.ke', '/seed/mistresses/photo_27_2026-06-25_14-21-42.jpg', 26, 'Nakuru', 'Kenya', 'mistress', 'Sugar Daddy', 'A confident mistress looking for a genuine sugar daddy.'),
    ('martha_omondi_seed', 'Martha Omondi', 'seed-clean-219@genuinesugarmummies.co.ke', '/seed/mistresses/photo_28_2026-06-25_14-21-42.jpg', 31, 'Mombasa', 'Kenya', 'mistress', 'Sugar Daddy', 'Looking for honesty, maturity, and good conversation.'),
    ('pauline_mutheu_seed', 'Pauline Mutheu', 'seed-clean-220@genuinesugarmummies.co.ke', '/seed/mistresses/photo_29_2026-06-25_14-21-42.jpg', 24, 'Machakos', 'Kenya', 'mistress', 'Sugar Daddy', 'Seeking a serious sugar daddy who communicates well.'),
    ('yvonne_achieng_seed', 'Yvonne Achieng', 'seed-clean-221@genuinesugarmummies.co.ke', '/seed/mistresses/photo_30_2026-06-25_14-21-42.jpg', 27, 'Kisumu', 'Kenya', 'mistress', 'Sugar Daddy', 'Interested in a respectful and mature connection.'),
    ('rachel_kamau_seed', 'Rachel Kamau', 'seed-clean-222@genuinesugarmummies.co.ke', '/seed/mistresses/photo_36_2026-06-25_14-21-42.jpg', 29, 'Nairobi', 'Kenya', 'mistress', 'Sugar Daddy', 'Looking for privacy, honesty, and real support.')
) as seed_values(username, display_name, email, avatar_url, age, location, country, profile_label, looking_for, bio)
) as clean_seed;

analyze public.users;
