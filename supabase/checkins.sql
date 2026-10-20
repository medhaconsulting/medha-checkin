-- Applied to Supabase project medha-checkin (eeskricyucilmykhtwju) as migration "create_checkins"
create table public.checkins (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 employee_name text not null,
 employee_id text,
 type text not null check (type in ('IN','OUT')),
 lat double precision, lng double precision,
 distance_m double precision, accuracy_m double precision,
 device_time text
);
alter table public.checkins enable row level security;
create index checkins_created_at_idx on public.checkins (created_at desc);
revoke all on public.checkins from anon, authenticated;
grant insert on public.checkins to anon, authenticated;
grant select on public.checkins to authenticated;
create policy "anyone can insert valid checkins" on public.checkins for insert to anon, authenticated
 with check (type in ('IN','OUT') and char_length(btrim(employee_name)) between 1 and 100
  and (employee_id is null or char_length(employee_id) <= 50) and (device_time is null or char_length(device_time) <= 100)
  and (lat is null or lat between -90 and 90) and (lng is null or lng between -180 and 180));
create policy "admin can read checkins" on public.checkins for select to authenticated
 using ((select auth.jwt()->>'email') = 'ot.chandy@gmail.com');
