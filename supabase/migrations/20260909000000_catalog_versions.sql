-- Catalog versioning for existing LTE catalog tables.
-- Existing tables remain the published model; this table stores draft,
-- published, and rollback snapshots without creating parallel catalog tables.

BEGIN;

CREATE TABLE IF NOT EXISTS public.catalog_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'catalog',
    'role',
    'capability',
    'level',
    'module',
    'modules_content',
    'e_content',
    'module_artifact',
    'artifact_question',
    'artifact_template',
    'skill'
  )),
  entity_id UUID,
  version_no INTEGER NOT NULL CHECK (version_no > 0),
  status TEXT NOT NULL CHECK (status IN (
    'DRAFT',
    'VALIDATED',
    'PUBLISHED',
    'ABANDONED',
    'ROLLED_BACK'
  )),
  base_version_id UUID REFERENCES public.catalog_versions(id),
  supersedes_version_id UUID REFERENCES public.catalog_versions(id),
  rollback_source_version_id UUID REFERENCES public.catalog_versions(id),
  snapshot_hash TEXT,
  snapshot_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  change_reason TEXT,
  draft_revision INTEGER NOT NULL DEFAULT 1 CHECK (draft_revision > 0),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  published_by UUID,
  published_at TIMESTAMPTZ,
  CONSTRAINT catalog_versions_catalog_entity CHECK (
    (entity_type = 'catalog' AND entity_id IS NULL)
    OR (entity_type <> 'catalog' AND entity_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_catalog_versions_entity_version
  ON public.catalog_versions(entity_type, entity_id, version_no)
  WHERE entity_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_catalog_versions_catalog_version
  ON public.catalog_versions(entity_type, version_no)
  WHERE entity_type = 'catalog' AND entity_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_catalog_versions_one_entity_draft
  ON public.catalog_versions(entity_type, entity_id)
  WHERE status = 'DRAFT' AND entity_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_catalog_versions_one_catalog_draft
  ON public.catalog_versions(entity_type)
  WHERE status = 'DRAFT' AND entity_type = 'catalog' AND entity_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_catalog_versions_status
  ON public.catalog_versions(status);

CREATE INDEX IF NOT EXISTS idx_catalog_versions_supersedes
  ON public.catalog_versions(supersedes_version_id)
  WHERE supersedes_version_id IS NOT NULL;

COMMIT;
