-- Migration: Add R2 object key to artifact submission files
-- Date: 2026-08-05

BEGIN;

ALTER TABLE public.artifact_submission_files
  ALTER COLUMN file_url DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS object_key varchar,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_artifact_submission_files_object_key
  ON public.artifact_submission_files(object_key)
  WHERE object_key IS NOT NULL;

COMMIT;
