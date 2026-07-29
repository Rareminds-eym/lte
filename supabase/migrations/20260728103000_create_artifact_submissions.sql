-- ============================================================================
-- Migration: Artifact submissions (TRD-DB-004)
-- Tracks user evidence submissions with durable storage references and
-- malware scanning lifecycle.
-- ============================================================================

BEGIN;

CREATE TYPE IF NOT EXISTS public.artifact_submission_status AS ENUM (
  'draft', 'submitted', 'under_review', 'resubmission_required',
  'manual_review', 'accepted'
);

CREATE TYPE IF NOT EXISTS public.artifact_scan_status AS ENUM (
  'draft', 'uploaded', 'scanning', 'passed', 'quarantined', 'scan_failed'
);

CREATE TABLE IF NOT EXISTS public.artifact_submissions (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  module_artifact_id uuid NOT NULL REFERENCES public.module_artifacts(id) ON DELETE RESTRICT,
  attempt_number    smallint NOT NULL CHECK (attempt_number >= 1),
  status            public.artifact_submission_status DEFAULT 'draft' NOT NULL,
  scan_status       public.artifact_scan_status DEFAULT 'draft' NOT NULL,
  -- Durable storage references (Signed GET URLs are generated dynamically at runtime)
  bucket_name       varchar(100) DEFAULT 'lte-artifacts' NOT NULL,
  storage_key       varchar(500),
  etag              varchar(100),
  file_name         varchar(255),
  file_type         varchar(100),
  file_size_bytes   bigint CHECK (file_size_bytes IS NULL OR file_size_bytes > 0),
  -- Text/link submissions
  text_content      text,
  link_url          varchar(1000),
  -- Metadata
  submitted_at      timestamptz,
  reviewed_at       timestamptz,
  metadata          jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at        timestamptz DEFAULT now() NOT NULL,
  updated_at        timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uq_submission_attempt UNIQUE (user_id, module_artifact_id, attempt_number),
  CONSTRAINT chk_has_content CHECK (
    storage_key IS NOT NULL OR text_content IS NOT NULL OR link_url IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_as_user_artifact ON public.artifact_submissions(user_id, module_artifact_id);
CREATE INDEX IF NOT EXISTS idx_as_org_user ON public.artifact_submissions(org_id, user_id);
CREATE INDEX IF NOT EXISTS idx_as_status ON public.artifact_submissions(status);
CREATE INDEX IF NOT EXISTS idx_as_pending_review ON public.artifact_submissions(status)
  WHERE status IN ('submitted', 'under_review', 'manual_review');

COMMIT;
