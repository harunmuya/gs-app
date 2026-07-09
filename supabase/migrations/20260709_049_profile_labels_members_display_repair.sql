-- Repairs profile category labels and "looking for" text without deleting real users.
-- Seed profiles are classified from their /public/seed folder path. Real users keep their row
-- but receive a canonical label when their existing label or looking_for value is recognizable.

alter table public.users add column if not exists profile_label text;
alter table public.users add column if not exists member_category text;
alter table public.users add column if not exists looking_for text;
alter table public.users add column if not exists intent_summary text;
alter table public.users add column if not exists wants text;
alter table public.users add column if not exists age_range_preference text;
alter table public.users add column if not exists show_in_public boolean not null default true;
alter table public.users add column if not exists is_seed_profile boolean not null default false;
alter table public.users add column if not exists photos text[] default '{}'::text[];

with classified as (
    select
        id,
        case
            when is_seed_profile and lower(coalesce(avatar_url, '') || ' ' || array_to_string(coalesce(photos, '{}'::text[]), ' ')) like '%/seed/sugarmums/%' then 'sugar_mummy'
            when is_seed_profile and lower(coalesce(avatar_url, '') || ' ' || array_to_string(coalesce(photos, '{}'::text[]), ' ')) like '%/seed/sugar-dads/%' then 'sugar_daddy'
            when is_seed_profile and lower(coalesce(avatar_url, '') || ' ' || array_to_string(coalesce(photos, '{}'::text[]), ' ')) like '%/seed/mistresses/%' then 'mistress'
            when is_seed_profile and lower(coalesce(avatar_url, '') || ' ' || array_to_string(coalesce(photos, '{}'::text[]), ' ')) like '%/seed/toboys%or%sugarguys/%' then 'toyboy'
            when lower(replace(replace(coalesce(profile_label, member_category, ''), '-', '_'), ' ', '_')) in ('sugar_mummy', 'sugarmummy', 'sugar_mum', 'sugarmum') then 'sugar_mummy'
            when lower(replace(replace(coalesce(profile_label, member_category, ''), '-', '_'), ' ', '_')) in ('sugar_daddy', 'sugardaddy') then 'sugar_daddy'
            when lower(replace(replace(coalesce(profile_label, member_category, ''), '-', '_'), ' ', '_')) = 'mistress' then 'mistress'
            when lower(replace(replace(coalesce(profile_label, member_category, ''), '-', '_'), ' ', '_')) in ('toyboy', 'toy_boy', 'toboy', 'sugar_guy', 'sugarguy', 'sugar_boy', 'sugarboy') then 'toyboy'
            when lower(coalesce(looking_for, intent_summary, '')) like '%sugar mummy%' then 'toyboy'
            when lower(coalesce(looking_for, intent_summary, '')) like '%mistress%' then 'sugar_daddy'
            when lower(coalesce(looking_for, intent_summary, '')) like '%sugar daddy%' then 'mistress'
            when lower(coalesce(looking_for, intent_summary, '')) like '%toyboy%' or lower(coalesce(looking_for, intent_summary, '')) like '%sugar guy%' then 'sugar_mummy'
            else null
        end as fixed_label
    from public.users
)
update public.users as u
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
    intent_summary = case c.fixed_label
        when 'sugar_mummy' then 'I am a Sugar Mummy looking for Sugar Guy / Toyboy.'
        when 'sugar_daddy' then 'I am a Sugar Daddy looking for Mistress.'
        when 'mistress' then 'I am a Mistress looking for Sugar Daddy.'
        when 'toyboy' then 'I am a Sugar Guy / Toyboy looking for Sugar Mummy.'
        else u.intent_summary
    end,
    wants = coalesce(nullif(u.wants, ''), case c.fixed_label
        when 'sugar_mummy' then 'A confident sugar guy or toyboy who is respectful, attentive, and serious.'
        when 'sugar_daddy' then 'A confident mistress who values respect, privacy, and clear communication.'
        when 'mistress' then 'A mature sugar daddy who is respectful, generous, and serious.'
        when 'toyboy' then 'A genuine sugar mummy who values respect, attention, and clear communication.'
        else u.wants
    end),
    age_range_preference = coalesce(nullif(u.age_range_preference, ''), case c.fixed_label
        when 'sugar_mummy' then '21-34'
        when 'sugar_daddy' then '24-35'
        when 'mistress' then '45-68'
        when 'toyboy' then '38-58'
        else u.age_range_preference
    end),
    show_in_public = true
from classified as c
where u.id = c.id
  and c.fixed_label in ('sugar_mummy', 'sugar_daddy', 'mistress', 'toyboy');

create index if not exists users_profile_label_public_idx
on public.users (profile_label, show_in_public);
