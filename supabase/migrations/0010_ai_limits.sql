-- NutriFit · 0010 · Topes de IA por usuario (día y mes) y global (día)
-- Los topes por defecto vienen de variables de entorno en Vercel; esta tabla permite excepciones por usuario.
-- Solo se edita desde el SQL Editor (los usuarios la pueden leer, no escribir). Ejemplo:
--   insert into public.ai_limits (user_id, daily_cap, monthly_cap)
--   values ((select id from public.profiles where username = 'toto'), 60, 1000)
--   on conflict (user_id) do update set daily_cap = excluded.daily_cap, monthly_cap = excluded.monthly_cap;

create table if not exists public.ai_limits (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  daily_cap int check (daily_cap >= 0),
  monthly_cap int check (monthly_cap >= 0),
  note text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.ai_limits enable row level security;
drop policy if exists ai_limits_select_own on public.ai_limits;
create policy ai_limits_select_own on public.ai_limits for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.ai_limits from anon, authenticated;
grant select on public.ai_limits to authenticated;
grant all on public.ai_limits to service_role;

-- El usuario no puede tocar su propio contador (antes podía resetearlo).
drop policy if exists ai_usage_owner on public.ai_usage;
drop policy if exists ai_usage_select_own on public.ai_usage;
create policy ai_usage_select_own on public.ai_usage for select to authenticated
  using (user_id = (select auth.uid()));
revoke insert, update, delete on public.ai_usage from authenticated;

create index if not exists ai_usage_day_idx on public.ai_usage (day);

-- Suma una llamada y devuelve el uso actual + excepciones. Security definer: puede sumar el uso global.
-- Usuario logueado: cuenta a sí mismo. Service role (crons): cuenta a p_user.
create or replace function public.consume_ai_quota(p_user uuid default null, failed boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  today date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  lim public.ai_limits%rowtype;
  user_day int;
  user_month int;
  global_day int;
begin
  -- (current_user acá es el dueño de la función; el rol de quien llama está en el setting "role"
  --  o en el claim del JWT que pone PostgREST)
  if uid is null and (
    current_setting('role', true) = 'service_role'
    or coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'role' = 'service_role'
  ) then
    uid := p_user;
  end if;
  if uid is null then
    return null;
  end if;

  insert into public.ai_usage (user_id, day, calls, failures)
  values (uid, today, 1, case when failed then 1 else 0 end)
  on conflict (user_id, day) do update
    set calls = public.ai_usage.calls + 1,
        failures = public.ai_usage.failures + case when failed then 1 else 0 end
  returning calls into user_day;

  select coalesce(sum(calls), 0)::int into user_month
  from public.ai_usage where user_id = uid and day >= date_trunc('month', today)::date;
  select coalesce(sum(calls), 0)::int into global_day from public.ai_usage where day = today;
  select * into lim from public.ai_limits where user_id = uid;

  return jsonb_build_object(
    'user_day', user_day,
    'user_month', user_month,
    'global_day', global_day,
    'daily_cap', lim.daily_cap,
    'monthly_cap', lim.monthly_cap
  );
end;
$$;

revoke execute on function public.consume_ai_quota(uuid, boolean) from public, anon;
grant execute on function public.consume_ai_quota(uuid, boolean) to authenticated, service_role;

-- La función vieja queda sin uso
revoke execute on function public.bump_ai_usage(boolean) from authenticated;
