-- Repair old seeded image URLs that point to /seed-photos/*.
-- This keeps real users, keeps seeded accounts, and only changes broken legacy photo paths.

with image_pools as (
    select
        array[
            '/seed/sugarmums/photo_10_2026-06-24_14-00-45.jpg',
            '/seed/sugarmums/photo_11_2026-06-24_14-00-45.jpg',
            '/seed/sugarmums/photo_16_2026-06-24_14-00-45.jpg',
            '/seed/sugarmums/photo_24_2026-06-24_14-00-45.jpg'
        ]::text[] as sugar_mummy_images,
        array[
            '/seed/sugar-dads/photo_10_2026-06-25_14-22-09.jpg',
            '/seed/sugar-dads/photo_11_2026-06-25_14-22-09.jpg',
            '/seed/sugar-dads/photo_13_2026-06-25_14-22-09.jpg',
            '/seed/sugar-dads/photo_15_2026-06-25_14-22-09.jpg'
        ]::text[] as sugar_daddy_images,
        array[
            '/seed/mistresses/photo_10_2026-06-25_14-21-41.jpg',
            '/seed/mistresses/photo_11_2026-06-25_14-21-41.jpg',
            '/seed/mistresses/photo_12_2026-06-25_14-21-41.jpg',
            '/seed/mistresses/photo_13_2026-06-25_14-21-41.jpg'
        ]::text[] as mistress_images
),
legacy_seed_photos as (
    select
        u.id,
        case
            when lower(coalesce(u.avatar_url, '') || ' ' || coalesce(array_to_string(u.photos, ' '), '')) like '%sugar-dads%'
              or lower(coalesce(u.avatar_url, '') || ' ' || coalesce(array_to_string(u.photos, ' '), '')) like '%/seed-photos/seed-m-%'
              or lower(coalesce(u.profile_label, '') || ' ' || coalesce(u.member_category, '')) like '%daddy%'
            then 'sugar_daddy'
            when lower(coalesce(u.avatar_url, '') || ' ' || coalesce(array_to_string(u.photos, ' '), '')) like '%mistresses%'
              or lower(coalesce(u.profile_label, '') || ' ' || coalesce(u.member_category, '')) like '%mistress%'
            then 'mistress'
            else 'sugar_mummy'
        end as fixed_label,
        row_number() over (
            partition by
                case
                    when lower(coalesce(u.avatar_url, '') || ' ' || coalesce(array_to_string(u.photos, ' '), '')) like '%sugar-dads%'
                      or lower(coalesce(u.avatar_url, '') || ' ' || coalesce(array_to_string(u.photos, ' '), '')) like '%/seed-photos/seed-m-%'
                      or lower(coalesce(u.profile_label, '') || ' ' || coalesce(u.member_category, '')) like '%daddy%'
                    then 'sugar_daddy'
                    when lower(coalesce(u.avatar_url, '') || ' ' || coalesce(array_to_string(u.photos, ' '), '')) like '%mistresses%'
                      or lower(coalesce(u.profile_label, '') || ' ' || coalesce(u.member_category, '')) like '%mistress%'
                    then 'mistress'
                    else 'sugar_mummy'
                end
            order by u.id::text
        ) as sequence_number
    from public.users u
    where lower(coalesce(u.avatar_url, '') || ' ' || coalesce(array_to_string(u.photos, ' '), '')) like '%/seed-photos/%'
),
fixed as (
    select
        l.id,
        l.fixed_label,
        case
            when l.fixed_label = 'sugar_daddy'
                then p.sugar_daddy_images[((l.sequence_number - 1) % array_length(p.sugar_daddy_images, 1)) + 1]
            when l.fixed_label = 'mistress'
                then p.mistress_images[((l.sequence_number - 1) % array_length(p.mistress_images, 1)) + 1]
            else p.sugar_mummy_images[((l.sequence_number - 1) % array_length(p.sugar_mummy_images, 1)) + 1]
        end as fixed_photo
    from legacy_seed_photos l
    cross join image_pools p
)
update public.users u
set
    avatar_url = f.fixed_photo,
    photos = array[f.fixed_photo],
    profile_label = f.fixed_label,
    member_category = f.fixed_label,
    show_in_public = true
from fixed f
where u.id = f.id;

select
    count(*) as remaining_legacy_seed_photo_urls
from public.users
where lower(coalesce(avatar_url, '') || ' ' || coalesce(array_to_string(photos, ' '), '')) like '%/seed-photos/%';
