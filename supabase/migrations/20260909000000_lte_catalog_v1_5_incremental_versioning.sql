-- Migration: LTE Catalog Incremental Upload & Course Versioning v1.5 Schema & Backfill
-- Supports incremental course upload, versioning, mapping history, optimistic concurrency, and baseline backfill.

BEGIN;

-- 0. Logical Courses Table
--
-- The legacy catalog models a capability level in public.levels; it does not
-- provide the stable logical course identity required by the v1.5 contract.
-- Keep that legacy table intact and add the canonical course entity here.
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_code TEXT NOT NULL UNIQUE,
  course_name TEXT NOT NULL,
  short_name TEXT,
  description TEXT,
  estimated_hours NUMERIC CHECK (estimated_hours IS NULL OR estimated_hours >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_courses_course_name ON public.courses(course_name);

-- 1. Course Versions Table
CREATE TABLE IF NOT EXISTS public.course_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL,
  version_no INTEGER NOT NULL CHECK (version_no > 0),
  status TEXT NOT NULL CHECK (status IN ('DRAFT', 'VALIDATED', 'PUBLISHED', 'ABANDONED')),
  source_upload_id UUID REFERENCES public.lte_catalog_uploads(id),
  base_course_version_id UUID REFERENCES public.course_versions(id),
  supersedes_version_id UUID REFERENCES public.course_versions(id),
  rollback_source_version_id UUID REFERENCES public.course_versions(id),
  change_reason TEXT,
  reviewed_snapshot_hash TEXT,
  final_snapshot_hash TEXT,
  draft_revision INTEGER DEFAULT 1,
  snapshot_data JSONB,
  created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
  published_at TIMESTAMPTZ,
  published_by UUID,
  CONSTRAINT course_versions_unique_no UNIQUE (course_id, version_no)
);

