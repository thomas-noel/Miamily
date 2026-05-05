-- ============================================================
-- Migration 005 — Famille & Préférences membres
-- Tables : food_members, member_preferences
-- ============================================================

-- Membres du foyer (Thomas, Debora, Benjamin…)
create table public.food_members (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null,
  is_child     boolean not null default false,
  created_at   timestamptz default now() not null
);

alter table public.food_members enable row level security;

create policy "household members can manage food_members"
  on public.food_members for all
  using (
    household_id in (
      select household_id from public.household_members
      where profile_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.food_members to authenticated;

-- Préférences alimentaires par membre
-- preference = 'liked' | 'disliked' | 'forbidden'
-- category = id de catégorie (ex: 'poisson', 'fromage', 'viande_rouge'…)
create table public.member_preferences (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households(id) on delete cascade,
  food_member_id uuid not null references public.food_members(id) on delete cascade,
  category       text not null,
  preference     text not null check (preference in ('liked', 'disliked', 'forbidden')),
  created_at     timestamptz default now() not null,
  unique(food_member_id, category)
);

alter table public.member_preferences enable row level security;

create policy "household members can manage member_preferences"
  on public.member_preferences for all
  using (
    household_id in (
      select household_id from public.household_members
      where profile_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.member_preferences to authenticated;
