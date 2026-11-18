-- @pglite-skip (usa pg_cron, pg_net y vault de Supabase)
-- NutriFit · 0008 · Crons: cada 15 min llama a /api/cron/* de la app con CRON_SECRET.
--
-- Los secretos se leen en cada llamada: se pueden cargar antes o después de correr esto.
-- Cargalos en Vault (una sola vez), en el SQL Editor:
--   select vault.create_secret('https://TU-APP.vercel.app', 'app_url');
--   select vault.create_secret('EL_MISMO_VALOR_QUE_CRON_SECRET', 'cron_secret');
-- Para cambiarlos después: select vault.update_secret(id, 'nuevo') usando el id de vault.secrets.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function private.call_app_cron(path text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  base text;
  secret text;
  req bigint;
begin
  select decrypted_secret into base from vault.decrypted_secrets where name = 'app_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'cron_secret';
  if base is null or secret is null then
    raise warning 'NutriFit cron: faltan los secretos app_url / cron_secret en Vault';
    return null;
  end if;
  select net.http_post(
    url := rtrim(base, '/') || path,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  ) into req;
  return req;
end;
$$;
revoke execute on function private.call_app_cron(text) from public, anon, authenticated;

-- Re-programa (idempotente)
do $$
begin
  perform cron.unschedule(jobname) from cron.job where jobname like 'nutrifit-%';
end;
$$;

select cron.schedule('nutrifit-notifications', '*/15 * * * *', $$ select private.call_app_cron('/api/cron/notifications') $$);
select cron.schedule('nutrifit-daily', '7,22,37,52 * * * *', $$ select private.call_app_cron('/api/cron/daily') $$);
select cron.schedule('nutrifit-weekly', '11 * * * 0,1', $$ select private.call_app_cron('/api/cron/weekly') $$);
