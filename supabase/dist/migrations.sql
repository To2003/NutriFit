-- NutriFit · bundle generado por `pnpm db:bundle`. No editar a mano.
-- Generado: 2026-11-18T14:09:18.396Z

-- ═════ migrations/0001_core.sql ═════
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


-- ═════ migrations/0002_diary.sql ═════
-- NutriFit · 0002 · Diario: alimentos, comidas, agua, peso, actividad, medidas y tests

-- ── foods (base unificada: local AR + caché de OFF/USDA + propios) ──────────
create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text,
  source text not null check (source in ('local', 'off', 'usda', 'custom')),
  external_id text,
  kcal numeric(6, 1) not null check (kcal >= 0),
  protein_g numeric(5, 1) not null default 0 check (protein_g >= 0),
  carbs_g numeric(5, 1) not null default 0 check (carbs_g >= 0),
  fat_g numeric(5, 1) not null default 0 check (fat_g >= 0),
  fiber_g numeric(5, 1) check (fiber_g >= 0),
  -- [{ "label": "1 unidad", "grams": 90 }, ...]
  portions jsonb not null default '[]',
  aliases text[] not null default '{}',
  verified boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  search_name text generated always as (
    lower(translate(name || ' ' || coalesce(brand, ''), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN'))
  ) stored,
  created_at timestamptz not null default now()
);
create unique index if not exists foods_external_key on public.foods (source, external_id) where external_id is not null;
create unique index if not exists foods_local_name_key on public.foods (name) where source = 'local';
create index if not exists foods_created_by_idx on public.foods (created_by);

-- ── food_logs / food_log_items ─────────────────────────────────────────────
create table if not exists public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  log_date date not null,
  meal text not null check (meal in ('breakfast', 'lunch', 'snack', 'dinner', 'extra')),
  photo_path text,
  input_text text,
  origin text not null default 'search' check (origin in ('text', 'photo', 'search', 'suggestion', 'quick')),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
create index if not exists food_logs_user_date_idx on public.food_logs (user_id, log_date);

create table if not exists public.food_log_items (
  id uuid primary key default gen_random_uuid(),
  food_log_id uuid not null,
  user_id uuid not null default auth.uid(),
  food_id uuid references public.foods (id) on delete set null,
  name text not null,
  grams numeric(6, 1) not null check (grams > 0),
  kcal numeric(6, 1) not null check (kcal >= 0),
  protein_g numeric(5, 1) not null default 0,
  carbs_g numeric(5, 1) not null default 0,
  fat_g numeric(5, 1) not null default 0,
  source text not null check (source in ('local', 'off', 'usda', 'custom', 'ai_estimate')),
  confidence numeric(3, 2),
  created_at timestamptz not null default now(),
  -- garantiza que el ítem es del mismo dueño que la comida
  foreign key (food_log_id, user_id) references public.food_logs (id, user_id) on delete cascade
);
create index if not exists food_log_items_log_idx on public.food_log_items (food_log_id);
create index if not exists food_log_items_user_idx on public.food_log_items (user_id);
create index if not exists food_log_items_food_idx on public.food_log_items (food_id);

-- ── water_logs ─────────────────────────────────────────────────────────────
create table if not exists public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  log_date date not null,
  logged_at timestamptz not null default now(),
  ml int not null check (ml between 1 and 5000)
);
create index if not exists water_logs_user_date_idx on public.water_logs (user_id, log_date);

-- ── weight_logs (uno por día) ──────────────────────────────────────────────
create table if not exists public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  log_date date not null,
  kg numeric(5, 2) not null check (kg between 25 and 350),
  created_at timestamptz not null default now(),
  unique (user_id, log_date)
);

