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
