-- NutriFit · 0001 · Núcleo: perfiles, preferencias y objetivos
-- Idempotente: se puede volver a correr en el SQL Editor.

create schema if not exists private;
grant usage on schema private to authenticated, service_role;

-- ── Utilidades ──────────────────────────────────────────────────────────────
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ── profiles (datos públicos del perfil) ───────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  display_name text not null default '',
  avatar_url text,
  bio text not null default '' check (char_length(bio) <= 280),
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_.]{3,24}$')
);
create unique index if not exists profiles_username_key on public.profiles (lower(username));

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

-- ── profile_details (privado: cuerpo, objetivo, onboarding) ────────────────
create table if not exists public.profile_details (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  birthdate date,
  sex text check (sex in ('male', 'female')),
  height_cm numeric(5, 1) check (height_cm between 100 and 250),
  goal text check (goal in ('lose_fat', 'recomp', 'maintain', 'gain_muscle', 'performance')),
  pace text not null default 'moderate' check (pace in ('easy', 'moderate', 'fast')),
  lifestyle text check (lifestyle in ('sedentary', 'mixed', 'standing', 'physical')),
  focus_primary text,
  focus_secondary text,
  timezone text not null default 'America/Argentina/Buenos_Aires',
  water_glass_ml int not null default 250 check (water_glass_ml between 50 and 2000),
  water_bottle_ml int not null default 500 check (water_bottle_ml between 100 and 3000),
  ai_notice_accepted_at timestamptz,
  onboarding_step int not null default 1,
  onboarded_at timestamptz,
  updated_at timestamptz not null default now()
);

drop trigger if exists profile_details_updated_at on public.profile_details;
create trigger profile_details_updated_at before update on public.profile_details
  for each row execute function private.set_updated_at();

-- ── privacy_settings ───────────────────────────────────────────────────────
create table if not exists public.privacy_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  show_streaks boolean not null default true,
  show_training boolean not null default true,
  show_tests boolean not null default true,
  show_meals boolean not null default false,
  show_body boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ── user_sports ────────────────────────────────────────────────────────────
create table if not exists public.user_sports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  sport text not null,
  position text,
  level text not null default 'amateur' check (level in ('recreational', 'amateur', 'federated')),
  created_at timestamptz not null default now(),
  unique (user_id, sport)
);

-- ── weekly_schedule (agenda fija, editable) ────────────────────────────────
create table if not exists public.weekly_schedule (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  sport text not null,
  kind text not null default 'training' check (kind in ('training', 'match')),
  start_time time,
  duration_min int not null check (duration_min between 5 and 600),
  intensity text not null default 'moderate' check (intensity in ('light', 'moderate', 'hard')),
  created_at timestamptz not null default now()
);
create index if not exists weekly_schedule_user_idx on public.weekly_schedule (user_id, weekday);

-- ── gym_preferences ────────────────────────────────────────────────────────
create table if not exists public.gym_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  weekdays smallint[] not null default '{}',
  minutes int not null default 60 check (minutes between 15 and 180),
  preferred_time time,
  equipment text[] not null default '{full_gym}',
  experience text not null default 'beginner' check (experience in ('beginner', 'intermediate', 'advanced')),
  injuries text not null default '',
  allow_consecutive boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ── diet_preferences ───────────────────────────────────────────────────────
create table if not exists public.diet_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  diet_type text not null default 'omnivore' check (diet_type in ('omnivore', 'vegetarian', 'vegan', 'other')),
  meals_per_day int not null default 4 check (meals_per_day between 1 and 8),
  dislikes text[] not null default '{}',
  allergies text not null default '',
  cooking_time text not null default 'normal' check (cooking_time in ('low', 'normal', 'high')),
  updated_at timestamptz not null default now()
);