-- ── activity_logs ──────────────────────────────────────────────────────────
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  log_date date not null,
  sport text not null,
  kind text not null default 'training' check (kind in ('training', 'match')),
  status text not null default 'done' check (status in ('done', 'skipped')),
  duration_min int not null default 0 check (duration_min between 0 and 600),
  intensity text not null default 'moderate' check (intensity in ('light', 'moderate', 'hard')),
  met numeric(4, 1),
  kcal numeric(6, 0),
  schedule_id uuid references public.weekly_schedule (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists activity_logs_user_date_idx on public.activity_logs (user_id, log_date);
create index if not exists activity_logs_schedule_idx on public.activity_logs (schedule_id);

-- ── body_measurements ──────────────────────────────────────────────────────
create table if not exists public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  log_date date not null,
  waist_cm numeric(5, 1),
  hip_cm numeric(5, 1),
  chest_cm numeric(5, 1),
  arm_cm numeric(5, 1),
  thigh_cm numeric(5, 1),
  neck_cm numeric(5, 1),
  created_at timestamptz not null default now()
);
create index if not exists body_measurements_user_idx on public.body_measurements (user_id, log_date);

-- ── fitness_tests ──────────────────────────────────────────────────────────
create table if not exists public.fitness_tests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  log_date date not null,
  test text not null check (test in ('cmj', 'reach_jump', 'broad_jump', 'sprint_10', 'sprint_20', 'plank')),
  value numeric(7, 2) not null check (value > 0),
  unit text not null,
  created_at timestamptz not null default now()
);
create index if not exists fitness_tests_user_idx on public.fitness_tests (user_id, test, log_date);

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.foods enable row level security;
alter table public.food_logs enable row level security;
alter table public.food_log_items enable row level security;
alter table public.water_logs enable row level security;
alter table public.weight_logs enable row level security;
alter table public.activity_logs enable row level security;
alter table public.body_measurements enable row level security;
alter table public.fitness_tests enable row level security;

-- foods: todos leen; cada uno crea/edita los suyos (custom) y el server cachea OFF/USDA.
drop policy if exists foods_select on public.foods;
create policy foods_select on public.foods for select to authenticated using (true);
drop policy if exists foods_insert on public.foods;
create policy foods_insert on public.foods for insert to authenticated
  with check (created_by = (select auth.uid()) and source in ('custom', 'off', 'usda') and verified = false);
drop policy if exists foods_update on public.foods;
create policy foods_update on public.foods for update to authenticated
  using (created_by = (select auth.uid()) and source = 'custom')
  with check (created_by = (select auth.uid()) and source = 'custom');
drop policy if exists foods_delete on public.foods;
create policy foods_delete on public.foods for delete to authenticated
  using (created_by = (select auth.uid()) and source = 'custom');

-- Escritura: sólo el dueño. Lectura: el dueño (las secciones visibles para otros se agregan en 0005).
do $$
declare t text;
begin
  foreach t in array array['food_logs', 'food_log_items', 'water_logs', 'weight_logs', 'activity_logs', 'body_measurements', 'fitness_tests'] loop
    execute format('drop policy if exists %1$s_owner on public.%1$s', t);
    execute format(
      'create policy %1$s_owner on public.%1$s for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t
    );
  end loop;
end;
$$;

revoke all on public.foods, public.food_logs, public.food_log_items, public.water_logs, public.weight_logs,
  public.activity_logs, public.body_measurements, public.fitness_tests from anon;
grant select, insert, update, delete on public.foods, public.food_logs, public.food_log_items, public.water_logs,
  public.weight_logs, public.activity_logs, public.body_measurements, public.fitness_tests to authenticated;
grant all on public.foods, public.food_logs, public.food_log_items, public.water_logs, public.weight_logs,
  public.activity_logs, public.body_measurements, public.fitness_tests to service_role;


-- ═════ migrations/0003_training.sql ═════
-- NutriFit · 0003 · Entrenamiento: biblioteca, programas, sesiones, series y molestias

