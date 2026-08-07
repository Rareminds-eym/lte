-- Migration: Artifact submission idempotency + exactly-one-latest guarantee
-- Phase: 1 of 1 (Expand)
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

-- 1. Normalize pre-existing data BEFORE the unique index can be created:
--    keep the newest is_latest row per (artifact_id, user_id), demote the rest.
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

-- 2. Idempotency key column (nullable; only written by new application code).
ALTER TABLE public.artifact_submissions
    ADD COLUMN idempotency_key text;

COMMENT ON COLUMN public.artifact_submissions.idempotency_key IS
'Client-supplied idempotency key (Idempotency-Key header) used to deduplicate retried submission requests. Nullable for backward compatibility with clients that do not send a key.';

-- 3. Exactly one latest submission per (artifact_id, user_id).
CREATE UNIQUE INDEX uq_artifact_submissions_latest
    ON public.artifact_submissions(artifact_id, user_id)
    WHERE is_latest;

-- 4. Duplicate submission request deduplication (P0-2).
CREATE UNIQUE INDEX uq_artifact_submissions_idempotency
    ON public.artifact_submissions(user_id, artifact_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;
