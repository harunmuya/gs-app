-- Repairs profile category / looking-for values without deleting user data.
-- Package access is controlled by subscription_tier + package_locked.
-- admin_approved remains available for verification/profile moderation only.

alter table public.users
    add column if not exists profile_label text,
    add column if not exists member_category text,
    add column if not exists preference text,
    add column if not exists looking_for text,
    add column if not exists avatar_url text,
    add column if not exists photos text[] not null default '{}',
    add column if not exists is_seed_profile boolean not null default false,
    add column if not exists package_locked boolean not null default false;

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
    end
from classified c
where u.id = c.id
  and c.fixed_label is not null
  and (
    coalesce(u.profile_label, '') is distinct from c.fixed_label
    or coalesce(u.member_category, '') is distinct from c.fixed_label
    or coalesce(u.looking_for, '') is distinct from case c.fixed_label
        when 'sugar_mummy' then 'Sugar Guy / Toyboy'
        when 'sugar_daddy' then 'Mistress'
        when 'mistress' then 'Sugar Daddy'
        when 'toyboy' then 'Sugar Mummy'
        else coalesce(u.looking_for, '')
    end
  );

update public.users
set package_locked = false
where package_locked is null;