create table if not exists public.exercises (
  id text primary key check (id ~ '^[a-z0-9_]+$'),
  name text not null,
  pattern text not null check (pattern in (
    'squat', 'hinge', 'horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull',
    'lunge', 'plyometric', 'core', 'carry', 'prevention', 'power', 'sprint', 'conditioning', 'mobility', 'accessory'
  )),
  region text not null check (region in ('lower', 'upper', 'full', 'core')),
  muscles text[] not null default '{}',
  equipment text[] not null default '{}',
  focus text[] not null default '{}',
  impact text not null default 'low' check (impact in ('low', 'medium', 'high')),
  level text not null default 'beginner' check (level in ('beginner', 'intermediate', 'advanced')),
  unilateral boolean not null default false,
  load_type text not null default 'bodyweight' check (load_type in ('barbell', 'dumbbell', 'kettlebell', 'machine', 'cable', 'bodyweight', 'band', 'other')),
  heavy_lower boolean not null default false,
  alternatives text[] not null default '{}',
  instructions text not null default '',
  common_mistakes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null,
  focus_primary text,
  focus_secondary text,
  start_date date not null,
  weeks smallint not null default 4 check (weeks between 1 and 8),
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  source text not null default 'ai' check (source in ('ai', 'rules', 'copied')),
  copied_from uuid references public.programs (id) on delete set null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
create index if not exists programs_user_idx on public.programs (user_id, status);
create index if not exists programs_copied_from_idx on public.programs (copied_from);

create table if not exists public.program_sessions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null,
  user_id uuid not null default auth.uid(),
  week smallint not null check (week between 1 and 8),
  weekday smallint not null check (weekday between 1 and 7),
  name text not null,
  tags text[] not null default '{}',
  is_deload boolean not null default false,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (program_id, user_id) references public.programs (id, user_id) on delete cascade
);
create index if not exists program_sessions_program_idx on public.program_sessions (program_id, week, weekday);
create index if not exists program_sessions_user_idx on public.program_sessions (user_id);

create table if not exists public.program_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null default auth.uid(),
  exercise_id text not null references public.exercises (id),
  position smallint not null,
  sets smallint not null check (sets between 1 and 10),
  reps_min smallint not null check (reps_min between 1 and 100),
  reps_max smallint not null check (reps_max between 1 and 100),
  rest_s smallint not null default 90 check (rest_s between 0 and 600),
  rir smallint check (rir between 0 and 5),
  notes text not null default '',
  check (reps_max >= reps_min),
  foreign key (session_id, user_id) references public.program_sessions (id, user_id) on delete cascade
);
create index if not exists program_exercises_session_idx on public.program_exercises (session_id, position);
create index if not exists program_exercises_user_idx on public.program_exercises (user_id);
create index if not exists program_exercises_exercise_idx on public.program_exercises (exercise_id);

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  program_session_id uuid references public.program_sessions (id) on delete set null,
  log_date date not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_min int,
  feeling smallint check (feeling between 1 and 10),
  volume_kg numeric(9, 1),
  notes text not null default '',
  unique (id, user_id)
);
create index if not exists workout_sessions_user_idx on public.workout_sessions (user_id, log_date);
create index if not exists workout_sessions_ps_idx on public.workout_sessions (program_session_id);

create table if not exists public.set_logs (
  id uuid primary key default gen_random_uuid(),
  workout_session_id uuid not null,
  user_id uuid not null default auth.uid(),
  exercise_id text not null references public.exercises (id),
  set_number smallint not null,
  kg numeric(6, 2) not null default 0 check (kg >= 0),
  reps smallint not null check (reps between 0 and 200),
  rir smallint check (rir between 0 and 5),
  created_at timestamptz not null default now(),
  foreign key (workout_session_id, user_id) references public.workout_sessions (id, user_id) on delete cascade
);
create index if not exists set_logs_session_idx on public.set_logs (workout_session_id);
create index if not exists set_logs_user_ex_idx on public.set_logs (user_id, exercise_id, created_at desc);
create index if not exists set_logs_exercise_idx on public.set_logs (exercise_id);

create table if not exists public.pain_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  workout_session_id uuid references public.workout_sessions (id) on delete set null,
  exercise_id text references public.exercises (id),
  log_date date not null,
  zone text not null,
  intensity smallint not null check (intensity between 1 and 10),
  notes text not null default '',
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists pain_reports_user_idx on public.pain_reports (user_id, log_date);
create index if not exists pain_reports_ws_idx on public.pain_reports (workout_session_id);
create index if not exists pain_reports_exercise_idx on public.pain_reports (exercise_id);

