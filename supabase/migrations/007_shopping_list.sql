-- ============================================================
-- Migration 007 — Liste de courses
-- Table : shopping_list_items
-- ============================================================

create table public.shopping_list_items (
  id             uuid        primary key default gen_random_uuid(),
  household_id   uuid        not null references public.households(id) on delete cascade,
  name           text        not null,
  canonical_name text,
  quantity       decimal,
  unit           text,
  is_checked     boolean     not null default false,
  added_by       uuid        references public.profiles(id) on delete set null,
  source         text        not null default 'manual'
                             check (source in ('manual', 'recipe')),
  recipe_name    text,
  created_at     timestamptz not null default now()
);

create index idx_shopping_list_household
  on public.shopping_list_items(household_id, is_checked, created_at desc);

alter table public.shopping_list_items enable row level security;

create policy "household members can manage shopping list"
  on public.shopping_list_items for all
  using (
    household_id in (
      select household_id from public.household_members
      where profile_id = auth.uid()
    )
  )
  with check (
    household_id in (
      select household_id from public.household_members
      where profile_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.shopping_list_items to authenticated;
