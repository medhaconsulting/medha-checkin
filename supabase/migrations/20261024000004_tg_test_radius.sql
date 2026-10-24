-- TEMPORARY test radius for one Telegram user (Chandy, 5102713796) on the Mini App path only.
-- Revert: update public.tg_settings set test_radius_m = null, test_user_id = null where id = 1;
alter table public.tg_settings add column if not exists test_radius_m int check (test_radius_m is null or test_radius_m between 1 and 50000);
alter table public.tg_settings add column if not exists test_user_id bigint;
update public.tg_settings set test_radius_m = 5000, test_user_id = 5102713796 where id = 1;