alter table public.exercises enable row level security;
alter table public.programs enable row level security;
alter table public.program_sessions enable row level security;
alter table public.program_exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.set_logs enable row level security;
alter table public.pain_reports enable row level security;

drop policy if exists exercises_select on public.exercises;
create policy exercises_select on public.exercises for select to authenticated using (true);

do $$
declare t text;
begin
  foreach t in array array['programs', 'program_sessions', 'program_exercises', 'workout_sessions', 'set_logs', 'pain_reports'] loop
    execute format('drop policy if exists %1$s_owner on public.%1$s', t);
    execute format(
      'create policy %1$s_owner on public.%1$s for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t
    );
  end loop;
end;
$$;

revoke all on public.exercises, public.programs, public.program_sessions, public.program_exercises,
  public.workout_sessions, public.set_logs, public.pain_reports from anon;
grant select on public.exercises to authenticated;
grant select, insert, update, delete on public.programs, public.program_sessions, public.program_exercises,
  public.workout_sessions, public.set_logs, public.pain_reports to authenticated;
grant all on public.exercises, public.programs, public.program_sessions, public.program_exercises,
  public.workout_sessions, public.set_logs, public.pain_reports to service_role;


-- ═════ migrations/0004_agent.sql ═════
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


-- ═════ migrations/0005_social.sql ═════
-- NutriFit · 0005 · Social: seguir, bloquear, visibilidad por sección (RLS), rachas y logros

create table if not exists public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create index if not exists follows_following_idx on public.follows (following_id, status);

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists blocks_blocked_idx on public.blocks (blocked_id);

-- ── Funciones de visibilidad (security definer; schema private no expuesto por la API) ──
create or replace function private.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

create or replace function private.is_accepted_follower(viewer uuid, owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.follows
    where follower_id = viewer and following_id = owner and status = 'accepted'
  );
$$;

