-- LTE Catalog Uploads Staging Table
-- Stores validated course upload snapshots before publishing

CREATE TABLE IF NOT EXISTS public.lte_catalog_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL CHECK (source_type IN ('xlsx', 'google_sheets')),
  source_name TEXT NOT NULL,
  source_file_hash TEXT NOT NULL, -- SHA-256 hash of the uploaded file
  snapshot_hash TEXT NOT NULL, -- SHA-256 hash of normalized_snapshot
  normalized_snapshot JSONB NOT NULL,
  validation_result JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN (
    'uploaded',
    'validating',
    'validated',
    'published',
    'validation_failed'
  )),
  -- SSO users live in a separate database, so this ID cannot have a local FK.
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  -- External SSO user ID; intentionally not linked to this project's auth.users.
  published_by UUID,
  last_publish_attempt_at TIMESTAMPTZ,
  last_publish_error JSONB,
  publish_attempt_count INTEGER NOT NULL DEFAULT 0,
  publish_summary JSONB
);

-- Indexes for efficient queries
CREATE INDEX idx_lte_catalog_uploads_status ON public.lte_catalog_uploads(status);
CREATE INDEX idx_lte_catalog_uploads_created_by ON public.lte_catalog_uploads(created_by);
CREATE INDEX idx_lte_catalog_uploads_created_at ON public.lte_catalog_uploads(created_at DESC);
CREATE INDEX idx_lte_catalog_uploads_snapshot_hash ON public.lte_catalog_uploads(snapshot_hash);

-- RLS is intentionally disabled for this table because the LTE app uses the
-- service-role key for server-side access and does not rely on Supabase row-level
-- security policies for course upload workflows.
ALTER TABLE public.lte_catalog_uploads DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own uploads" ON public.lte_catalog_uploads;
DROP POLICY IF EXISTS "Admins can insert uploads" ON public.lte_catalog_uploads;
DROP POLICY IF EXISTS "Admins can update uploads" ON public.lte_catalog_uploads;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_lte_catalog_uploads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_lte_catalog_uploads_updated_at
  BEFORE UPDATE ON public.lte_catalog_uploads
  FOR EACH ROW
  EXECUTE FUNCTION update_lte_catalog_uploads_updated_at();

-- Comment on table
COMMENT ON TABLE public.lte_catalog_uploads IS 'Staging table for LTE course catalog uploads. Stores validated snapshots before transactional publish.';
COMMENT ON COLUMN public.lte_catalog_uploads.snapshot_hash IS 'SHA-256 hash of the canonical normalized_snapshot JSONB. Used for tampering detection.';
COMMENT ON COLUMN public.lte_catalog_uploads.normalized_snapshot IS 'Immutable snapshot of parsed and validated course data. Contains all 15 LTE tables.';
COMMENT ON COLUMN public.lte_catalog_uploads.validation_result IS 'Validation report including errors, warnings, and table summaries.';
