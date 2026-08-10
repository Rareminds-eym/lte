-- Migration: Artifact submission idempotency + exactly-one-latest guarantee
-- Phase: 2 of 3 (Migrate) — schema side; data backfill in
--         seed/dev|production/seed_lte_catalog_16_artifact_submission_latest_demote.sql
-- Breaking: No
-- Rollback: Drop uq_artifact_submissions_latest, uq_artifact_submissions_idempotency,
--           and the idempotency_key column in a follow-up migration.
--
-- Context:
--   P0-2: retried submissions created duplicate attempts. A client-supplied
--         idempotency key (Idempotency-Key header) is now stored per submission
--         and enforced by a partial unique index.
--   P1-1: concurrent submissions could produce multiple is_latest rows. A
--         partial unique index per (artifact_id, user_id) WHERE is_latest
--         guarantees exactly one latest submission.

-- 1. Pre-check: the partial unique index below cannot be created while more
--    than one row per (artifact_id, user_id) is flagged is_latest (the column
--    defaults to true, so pre-index rows are all flagged). Data backfill is
--    intentionally NOT part of this migration (DDL-only contract): run
--    supabase/seed/{dev,production}/seed_lte_catalog_16_artifact_submission_latest_demote.sql
--    before applying this migration to any database that already holds
--    artifact submissions. Fresh databases (empty table) pass this check.
DO $$
DECLARE duplicate_groups integer;
BEGIN
  SELECT count(*) INTO duplicate_groups
  FROM (
    SELECT artifact_id, user_id
    FROM public.artifact_submissions
    WHERE is_latest
    GROUP BY artifact_id, user_id
    HAVING count(*) > 1
  ) d;

  IF duplicate_groups > 0 THEN
    RAISE EXCEPTION
      'Cannot create uq_artifact_submissions_latest: % (artifact_id, user_id) groups have multiple is_latest rows. Run seed_lte_catalog_16_artifact_submission_latest_demote first.',
      duplicate_groups;
  END IF;
END $$;

-- 2. Idempotency key column (nullable; only written by new application code).
ALTER TABLE public.artifact_submissions
    ADD COLUMN IF NOT EXISTS idempotency_key text;

COMMENT ON COLUMN public.artifact_submissions.idempotency_key IS
'Client-supplied idempotency key (Idempotency-Key header) used to deduplicate retried submission requests. Nullable for backward compatibility with clients that do not send a key.';

-- 3. Exactly one latest submission per (artifact_id, user_id).
CREATE UNIQUE INDEX IF NOT EXISTS uq_artifact_submissions_latest
    ON public.artifact_submissions(artifact_id, user_id)
    WHERE is_latest;

-- 4. Duplicate submission request deduplication (P0-2).
CREATE UNIQUE INDEX IF NOT EXISTS uq_artifact_submissions_idempotency
    ON public.artifact_submissions(user_id, artifact_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;
