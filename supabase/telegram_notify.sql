-- Telegram notification for each new check-in.
-- Prereq (run once, not in git): select vault.create_secret('<BOT_TOKEN>', 'telegram_bot_token');
create extension if not exists pg_net with schema extensions;

create or replace function public.notify_telegram_checkin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
  v_text  text;
begin
  begin
    select decrypted_secret into v_token
      from vault.decrypted_secrets where name = 'telegram_bot_token' limit 1;
    if v_token is null then
      return new;
    end if;

    v_text := case when upper(new.type) = 'IN' then '✅ ' else '🚪 ' end
      || new.employee_name || ' checked ' || upper(new.type)
      || chr(10) || '🕒 ' || to_char(new.created_at at time zone 'Asia/Phnom_Penh', 'YYYY-MM-DD HH24:MI') || ' (Phnom Penh)'
      || case when new.distance_m is not null
              then chr(10) || '📍 ' || round(new.distance_m)::text || ' m from site'
                   || coalesce(' (±' || round(new.accuracy_m)::text || ' m)', '')
              else '' end
      || case when new.employee_id is not null and new.employee_id <> ''
              then chr(10) || 'ID: ' || new.employee_id else '' end;

    perform net.http_post(
      url := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
      body := jsonb_build_object('chat_id', 5102713796, 'text', v_text),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  exception when others then
    raise warning 'notify_telegram_checkin failed: %', sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function public.notify_telegram_checkin() from public, anon, authenticated;

drop trigger if exists checkins_notify_telegram on public.checkins;
create trigger checkins_notify_telegram
  after insert on public.checkins
  for each row execute function public.notify_telegram_checkin();
