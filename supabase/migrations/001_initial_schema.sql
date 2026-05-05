-- ============================================================
-- Migration 001 — Schéma initial Miamily
-- Tables : households, profiles, household_members
-- RLS, triggers, RPCs
-- ============================================================

-- Fonction de génération de code d'invitation (8 caractères sans ambigus)
create or replace function generate_invite_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i integer;
begin
  for i in 1..8 loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  end loop;
  return result;
end;
$$;

-- Households (créé en premier, FK vers profiles ajoutée après)
create table public.households (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  created_by   uuid,                   -- FK ajoutée après la création de profiles
  invite_code  text unique not null default generate_invite_code(),
  created_at   timestamptz default now() not null
);

-- Profiles (extension de auth.users)
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null,
  household_id  uuid references public.households(id) on delete set null,
  created_at    timestamptz default now() not null
);

-- FK circulaire : households → profiles (maintenant que profiles existe)
alter table public.households
  add constraint households_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;

-- Membres du foyer
create table public.household_members (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  role          text not null default 'member' check (role in ('admin', 'member')),
  joined_at     timestamptz default now() not null,
  unique(household_id, profile_id)
);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================

alter table public.households enable row level security;
alter table public.profiles enable row level security;
alter table public.household_members enable row level security;

-- Profiles : chaque utilisateur voit et modifie uniquement son profil
create policy "own profile select"
  on public.profiles for select
  using (auth.uid() = id);

create policy "own profile update"
  on public.profiles for update
  using (auth.uid() = id);

create policy "own profile insert"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Households : visible uniquement par les membres du foyer
create policy "members can view household"
  on public.households for select
  using (
    id in (
      select household_id from public.household_members
      where profile_id = auth.uid()
    )
  );

create policy "authenticated users can create household"
  on public.households for insert
  with check (auth.uid() is not null);

-- Household members : visible par tous les membres du même foyer
create policy "members can view household members"
  on public.household_members for select
  using (
    household_id in (
      select household_id from public.household_members
      where profile_id = auth.uid()
    )
  );

create policy "users can join households"
  on public.household_members for insert
  with check (profile_id = auth.uid());

-- ============================================================
-- Permissions des rôles (requis quand tables créées via SQL Editor)
-- ============================================================

grant usage on schema public to authenticated, anon;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.households to authenticated;
grant select, insert, update on public.household_members to authenticated;

grant select on public.households to anon;

-- ============================================================
-- Trigger : créer le profil automatiquement à l'inscription
-- ============================================================

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- RPC : create_household (atomique : household + membre + profil)
-- ============================================================

create or replace function create_household(p_name text)
returns json
language plpgsql
security definer
as $$
declare
  v_household_id  uuid;
  v_invite_code   text;
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;

  insert into public.households (name)
  values (p_name)
  returning id, invite_code into v_household_id, v_invite_code;

  insert into public.household_members (household_id, profile_id, role)
  values (v_household_id, auth.uid(), 'admin');

  update public.profiles
  set household_id = v_household_id
  where id = auth.uid();

  return json_build_object(
    'id',           v_household_id,
    'invite_code',  v_invite_code
  );
end;
$$;

-- ============================================================
-- RPC : join_household (atomique : validation code + membre + profil)
-- ============================================================

create or replace function join_household(p_invite_code text)
returns json
language plpgsql
security definer
as $$
declare
  v_household_id    uuid;
  v_household_name  text;
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;

  select id, name into v_household_id, v_household_name
  from public.households
  where invite_code = upper(trim(p_invite_code))
  limit 1;

  if v_household_id is null then
    raise exception 'Code d''invitation invalide';
  end if;

  if exists (
    select 1 from public.household_members
    where household_id = v_household_id
      and profile_id = auth.uid()
  ) then
    raise exception 'Tu es déjà membre de ce foyer';
  end if;

  insert into public.household_members (household_id, profile_id, role)
  values (v_household_id, auth.uid(), 'member');

  update public.profiles
  set household_id = v_household_id
  where id = auth.uid();

  return json_build_object(
    'id',   v_household_id,
    'name', v_household_name
  );
end;
$$;
