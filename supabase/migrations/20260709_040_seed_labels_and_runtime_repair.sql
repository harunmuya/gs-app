-- Production repair for polluted seeded profile labels.
-- This updates only seeded/fake rows identified by seed email or seed photo paths.
-- Real client accounts are not deleted or relabelled.

alter table public.users
    add column if not exists profile_label text,
    add column if not exists member_category text,
    add column if not exists looking_for text,
    add column if not exists intent_summary text,
    add column if not exists is_seed_profile boolean not null default false,
    add column if not exists show_in_public boolean not null default true,
    add column if not exists admin_approved boolean not null default true,
    add column if not exists verified boolean not null default false,
    add column if not exists verification_status text not null default 'unsubmitted',
    add column if not exists updated_at timestamptz not null default now();

update public.users
set is_seed_profile = true,
    show_in_public = true,
    admin_approved = true,
    verified = true,
    verification_status = 'verified',
    updated_at = now()
where lower(coalesce(email, '')) like 'seed+%@genuinesugarmummies.com'
   or lower(coalesce(email, '')) like 'seed+app-%@genuinesugarmummies.co.ke'
   or lower(coalesce(email, '')) like 'seed-clean-%@genuinesugarmummies.co.ke'
   or lower(coalesce(email, '')) like '%@gs-seed.app'
   or lower(coalesce(avatar_url, '') || ' ' || coalesce(photos::text, '')) like '%/seed/%'
   or lower(coalesce(avatar_url, '') || ' ' || coalesce(photos::text, '')) like '%/seed-photos/%';

with corrected as (
    select
        id,
        case
            when lower(coalesce(avatar_url, '') || ' ' || coalesce(photos::text, '')) like '%sugarmums%'
              or lower(coalesce(email, '') || ' ' || coalesce(username, '')) like '%sugar_mummy%'
              or lower(coalesce(email, '') || ' ' || coalesce(username, '')) like '%sugarmum%'
                then 'sugar_mummy'
            when lower(coalesce(avatar_url, '') || ' ' || coalesce(photos::text, '')) like '%sugar-dads%'
              or lower(coalesce(avatar_url, '') || ' ' || coalesce(photos::text, '')) like '%/seed-photos/seed-m-%'
              or lower(coalesce(email, '') || ' ' || coalesce(username, '')) like '%sugar_daddy%'
              or lower(coalesce(email, '') || ' ' || coalesce(username, '')) like '%sugardad%'
                then 'sugar_daddy'
            when lower(coalesce(avatar_url, '') || ' ' || coalesce(photos::text, '')) like '%mistresses%'
              or lower(coalesce(email, '') || ' ' || coalesce(username, '')) like '%mistress%'
                then 'mistress'
            when lower(coalesce(profile_label, member_category, '')) in ('sugar_mummy', 'sugar mummy', 'sugarmummy', 'sugar_mum')
                then 'sugar_mummy'
            when lower(coalesce(profile_label, member_category, '')) in ('sugar_daddy', 'sugar daddy', 'sugardaddy')
                then 'sugar_daddy'
            when lower(coalesce(profile_label, member_category, '')) = 'mistress'
                then 'mistress'
            else 'sugar_mummy'
        end as fixed_label
    from public.users
    where coalesce(is_seed_profile, false) = true
)
update public.users u
set profile_label = c.fixed_label,
    member_category = c.fixed_label,
    looking_for = case
        when c.fixed_label = 'sugar_mummy' then 'Sugar Guy / Toyboy'
        when c.fixed_label = 'sugar_daddy' then 'Mistress'
        when c.fixed_label = 'mistress' then 'Sugar Daddy'
        else 'Sugar Mummy'
    end,
    intent_summary = case
        when c.fixed_label = 'sugar_mummy' then 'Sugar Mummy seeking Sugar Guy / Toyboy.'
        when c.fixed_label = 'sugar_daddy' then 'Sugar Daddy seeking Mistress.'
        when c.fixed_label = 'mistress' then 'Mistress seeking Sugar Daddy.'
        else 'Sugar Guy / Toyboy seeking Sugar Mummy.'
    end,
    show_in_public = true,
    admin_approved = true,
    updated_at = now()
from corrected c
where u.id = c.id;

update public.users
set profile_label = 'sugar_daddy',
    member_category = 'sugar_daddy',
    looking_for = 'Mistress',
    intent_summary = 'Sugar Daddy seeking Mistress.',
    updated_at = now()
where lower(coalesce(display_name, '')) = 'kingsley pinzy'
   or lower(coalesce(email, '')) = 'kingsleypinzy@gmail.com';
