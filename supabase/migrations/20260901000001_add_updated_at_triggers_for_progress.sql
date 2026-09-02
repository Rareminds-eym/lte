-- ============================================================================
-- Migration: Add updated_at triggers for progress/artifact tables
-- Date: 2026-09-01
-- Phase: 1 of 1 (Expand) — non-breaking, adds triggers + missing columns
-- Breaking: No
-- Rollback: DROP TRIGGER IF EXISTS ...; ALTER TABLE ... DROP COLUMN IF EXISTS updated_at (only for xp_events/subscription_cache where added)
--
-- Context: 20260729093954_lte_9tables.sql created 9 tables without triggers;
--          user_stage_progress (20260731091304), xp_events (20260728110000),
--          subscription_cache (20260718093100) and artifact_submission_answers
--          (20260805170935) also lacked updated_at maintenance → dashboards
--          stale, cache invalidation wrong. Unified on set_lte_timestamps where
--          schema has created_at, else set_updated_at (subscription_cache has
--          no created_at → set_lte_timestamps would fail with
--          "record NEW has no field created_at").
-- Related: .kiro/plans/2026-09-01_lte-deep-audit_plan.md P1-4, TRD §14
-- ============================================================================

BEGIN;

-- Ensure timestamp helpers exist with secure search_path (idempotent)
CREATE OR REPLACE FUNCTION public.set_lte_timestamps()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := COALESCE(NEW.created_at, now());
  ELSE
    NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Tables lacking updated_at at creation: xp_events (append-only ledger) and
-- subscription_cache (shadow cache with synced_at/auth_updated_at only).
-- Add updated_at so BEFORE UPDATE triggers have a target column; existing
-- rows get now() via DEFAULT. subscription_cache has no created_at, so its
-- trigger must use set_updated_at (not set_lte_timestamps).
ALTER TABLE public.xp_events ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.subscription_cache ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 1. user_capabilities
DROP TRIGGER IF EXISTS trg_user_capabilities_set_updated_at ON public.user_capabilities;
CREATE TRIGGER trg_user_capabilities_set_updated_at
BEFORE UPDATE ON public.user_capabilities
FOR EACH ROW EXECUTE FUNCTION public.set_lte_timestamps();

-- 2. user_capability_level_progress
DROP TRIGGER IF EXISTS trg_user_capability_level_progress_set_updated_at ON public.user_capability_level_progress;
CREATE TRIGGER trg_user_capability_level_progress_set_updated_at
BEFORE UPDATE ON public.user_capability_level_progress
FOR EACH ROW EXECUTE FUNCTION public.set_lte_timestamps();

-- 3. user_module_progress
DROP TRIGGER IF EXISTS trg_user_module_progress_set_updated_at ON public.user_module_progress;
CREATE TRIGGER trg_user_module_progress_set_updated_at
BEFORE UPDATE ON public.user_module_progress
FOR EACH ROW EXECUTE FUNCTION public.set_lte_timestamps();

-- 4. artifact_submissions
DROP TRIGGER IF EXISTS trg_artifact_submissions_set_updated_at ON public.artifact_submissions;
CREATE TRIGGER trg_artifact_submissions_set_updated_at
BEFORE UPDATE ON public.artifact_submissions
FOR EACH ROW EXECUTE FUNCTION public.set_lte_timestamps();

-- 5. skill_gap
DROP TRIGGER IF EXISTS trg_skill_gap_set_updated_at ON public.skill_gap;
CREATE TRIGGER trg_skill_gap_set_updated_at
BEFORE UPDATE ON public.skill_gap
FOR EACH ROW EXECUTE FUNCTION public.set_lte_timestamps();

-- 6. profile_snapshot
DROP TRIGGER IF EXISTS trg_profile_snapshot_set_updated_at ON public.profile_snapshot;
CREATE TRIGGER trg_profile_snapshot_set_updated_at
BEFORE UPDATE ON public.profile_snapshot
FOR EACH ROW EXECUTE FUNCTION public.set_lte_timestamps();

-- 7. learning_track_evidence
DROP TRIGGER IF EXISTS trg_learning_track_evidence_set_updated_at ON public.learning_track_evidence;
CREATE TRIGGER trg_learning_track_evidence_set_updated_at
BEFORE UPDATE ON public.learning_track_evidence
FOR EACH ROW EXECUTE FUNCTION public.set_lte_timestamps();

-- 8. artifact_evaluation_flows
DROP TRIGGER IF EXISTS trg_artifact_evaluation_flows_set_updated_at ON public.artifact_evaluation_flows;
CREATE TRIGGER trg_artifact_evaluation_flows_set_updated_at
BEFORE UPDATE ON public.artifact_evaluation_flows
FOR EACH ROW EXECUTE FUNCTION public.set_lte_timestamps();

-- 9. artifact_submission_files
DROP TRIGGER IF EXISTS trg_artifact_submission_files_set_updated_at ON public.artifact_submission_files;
CREATE TRIGGER trg_artifact_submission_files_set_updated_at
BEFORE UPDATE ON public.artifact_submission_files
FOR EACH ROW EXECUTE FUNCTION public.set_lte_timestamps();

-- 10. user_stage_progress
DROP TRIGGER IF EXISTS trg_user_stage_progress_set_updated_at ON public.user_stage_progress;
CREATE TRIGGER trg_user_stage_progress_set_updated_at
BEFORE UPDATE ON public.user_stage_progress
FOR EACH ROW EXECUTE FUNCTION public.set_lte_timestamps();

-- 11. xp_events (has created_at → set_lte_timestamps safe)
DROP TRIGGER IF EXISTS trg_xp_events_set_updated_at ON public.xp_events;
CREATE TRIGGER trg_xp_events_set_updated_at
BEFORE UPDATE ON public.xp_events
FOR EACH ROW EXECUTE FUNCTION public.set_lte_timestamps();

-- 12. subscription_cache (no created_at → must use set_updated_at)
DROP TRIGGER IF EXISTS trg_subscription_cache_set_updated_at ON public.subscription_cache;
CREATE TRIGGER trg_subscription_cache_set_updated_at
BEFORE UPDATE ON public.subscription_cache
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 13. artifact_submission_answers
DROP TRIGGER IF EXISTS trg_artifact_submission_answers_set_updated_at ON public.artifact_submission_answers;
CREATE TRIGGER trg_artifact_submission_answers_set_updated_at
BEFORE UPDATE ON public.artifact_submission_answers
FOR EACH ROW EXECUTE FUNCTION public.set_lte_timestamps();

COMMIT;