-- ── notification_prefs ─────────────────────────────────────────────────────
create table if not exists public.notification_prefs (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  enabled boolean not null default false,
  water jsonb not null default '{"on": true, "every_h": 2, "from": "09:00", "to": "21:00"}',
  meals jsonb not null default '{"on": true, "lunch_by": "14:30", "dinner_by": "22:00"}',
  gym jsonb not null default '{"on": true, "at": "18:00"}',
  daily_close jsonb not null default '{"on": true, "at": "22:00"}',
  weekly_review boolean not null default true,
  follow_requests boolean not null default true,
  measure_reminders boolean not null default true,
  quiet_from time not null default '23:30',
  quiet_to time not null default '08:00',
  updated_at timestamptz not null default now()
);

-- ── user_goals (snapshots de objetivos calculados por lib/calc) ────────────
create table if not exists public.user_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  goal text not null,
  pace text not null,
  lifestyle text not null,
  -- { rest|training|match: { kcal, protein_g, carbs_g, fat_g, water_ml, weekdays[] } | null }
  targets jsonb not null,
  manual_override boolean not null default false,
  tdee_estimate numeric(6, 0),
  expenditure_offset_kcal int not null default 0,
  effective_from date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists user_goals_user_idx on public.user_goals (user_id, effective_from desc, created_at desc);

-- ── Alta automática al primer login ────────────────────────────────────────
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_username text;
begin
  base_username := 'user_' || substr(md5(new.id::text), 1, 12);
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    base_username,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  insert into public.profile_details (user_id) values (new.id) on conflict do nothing;
  insert into public.privacy_settings (user_id) values (new.id) on conflict do nothing;
  insert into public.notification_prefs (user_id) values (new.id) on conflict do nothing;
  insert into public.gym_preferences (user_id) values (new.id) on conflict do nothing;
  insert into public.diet_preferences (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.profile_details enable row level security;
alter table public.privacy_settings enable row level security;
alter table public.user_sports enable row level security;
alter table public.weekly_schedule enable row level security;
alter table public.gym_preferences enable row level security;
alter table public.diet_preferences enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.user_goals enable row level security;

-- profiles: lectura abierta a usuarios logueados (se restringe por bloqueos en 0005).
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (true);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Tablas 1:1 sólo del dueño
do $$
declare t text;
begin
  foreach t in array array['profile_details', 'privacy_settings', 'gym_preferences', 'diet_preferences', 'notification_prefs'] loop
    execute format('drop policy if exists %1$s_owner on public.%1$s', t);
    execute format(
      'create policy %1$s_owner on public.%1$s for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t
    );
  end loop;
end;
$$;

-- Tablas 1:N sólo del dueño
do $$
declare t text;
begin
  foreach t in array array['weekly_schedule', 'user_goals'] loop
    execute format('drop policy if exists %1$s_owner on public.%1$s', t);
    execute format(
      'create policy %1$s_owner on public.%1$s for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t
    );
  end loop;
end;
$$;

-- user_sports: visibles en el perfil (se restringe por bloqueos en 0005); escribe sólo el dueño.
drop policy if exists user_sports_select on public.user_sports;
create policy user_sports_select on public.user_sports for select to authenticated using (true);
drop policy if exists user_sports_write on public.user_sports;
create policy user_sports_write on public.user_sports for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ── Grants explícitos (sin acceso anónimo) ─────────────────────────────────
revoke all on public.profiles, public.profile_details, public.privacy_settings, public.user_sports,
  public.weekly_schedule, public.gym_preferences, public.diet_preferences, public.notification_prefs,
  public.user_goals from anon;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.profile_details, public.privacy_settings, public.user_sports,
  public.weekly_schedule, public.gym_preferences, public.diet_preferences, public.notification_prefs,
  public.user_goals to authenticated;
grant all on public.profiles, public.profile_details, public.privacy_settings, public.user_sports,
  public.weekly_schedule, public.gym_preferences, public.diet_preferences, public.notification_prefs,
  public.user_goals to service_role;
