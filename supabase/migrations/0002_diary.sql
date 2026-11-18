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
