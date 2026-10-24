-- 8:30 AM Phnom Penh reminder, Mon–Sat (ASSUMPTION: Medha works Saturdays — change '1-6' to '1-5' if not).
-- NOT APPLIED YET. pg_cron runs in UTC: 08:30 ICT = 01:30 UTC.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create or replace function public.send_checkin_reminders() returns int
language plpgsql security definer set search_path = '' as $$
declare v_token text; r record; n int := 0;
begin
  if not coalesce((select reminders_enabled from public.tg_settings where id = 1), false) then return 0; end if;
  select decrypted_secret into v_token from vault.decrypted_secrets where name = 'telegram_bot_token' limit 1;
  if v_token is null then return 0; end if;
  for r in
    select s.telegram_user_id, s.display_name from public.tg_staff s
    where s.status = 'approved' and s.remind
      and not exists (select 1 from public.checkins c
        where c.telegram_user_id = s.telegram_user_id and c.type = 'IN'
          and (c.created_at at time zone 'Asia/Phnom_Penh')::date = (now() at time zone 'Asia/Phnom_Penh')::date)
  loop
    perform net.http_post(url := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
      body := jsonb_build_object('chat_id', r.telegram_user_id, 'text',
        '⏰ Good morning ' || r.display_name || ', you haven''t checked in yet today. Tap the menu button to check in.'),
      headers := '{"Content-Type": "application/json"}'::jsonb);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.send_checkin_reminders() from public, anon, authenticated;

select cron.unschedule('medha-checkin-reminder') where exists (select 1 from cron.job where jobname = 'medha-checkin-reminder');
select cron.schedule('medha-checkin-reminder', '30 1 * * 1-6', $$select public.send_checkin_reminders()$$);
