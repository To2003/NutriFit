-- NutriFit · 0004 · Agente IA: mensajes, objetivos semanales y uso de la IA

create table if not exists public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('log_feedback', 'daily_close', 'weekly_review', 'meal_suggestion', 'workout_feedback', 'pain')),
  for_date date not null,
  content jsonb not null,
  ref text,
  source text not null default 'ai' check (source in ('ai', 'fallback')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists agent_messages_user_idx on public.agent_messages (user_id, created_at desc);
create unique index if not exists agent_messages_daily_key on public.agent_messages (user_id, kind, for_date)
  where kind in ('daily_close', 'weekly_review');

create table if not exists public.weekly_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  week_start date not null,
  text text not null check (char_length(text) between 1 and 200),
  done boolean not null default false,
  evaluated boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists weekly_goals_user_idx on public.weekly_goals (user_id, week_start);

-- Contador de llamadas a la IA por usuario y día (límite blando para el free tier).
create table if not exists public.ai_usage (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  calls int not null default 0,
  failures int not null default 0,
  primary key (user_id, day)
);

-- Ajustes de TDEE propuestos por la revisión semanal (el usuario acepta o rechaza).
create table if not exists public.tdee_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  week_start date not null,
  previous_tdee numeric(6, 0) not null,
  observed_tdee numeric(6, 0) not null,
  proposed_tdee numeric(6, 0) not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

alter table public.agent_messages enable row level security;
alter table public.weekly_goals enable row level security;
alter table public.ai_usage enable row level security;
alter table public.tdee_proposals enable row level security;

do $$
declare t text;
begin
  foreach t in array array['agent_messages', 'weekly_goals', 'ai_usage', 'tdee_proposals'] loop
    execute format('drop policy if exists %1$s_owner on public.%1$s', t);
    execute format(
      'create policy %1$s_owner on public.%1$s for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t
    );
  end loop;
end;
$$;

-- Incremento atómico del contador de IA (devuelve las llamadas del día).
create or replace function public.bump_ai_usage(failed boolean default false)
returns int
language sql
security invoker
set search_path = ''
as $$
  insert into public.ai_usage (user_id, day, calls, failures)
  values ((select auth.uid()), current_date, 1, case when failed then 1 else 0 end)
  on conflict (user_id, day) do update
    set calls = public.ai_usage.calls + 1,
        failures = public.ai_usage.failures + case when failed then 1 else 0 end
  returning calls;
$$;

revoke all on public.agent_messages, public.weekly_goals, public.ai_usage, public.tdee_proposals from anon;
grant select, insert, update, delete on public.agent_messages, public.weekly_goals, public.ai_usage, public.tdee_proposals to authenticated;
grant all on public.agent_messages, public.weekly_goals, public.ai_usage, public.tdee_proposals to service_role;
revoke execute on function public.bump_ai_usage(boolean) from public, anon;
grant execute on function public.bump_ai_usage(boolean) to authenticated, service_role;