-- ¿Puede `viewer` ver el contenido del perfil de `owner`? (público, o seguidor aceptado)
create or replace function private.can_view_profile(viewer uuid, owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select viewer is not null and owner is not null and (
    viewer = owner
    or (
      not private.is_blocked_between(viewer, owner)
      and (
        not coalesce((select is_private from public.profiles where id = owner), true)
        or private.is_accepted_follower(viewer, owner)
      )
    )
  );
$$;

-- ¿Puede `viewer` ver la sección `section` del perfil de `owner`?
-- section ∈ streaks | training | tests | meals | body
create or replace function private.can_view_section(viewer uuid, owner uuid, section text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  priv public.privacy_settings%rowtype;
  owner_private boolean;
  allowed boolean;
begin
  if viewer is null or owner is null then
    return false;
  end if;
  if viewer = owner then
    return true;
  end if;
  if private.is_blocked_between(viewer, owner) then
    return false;
  end if;

  select * into priv from public.privacy_settings where user_id = owner;
  if not found then
    return false;
  end if;

  allowed := case section
    when 'streaks' then priv.show_streaks
    when 'training' then priv.show_training
    when 'tests' then priv.show_tests
    when 'meals' then priv.show_meals
    when 'body' then priv.show_body
    else false
  end;
  if not coalesce(allowed, false) then
    return false;
  end if;

  select is_private into owner_private from public.profiles where id = owner;
  if coalesce(owner_private, true) then
    return private.is_accepted_follower(viewer, owner);
  end if;
  return true;
end;
$$;

-- Wrapper público para que la UI pregunte qué secciones mostrar (siempre con el usuario actual).
create or replace function public.visible_sections(owner uuid)
returns text[]
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(array_agg(s), '{}')
  from unnest(array['streaks', 'training', 'tests', 'meals', 'body']) as s
  where private.can_view_section((select auth.uid()), owner, s);
$$;

revoke execute on all functions in schema private from public, anon;
grant execute on function private.is_blocked_between(uuid, uuid) to authenticated, service_role;
grant execute on function private.is_accepted_follower(uuid, uuid) to authenticated, service_role;
grant execute on function private.can_view_section(uuid, uuid, text) to authenticated, service_role;
grant execute on function private.can_view_profile(uuid, uuid) to authenticated, service_role;
revoke execute on function public.visible_sections(uuid) from public, anon;
grant execute on function public.visible_sections(uuid) to authenticated;

-- ── follows: estado según privacidad del seguido (lo decide la base, no el cliente) ──
create or replace function private.follows_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_private boolean;
begin
  if private.is_blocked_between(new.follower_id, new.following_id) then
    raise exception 'No podés seguir a este usuario' using errcode = '42501';
  end if;
  select is_private into target_private from public.profiles where id = new.following_id;
  if coalesce(target_private, true) then
    new.status := 'pending';
    new.accepted_at := null;
  else
    new.status := 'accepted';
    new.accepted_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists follows_before_insert on public.follows;
create trigger follows_before_insert before insert on public.follows
  for each row execute function private.follows_before_insert();

-- Sólo se puede pasar de pending → accepted (lo hace el seguido).
create or replace function private.follows_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.follower_id <> old.follower_id or new.following_id <> old.following_id then
    raise exception 'No se puede cambiar quién sigue a quién' using errcode = '42501';
  end if;
  if new.status = 'accepted' and old.status = 'pending' then
    new.accepted_at := now();
  elsif new.status <> old.status then
    raise exception 'Cambio de estado inválido' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists follows_before_update on public.follows;
create trigger follows_before_update before update on public.follows
  for each row execute function private.follows_before_update();

-- Al bloquear se cortan los follows en ambas direcciones.
create or replace function private.blocks_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.follows
  where (follower_id = new.blocker_id and following_id = new.blocked_id)
     or (follower_id = new.blocked_id and following_id = new.blocker_id);
  return new;
end;
$$;

drop trigger if exists blocks_after_insert on public.blocks;
create trigger blocks_after_insert after insert on public.blocks
  for each row execute function private.blocks_after_insert();

-- Al pasar a cuenta pública se aceptan las solicitudes pendientes.
create or replace function private.profiles_after_update_privacy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_private and not new.is_private then
    update public.follows set status = 'accepted', accepted_at = now()
    where following_id = new.id and status = 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_after_update_privacy on public.profiles;
create trigger profiles_after_update_privacy after update of is_private on public.profiles
  for each row execute function private.profiles_after_update_privacy();

alter table public.follows enable row level security;
alter table public.blocks enable row level security;

drop policy if exists follows_select on public.follows;
create policy follows_select on public.follows for select to authenticated
  using (
    follower_id = (select auth.uid())
    or following_id = (select auth.uid())
    -- listas de seguidores/seguidos de perfiles cuyo contenido puedo ver
    or (
      status = 'accepted'
      and not private.is_blocked_between((select auth.uid()), follower_id)
      and not private.is_blocked_between((select auth.uid()), following_id)
      and (
        private.can_view_profile((select auth.uid()), follower_id)
        or private.can_view_profile((select auth.uid()), following_id)
      )
    )
  );
drop policy if exists follows_insert on public.follows;
create policy follows_insert on public.follows for insert to authenticated
  with check (follower_id = (select auth.uid()));
drop policy if exists follows_update on public.follows;
create policy follows_update on public.follows for update to authenticated
  using (following_id = (select auth.uid())) with check (following_id = (select auth.uid()));
drop policy if exists follows_delete on public.follows;
create policy follows_delete on public.follows for delete to authenticated
  using (follower_id = (select auth.uid()) or following_id = (select auth.uid()));

drop policy if exists blocks_owner on public.blocks;
create policy blocks_owner on public.blocks for all to authenticated
  using (blocker_id = (select auth.uid())) with check (blocker_id = (select auth.uid()));

-- ── Perfiles y deportes: ocultos entre usuarios bloqueados ───────────────────
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or not private.is_blocked_between((select auth.uid()), id));

drop policy if exists user_sports_select on public.user_sports;
create policy user_sports_select on public.user_sports for select to authenticated
  using (user_id = (select auth.uid()) or not private.is_blocked_between((select auth.uid()), user_id));

-- ── Lectura de secciones de otros perfiles (aplicada en la base) ─────────────
do $$
declare
  rec record;
begin
  for rec in
    select * from (values
      ('food_logs', 'meals'),
      ('food_log_items', 'meals'),
      ('water_logs', 'meals'),
      ('weight_logs', 'body'),
      ('body_measurements', 'body'),
      ('fitness_tests', 'tests'),
      ('activity_logs', 'training'),
      ('programs', 'training'),
      ('program_sessions', 'training'),
      ('program_exercises', 'training'),
      ('workout_sessions', 'training'),
      ('set_logs', 'training')
    ) as v(tbl, section)
  loop
    execute format('drop policy if exists %1$s_viewer on public.%1$s', rec.tbl);
    execute format(
      'create policy %1$s_viewer on public.%1$s for select to authenticated using (user_id <> (select auth.uid()) and private.can_view_section((select auth.uid()), user_id, %2$L))',
      rec.tbl, rec.section
    );
  end loop;
end;
$$;

-- ── Rachas y logros ──────────────────────────────────────────────────────────
create table if not exists public.user_streaks (
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('logging', 'water', 'protein', 'training_week')),
  current int not null default 0,
  best int not null default 0,
  last_date date,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind)
);

