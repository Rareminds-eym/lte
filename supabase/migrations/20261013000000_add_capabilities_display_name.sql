-- Migration: Add display_name to public.capabilities
-- Phase: 1 of 1 (Expand)
-- Breaking: No
-- Rollback: Safe —
--   ALTER TABLE public.capabilities DROP COLUMN display_name;
--
-- Context: capabilities.name holds long formal names. display_name holds the short
-- learner-facing name from the Master sheet. Nullable until seeded; learner-facing
-- screens do not fall back to name when it is missing.
-- Populated by supabase/seed/*/20261013000000_seed_lte_capability_display_names.sql
-- (run it after the capabilities exist; after a fresh reset, run it once more).

BEGIN;

ALTER TABLE public."capabilities"
  ADD COLUMN IF NOT EXISTS "display_name" text;

COMMENT ON COLUMN public."capabilities"."display_name" IS 'Short learner-facing capability name (Master sheet "Display name"). NULL means no display name has been set.';

COMMIT;
