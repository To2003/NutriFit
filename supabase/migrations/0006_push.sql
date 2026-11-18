-- NutriFit · 0006 · Push: suscripciones y registro de envíos (para no duplicar)

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_success_at timestamptz
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

create table if not exists public.notification_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  dedupe_key text not null,
  kind text not null,
  sent_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

alter table public.push_subscriptions enable row level security;
alter table public.notification_log enable row level security;

drop policy if exists push_subscriptions_owner on public.push_subscriptions;
create policy push_subscriptions_owner on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists notification_log_owner on public.notification_log;
create policy notification_log_owner on public.notification_log for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.push_subscriptions, public.notification_log from anon;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant select on public.notification_log to authenticated;
grant all on public.push_subscriptions, public.notification_log to service_role;