create table if not exists public.achievements (
  code text primary key,
  name text not null,
  description text not null,
  emoji text not null default '🏅',
  sort smallint not null default 0
);

create table if not exists public.user_achievements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  code text not null references public.achievements (code) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, code)
);
create index if not exists user_achievements_code_idx on public.user_achievements (code);

alter table public.user_streaks enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;

drop policy if exists achievements_select on public.achievements;
create policy achievements_select on public.achievements for select to authenticated using (true);

do $$
declare t text;
begin
  foreach t in array array['user_streaks', 'user_achievements'] loop
    execute format('drop policy if exists %1$s_owner on public.%1$s', t);
    execute format(
      'create policy %1$s_owner on public.%1$s for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t
    );
    execute format('drop policy if exists %1$s_viewer on public.%1$s', t);
    execute format(
      'create policy %1$s_viewer on public.%1$s for select to authenticated using (user_id <> (select auth.uid()) and private.can_view_section((select auth.uid()), user_id, %2$L))',
      t, 'streaks'
    );
  end loop;
end;
$$;

revoke all on public.follows, public.blocks, public.user_streaks, public.achievements, public.user_achievements from anon;
grant select, insert, update, delete on public.follows, public.blocks, public.user_streaks, public.user_achievements to authenticated;
grant select on public.achievements to authenticated;
grant all on public.follows, public.blocks, public.user_streaks, public.achievements, public.user_achievements to service_role;


-- ═════ migrations/0006_push.sql ═════
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


-- ═════ migrations/0007_storage.sql ═════
-- @pglite-skip (usa el schema storage de Supabase)
-- NutriFit · 0007 · Storage: bucket privado de fotos de comidas (food-photos/{user_id}/...)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('food-photos', 'food-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "food_photos_select_own" on storage.objects;
create policy "food_photos_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'food-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "food_photos_insert_own" on storage.objects;
create policy "food_photos_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'food-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "food_photos_delete_own" on storage.objects;
create policy "food_photos_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'food-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);


-- ═════ migrations/0008_cron.sql ═════
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


-- ═════ migrations/0009_hardening.sql ═════
-- NutriFit · 0009 · Endurecimiento: alimentos propios privados

-- Los alimentos "custom" son de cada usuario: no se listan a otros.
drop policy if exists foods_select on public.foods;
create policy foods_select on public.foods for select to authenticated
  using (source <> 'custom' or created_by = (select auth.uid()));

