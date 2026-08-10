-- Seed: Demote duplicate is_latest rows in artifact_submissions (P1-1 backfill)
-- Phase: 2 of 3 (Migrate) — data backfill for
--        20260807090000_artifact_submission_idempotency_and_latest.sql
-- Breaking: No
-- Rollback: N/A (idempotent; re-run to converge)
--
-- Context: is_latest defaults to true (20260729093954_lte_9tables), so every
--   pre-index submission row is flagged latest. This seed keeps the newest row
--   per (artifact_id, user_id) and demotes the rest so the partial unique index
--   uq_artifact_submissions_latest can be created. Idempotent: re-running
--   always converges to exactly one is_latest row per (artifact_id, user_id).

BEGIN;

UPDATE public.artifact_submissions AS s
SET is_latest = false,
    updated_at = now()
WHERE s.is_latest = true
  AND s.id NOT IN (
    SELECT DISTINCT ON (artifact_id, user_id) id
    FROM public.artifact_submissions
    WHERE is_latest = true
    ORDER BY artifact_id, user_id, submitted_at DESC NULLS LAST, created_at DESC
  );

COMMIT;
