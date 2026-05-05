-- ============================================================
-- Migration 003 — Imports IA
-- ============================================================

create table public.imports (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  source       text not null default 'paste' check (source in ('paste', 'photo', 'screenshot')),
  raw_text     text,
  ai_response  jsonb,
  status       text not null default 'pending' check (status in ('pending', 'analyzed', 'confirmed', 'failed')),
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz default now() not null
);

alter table public.imports enable row level security;

create policy "household members can manage imports"
  on public.imports for all
  using (
    household_id in (
      select household_id from public.household_members
      where profile_id = auth.uid()
    )
  );

grant select, insert, update on public.imports to authenticated;