CREATE INDEX IF NOT EXISTS idx_course_versions_course_id ON public.course_versions(course_id);
CREATE INDEX IF NOT EXISTS idx_course_versions_status ON public.course_versions(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_course_versions_one_active_draft
  ON public.course_versions(course_id)
  WHERE status = 'DRAFT';

-- 2. Add Version Pointers and Lifecycle Status to Courses Table (if courses exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'courses') THEN
    ALTER TABLE public.courses
      ADD COLUMN IF NOT EXISTS current_published_version_id UUID REFERENCES public.course_versions(id),
      ADD COLUMN IF NOT EXISTS current_assignable_version_id UUID REFERENCES public.course_versions(id),
      ADD COLUMN IF NOT EXISTS lifecycle_status TEXT DEFAULT 'ACTIVE' CHECK (lifecycle_status IN ('ACTIVE', 'RETIRED'));
  END IF;
END $$;

-- Add the course FK after both sides exist (the table is deployed independently in
-- some LTE environments).
DO $$
BEGIN
  IF to_regclass('public.courses') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_course_versions_course') THEN
    ALTER TABLE public.course_versions
      ADD CONSTRAINT fk_course_versions_course FOREIGN KEY (course_id)
      REFERENCES public.courses(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.validate_course_version_pointers()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.current_published_version_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.course_versions v
    WHERE v.id = NEW.current_published_version_id
      AND v.course_id = NEW.id AND v.status = 'PUBLISHED'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'INVALID_CURRENT_PUBLISHED_VERSION';
  END IF;

  IF NEW.current_assignable_version_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.course_versions v
    WHERE v.id = NEW.current_assignable_version_id
      AND v.course_id = NEW.id AND v.status = 'PUBLISHED'
      AND NOT EXISTS (
        SELECT 1 FROM public.version_source_assets a
        WHERE a.course_version_id = v.id
          AND a.is_required_for_learning
          AND a.asset_status <> 'ACTIVE'
      )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'INVALID_CURRENT_ASSIGNABLE_VERSION';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_course_version_pointers ON public.courses;
CREATE CONSTRAINT TRIGGER trg_validate_course_version_pointers
AFTER INSERT OR UPDATE OF current_published_version_id, current_assignable_version_id
ON public.courses DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.validate_course_version_pointers();

-- 3. Role-Capability Mapping History Table
CREATE TABLE IF NOT EXISTS public.role_capability_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL,
  capability_id UUID NOT NULL,
  priority INTEGER DEFAULT 1,
  required_level TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  active_from TIMESTAMPTZ DEFAULT clock_timestamp(),
  active_to TIMESTAMPTZ,
  created_by UUID,
  retired_by UUID,
  reason TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_role_capability_map_active 
  ON public.role_capability_map(role_id, capability_id) 
  WHERE is_active = true;

ALTER TABLE public.role_capability_map
  ADD CONSTRAINT fk_role_capability_map_role FOREIGN KEY (role_id) REFERENCES public.roles(id),
  ADD CONSTRAINT fk_role_capability_map_capability FOREIGN KEY (capability_id) REFERENCES public.capabilities(id);

-- 4. Capability-Course Actual Mapping History Table
CREATE TABLE IF NOT EXISTS public.capability_course_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capability_id UUID NOT NULL,
  course_id UUID NOT NULL,
  sequence INTEGER DEFAULT 1,
  mandatory BOOLEAN DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  active_from TIMESTAMPTZ DEFAULT clock_timestamp(),
  active_to TIMESTAMPTZ,
  created_by UUID,
  retired_by UUID,
  reason TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_capability_course_map_active 
  ON public.capability_course_map(capability_id, course_id) 
  WHERE is_active = true;

ALTER TABLE public.capability_course_map
  ADD CONSTRAINT fk_capability_course_map_capability FOREIGN KEY (capability_id) REFERENCES public.capabilities(id),
  ADD CONSTRAINT fk_capability_course_map_course FOREIGN KEY (course_id) REFERENCES public.courses(id);

-- 5. Capability-Course Plan Table (Expected/Planned Course Set Only)
CREATE TABLE IF NOT EXISTS public.capability_course_plan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capability_id UUID NOT NULL,
  course_id UUID NOT NULL,
  sequence INTEGER DEFAULT 1,
  mandatory BOOLEAN DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  active_from TIMESTAMPTZ DEFAULT clock_timestamp(),
  active_to TIMESTAMPTZ,
  created_by UUID,
  retired_by UUID,
  reason TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_capability_course_plan_active 
  ON public.capability_course_plan(capability_id, course_id) 
  WHERE is_active = true;

ALTER TABLE public.capability_course_plan
  ADD CONSTRAINT fk_capability_course_plan_capability FOREIGN KEY (capability_id) REFERENCES public.capabilities(id),
  ADD CONSTRAINT fk_capability_course_plan_course FOREIGN KEY (course_id) REFERENCES public.courses(id);

-- 6. Optimistic Concurrency Revision Counter Tables
CREATE TABLE IF NOT EXISTS public.catalog_revisions (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  catalog_revision BIGINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

INSERT INTO public.catalog_revisions (id, catalog_revision)
VALUES (1, 1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.capability_revisions (
  capability_id UUID PRIMARY KEY,
  capability_revision BIGINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

-- 7. Version-Bound Source Assets Table
CREATE TABLE IF NOT EXISTS public.version_source_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_version_id UUID NOT NULL REFERENCES public.course_versions(id),
  logical_asset_key TEXT NOT NULL,
  course_id UUID,
  module_id UUID,
  asset_type TEXT NOT NULL,
  original_filename TEXT,
  original_source_url TEXT,
  storage_key TEXT,
  content_hash TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  is_required_for_learning BOOLEAN DEFAULT true,
  asset_status TEXT DEFAULT 'STAGED' CHECK (asset_status IN ('NOT_REQUIRED', 'STAGED', 'ACTIVATION_PENDING', 'ACTIVE', 'FAILED')),
  created_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_version_source_assets_version ON public.version_source_assets(course_version_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_version_source_assets_logical_key
  ON public.version_source_assets(course_version_id, logical_asset_key);

-- 8. Canonical Aliases Table
CREATE TABLE IF NOT EXISTS public.canonical_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('ROLE', 'CAPABILITY', 'COURSE', 'MODULE', 'SKILL')),
  alias_code TEXT NOT NULL,
  canonical_uuid UUID NOT NULL,
  canonical_code TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
  CONSTRAINT canonical_aliases_unique UNIQUE (entity_type, alias_code)
);

-- 9. Function to Allocate Next Monotonic Course Version Number Safely
CREATE OR REPLACE FUNCTION public.allocate_next_course_version(p_course_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next_version INTEGER;
BEGIN
  -- The transaction-scoped advisory lock serializes every allocator for one course.
  -- Callers must allocate and insert in the same transaction (the RPCs below do).
  PERFORM pg_advisory_xact_lock(hashtextextended(p_course_id::text, 0));

  SELECT COALESCE(MAX(version_no), 0) + 1 INTO v_next_version
  FROM public.course_versions
  WHERE course_id = p_course_id;

  RETURN v_next_version;
END;
$$;

-- Enforce immutable published versions. Pointer changes happen on courses, not here.
CREATE OR REPLACE FUNCTION public.protect_published_course_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'PUBLISHED' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Published course versions are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_published_course_version ON public.course_versions;
CREATE TRIGGER trg_protect_published_course_version
BEFORE UPDATE OR DELETE ON public.course_versions
FOR EACH ROW EXECUTE FUNCTION public.protect_published_course_version();

-- Create/open a draft under one course lock. This removes the check-then-insert race.
CREATE OR REPLACE FUNCTION public.open_course_version_draft(
  p_course_id UUID,
  p_snapshot_data JSONB,
  p_change_reason TEXT DEFAULT 'WORKSPACE_EDIT_DRAFT'
)
RETURNS public.course_versions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course RECORD;
  v_draft public.course_versions;
  v_next_version INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_course_id::text, 0));

  SELECT * INTO v_draft
  FROM public.course_versions
  WHERE course_id = p_course_id AND status = 'DRAFT';
  IF FOUND THEN
    RETURN v_draft;
  END IF;

  SELECT id, current_published_version_id INTO v_course
  FROM public.courses WHERE id = p_course_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'COURSE_NOT_FOUND';
  END IF;

  v_next_version := public.allocate_next_course_version(p_course_id);
  INSERT INTO public.course_versions (
    course_id, version_no, status, base_course_version_id,
    draft_revision, change_reason, snapshot_data
  ) VALUES (
    p_course_id, v_next_version, 'DRAFT', v_course.current_published_version_id,
    1, p_change_reason, COALESCE(p_snapshot_data, '{}'::jsonb)
  ) RETURNING * INTO v_draft;
  RETURN v_draft;
END;
$$;

-- Rollback creates a reviewed draft clone; it never bypasses validation/publication.
CREATE OR REPLACE FUNCTION public.create_course_rollback_draft(
  p_course_id UUID,
  p_rollback_source_version_id UUID,
  p_expected_draft_revision INTEGER DEFAULT NULL,
  p_discard_existing_draft BOOLEAN DEFAULT FALSE
)
RETURNS public.course_versions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course RECORD;
  v_source public.course_versions;
  v_draft public.course_versions;
  v_next_version INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_course_id::text, 0));
  SELECT id, current_published_version_id INTO v_course
  FROM public.courses WHERE id = p_course_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'COURSE_NOT_FOUND';
  END IF;

  SELECT * INTO v_source FROM public.course_versions
  WHERE id = p_rollback_source_version_id
    AND course_id = p_course_id
    AND status = 'PUBLISHED';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_ROLLBACK_SOURCE';
  END IF;

  SELECT * INTO v_draft FROM public.course_versions
  WHERE course_id = p_course_id AND status = 'DRAFT' FOR UPDATE;
  IF FOUND THEN
    IF NOT p_discard_existing_draft
       OR p_expected_draft_revision IS NULL
       OR v_draft.draft_revision <> p_expected_draft_revision THEN
      RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'ACTIVE_DRAFT_EXISTS';
    END IF;
    UPDATE public.course_versions SET status = 'ABANDONED' WHERE id = v_draft.id;
  END IF;

  v_next_version := public.allocate_next_course_version(p_course_id);
  INSERT INTO public.course_versions (
    course_id, version_no, status, base_course_version_id,
    supersedes_version_id, rollback_source_version_id, change_reason,
    draft_revision, snapshot_data
  ) VALUES (
    p_course_id, v_next_version, 'DRAFT', v_course.current_published_version_id,
    v_course.current_published_version_id, v_source.id, 'ROLLBACK',
    1, v_source.snapshot_data
  ) RETURNING * INTO v_draft;
  RETURN v_draft;
END;
$$;

CREATE OR REPLACE FUNCTION public.change_course_lifecycle(
  p_course_id UUID,
  p_target_status TEXT
)
RETURNS public.courses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course public.courses;
BEGIN
  IF p_target_status NOT IN ('ACTIVE', 'RETIRED') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_LIFECYCLE_STATUS';
  END IF;

  SELECT * INTO v_course FROM public.courses WHERE id = p_course_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'COURSE_NOT_FOUND';
  END IF;
  IF v_course.lifecycle_status = p_target_status THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'COURSE_ALREADY_IN_TARGET_STATUS';
  END IF;
  IF p_target_status = 'ACTIVE' AND (
    v_course.current_published_version_id IS NULL
    OR v_course.current_assignable_version_id IS NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'COURSE_NOT_READY_FOR_REACTIVATION';
  END IF;

  UPDATE public.courses SET lifecycle_status = p_target_status
  WHERE id = p_course_id RETURNING * INTO v_course;
  UPDATE public.catalog_revisions
  SET catalog_revision = catalog_revision + 1, updated_at = clock_timestamp()
  WHERE id = 1;
  RETURN v_course;
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_course_version_draft(UUID, JSONB, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_course_rollback_draft(UUID, UUID, INTEGER, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.change_course_lifecycle(UUID, TEXT) TO service_role;

-- 10. Legacy Catalog Baseline Backfill Execution
DO $$
DECLARE
  v_course RECORD;
  v_cap RECORD;
  v_version_id UUID;
BEGIN
  -- Backfill existing courses
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'courses') THEN
    FOR v_course IN SELECT id FROM public.courses LOOP
      -- Create baseline PUBLISHED version if not already created
      IF NOT EXISTS (SELECT 1 FROM public.course_versions WHERE course_id = v_course.id AND version_no = 1) THEN
        INSERT INTO public.course_versions (
          course_id,
          version_no,
          status,
          change_reason,
          published_at
        ) VALUES (
          v_course.id,
          1,
          'PUBLISHED',
          'MIGRATION_BASELINE',
          clock_timestamp()
        ) RETURNING id INTO v_version_id;

        UPDATE public.courses
        SET 
          current_published_version_id = v_version_id,
          current_assignable_version_id = v_version_id
        WHERE id = v_course.id AND current_published_version_id IS NULL;
      END IF;
    END LOOP;
  END IF;

  -- Initialize capability_revisions for existing capabilities
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'capabilities') THEN
    FOR v_cap IN SELECT id FROM public.capabilities LOOP
      INSERT INTO public.capability_revisions (capability_id, capability_revision)
      VALUES (v_cap.id, 1)
      ON CONFLICT (capability_id) DO NOTHING;
    END LOOP;
  END IF;
END $$;

COMMIT;
