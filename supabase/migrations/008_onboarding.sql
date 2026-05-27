-- ============================================================
-- Migration 008 — Onboarding flag
-- Adds onboarded boolean to profiles.
-- Existing users with a household are already onboarded.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN onboarded BOOLEAN NOT NULL DEFAULT false;

UPDATE public.profiles
  SET onboarded = true
  WHERE household_id IS NOT NULL;
