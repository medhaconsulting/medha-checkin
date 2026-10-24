-- Lets the tg-checkin Edge Function (service_role only) read the bot token already in Vault,
-- so no separate function secret is needed.
create or replace function public.tg_bot_token() returns text
language sql security definer set search_path = '' stable as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'telegram_bot_token' limit 1
$$;
revoke all on function public.tg_bot_token() from public, anon, authenticated;
grant execute on function public.tg_bot_token() to service_role;
