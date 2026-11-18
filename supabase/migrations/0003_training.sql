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
