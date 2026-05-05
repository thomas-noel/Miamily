-- ============================================================
-- Migration 002 — Inventaire
-- Tables : product_categories, inventory_items
-- ============================================================

create table public.product_categories (
  id                          uuid primary key default gen_random_uuid(),
  name                        text not null,
  emoji                       text not null default '🛒',
  default_expiry_days         integer not null default 7,
  default_expiry_days_opened  integer,
  default_storage             text not null default 'fridge' check (default_storage in ('fridge', 'pantry', 'freezer'))
);

create table public.inventory_items (
  id                    uuid primary key default gen_random_uuid(),
  household_id          uuid not null references public.households(id) on delete cascade,
  name                  text not null,
  normalized_name       text not null,
  canonical_name        text not null,
  category_id           uuid references public.product_categories(id) on delete set null,
  quantity              decimal not null default 1,
  unit                  text not null default 'unité(s)',
  storage_location      text not null default 'fridge' check (storage_location in ('fridge', 'pantry', 'freezer')),
  expiry_date           date,
  estimated_expiry_date date not null,
  is_expiry_estimated   boolean not null default true,
  opened_at             date,
  added_by              uuid references public.profiles(id) on delete set null,
  source                text not null default 'manual' check (source in ('manual', 'photo', 'screenshot', 'paste')),
  created_at            timestamptz default now() not null,
  updated_at            timestamptz default now() not null
);

-- RLS
alter table public.product_categories enable row level security;
alter table public.inventory_items enable row level security;

-- product_categories : lecture publique (référentiel partagé)
create policy "anyone can read categories"
  on public.product_categories for select
  using (true);

-- inventory_items : membres du foyer uniquement
create policy "household members can manage inventory"
  on public.inventory_items for all
  using (
    household_id in (
      select household_id from public.household_members
      where profile_id = auth.uid()
    )
  );

-- Permissions
grant select on public.product_categories to authenticated, anon;
grant select, insert, update, delete on public.inventory_items to authenticated;

-- Trigger updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger inventory_items_updated_at
  before update on public.inventory_items
  for each row execute procedure update_updated_at();

-- ============================================================
-- Données de référence — catégories
-- ============================================================

insert into public.product_categories (name, emoji, default_expiry_days, default_expiry_days_opened, default_storage) values
  ('Légumes feuilles',    '🥬', 3,   null, 'fridge'),
  ('Légumes',             '🥕', 7,   null, 'fridge'),
  ('Fruits',              '🍎', 5,   null, 'fridge'),
  ('Viande fraîche',      '🥩', 2,   null, 'fridge'),
  ('Poisson frais',       '🐟', 1,   null, 'fridge'),
  ('Charcuterie',         '🥓', 5,   3,    'fridge'),
  ('Fromage',             '🧀', 14,  5,    'fridge'),
  ('Œufs',                '🥚', 28,  null, 'fridge'),
  ('Produits laitiers',   '🥛', 7,   3,    'fridge'),
  ('Plats cuisinés',      '🍱', 3,   null, 'fridge'),
  ('Épicerie sèche',      '🌾', 365, 30,   'pantry'),
  ('Conserves',           '🥫', 730, 4,    'pantry'),
  ('Féculents',           '🍝', 365, 30,   'pantry'),
  ('Huiles & condiments', '🫙', 365, 90,   'pantry'),
  ('Boissons',            '🧃', 365, 3,    'pantry'),
  ('Surgelés',            '🧊', 90,  null, 'freezer'),
  ('Autre',               '📦', 7,   null, 'fridge');
