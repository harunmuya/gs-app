-- V1 package correction: only Free has a daily message limit.
-- Paid packages use 0 as the app's "unlimited" marker.

do $$
begin
    if to_regclass('public.package_tiers') is not null then
        update public.package_tiers
        set
            daily_message_limit = 0,
            daily_like_limit = case when id = 'basic' then 20 else daily_like_limit end,
            description = case
                when id = 'basic' then 'Unlimited messages, images, gifts, and stronger daily limits.'
                else description
            end,
            features = case
                when features ? 'unlimited_messages' then features
                else features || '["unlimited_messages"]'::jsonb
            end,
            updated_at = now()
        where id in ('basic', 'silver', 'gold', 'diamond');
    end if;
end $$;
