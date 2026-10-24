-- Telegram Mini App pilot (Medha Check In). NOT APPLIED YET — needs approval.
-- 1) Link Telegram users to staff; admin approves once.
create table if not exists public.tg_staff (
  telegram_user_id bigint primary key,
  tg_username text,
  display_name text not null check (char_length(display_name) between 1 and 100),
  employee_id text check (employee_id is null or char_length(employee_id) <= 50),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  remind boolean not null default true,
  created_at timestamptz not null default now(),
  approved_at timestamptz, approved_by text
);
alter table public.tg_staff enable row level security;
revoke all on public.tg_staff from anon, authenticated;
grant select, update on public.tg_staff to authenticated;
create policy "admin reads tg_staff" on public.tg_staff for select to authenticated
  using ((select auth.jwt()->>'email') = 'ot.chandy@gmail.com');
create policy "admin updates tg_staff" on public.tg_staff for update to authenticated
  using ((select auth.jwt()->>'email') = 'ot.chandy@gmail.com')
  with check ((select auth.jwt()->>'email') = 'ot.chandy@gmail.com');

-- 2) Tag check-ins that came from Telegram (web check-ins keep these null).
alter table public.checkins add column if not exists telegram_user_id bigint;
alter table public.checkins add column if not exists source text not null default 'web';
-- Stop web/anon users forging a telegram source: only the Edge Function (service_role) may set it.
drop policy if exists "anyone can insert valid checkins" on public.checkins;
create policy "anyone can insert valid checkins" on public.checkins for insert to anon, authenticated
 with check (type in ('IN','OUT') and char_length(btrim(employee_name)) between 1 and 100
  and (employee_id is null or char_length(employee_id) <= 50) and (device_time is null or char_length(device_time) <= 100)
  and (lat is null or lat between -90 and 90) and (lng is null or lng between -180 and 180)
  and telegram_user_id is null and source = 'web');

-- 3) Global switch for the morning reminder (default OFF).
create table if not exists public.tg_settings (
  id int primary key default 1 check (id = 1),
  reminders_enabled boolean not null default false
);
insert into public.tg_settings (id) values (1) on conflict do nothing;
alter table public.tg_settings enable row level security;
revoke all on public.tg_settings from anon, authenticated;
grant select, update on public.tg_settings to authenticated;
create policy "admin reads settings" on public.tg_settings for select to authenticated using ((select auth.jwt()->>'email') = 'ot.chandy@gmail.com');
create policy "admin updates settings" on public.tg_settings for update to authenticated using ((select auth.jwt()->>'email') = 'ot.chandy@gmail.com');

-- 4) Ping the admin chat when someone new asks to link (reuses vault secret telegram_bot_token).
create or replace function public.notify_tg_link_request() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_token text;
begin
  begin
    select decrypted_secret into v_token from vault.decrypted_secrets where name = 'telegram_bot_token' limit 1;
    if v_token is null then return new; end if;
    perform net.http_post(url := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
      body := jsonb_build_object('chat_id', 5102713796, 'text',
        '🆕 New Check In link request: ' || new.display_name || coalesce(' (@' || new.tg_username || ')', '')
        || chr(10) || 'Approve on the admin page → Telegram staff.'),
      headers := '{"Content-Type": "application/json"}'::jsonb);
  exception when others then raise warning 'notify_tg_link_request failed: %', sqlerrm; end;
  return new;
end $$;
revoke all on function public.notify_tg_link_request() from public, anon, authenticated;
drop trigger if exists tg_staff_notify on public.tg_staff;
create trigger tg_staff_notify after insert on public.tg_staff for each row execute function public.notify_tg_link_request();
