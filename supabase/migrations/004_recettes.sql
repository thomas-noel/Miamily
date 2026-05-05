-- ============================================================
-- Migration 004 — Recettes IA
-- Tables : food_preferences, meal_history
-- ============================================================

-- Préférences alimentaires du foyer (exclusions, inclusions)
create table public.food_preferences (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  type         text not null check (type in ('exclude', 'include')),
  value        text not null,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz default now() not null,
  unique(household_id, type, value)
);

alter table public.food_preferences enable row level security;

create policy "household members can manage food preferences"
  on public.food_preferences for all
  using (
    household_id in (
      select household_id from public.household_members
      where profile_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.food_preferences to authenticated;

-- Historique des repas cuisinés (anti-répétition + anti-gaspi futur)
create table public.meal_history (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null,
  heaviness    text not null default 'normal' check (heaviness in ('light', 'normal', 'heavy')),
  cooked_at    timestamptz default now() not null,
  created_by   uuid references public.profiles(id) on delete set null
);

alter table public.meal_history enable row level security;

create policy "household members can manage meal history"
  on public.meal_history for all
  using (
    household_id in (
      select household_id from public.household_members
      where profile_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.meal_history to authenticated;
