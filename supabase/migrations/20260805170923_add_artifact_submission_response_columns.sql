-- Migration: Add artifact response metadata columns
-- Date: 2026-08-05

BEGIN;

ALTER TABLE public."artifact_questions"
  ADD COLUMN IF NOT EXISTS "response_type" varchar NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS "allowed_file_types" text[],
  ADD COLUMN IF NOT EXISTS "max_file_size_mb" integer DEFAULT 10,
  ADD COLUMN IF NOT EXISTS "response_required" boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_artifact_questions_response_type'
      AND conrelid = 'public.artifact_questions'::regclass
  ) THEN
    ALTER TABLE public."artifact_questions"
      ADD CONSTRAINT "chk_artifact_questions_response_type"
      CHECK (
        "response_type" IN (
          'text',
          'file',
          'url'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_artifact_questions_max_file_size_mb'
      AND conrelid = 'public.artifact_questions'::regclass
  ) THEN
    ALTER TABLE public."artifact_questions"
      ADD CONSTRAINT "chk_artifact_questions_max_file_size_mb"
      CHECK ("max_file_size_mb" IS NULL OR "max_file_size_mb" > 0);
  END IF;
END $$;

COMMIT;
