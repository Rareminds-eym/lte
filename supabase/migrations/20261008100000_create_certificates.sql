-- ============================================================================
-- Migration: Create certificates table
-- Phase: Expand (additive only)
-- Breaking: No
-- ============================================================================

BEGIN;

CREATE TYPE public.certificate_type AS ENUM (
  'course_completion',
  'role_readiness'
);

CREATE TYPE public.certificate_status AS ENUM (
  'pending_name',  -- completion recorded; learner name missing
  'issued',        -- verifiable, downloadable, immutable
  'revoked'        -- invalidated by ops; verify reports revoked; frozen
);

CREATE TABLE public.certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Public identifier used in verify URLs. Format: LTE-<16 Crockford base32>.
  credential_id varchar(24) NOT NULL,

  user_id uuid NOT NULL
    REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE,

  certificate_type public.certificate_type NOT NULL,
  status public.certificate_status NOT NULL DEFAULT 'pending_name',

  -- Natural subject (exactly one, by type)
  level_id uuid
    REFERENCES public.levels(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  role_id uuid
    REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE RESTRICT,

  -- Provenance (may disappear on re-import; certificate must survive)
  learning_path_id uuid
    REFERENCES public.learning_paths(id) ON UPDATE CASCADE ON DELETE SET NULL,
  level_progress_id uuid
    REFERENCES public.user_capability_level_progress(id) ON UPDATE CASCADE ON DELETE SET NULL,

  -- Immutable display snapshot
  learner_name varchar(255),
  title varchar(500) NOT NULL,
  subtitle varchar(500),
  level_label varchar(100),
  badge varchar(20),
  completion_date timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  issued_at timestamptz,

  -- PDF cache
  pdf_object_key varchar(500),
  pdf_template_version smallint,
  pdf_generated_at timestamptz,

  -- Revocation
  revoked_at timestamptz,
  revoked_reason text,
  revoked_by uuid
    REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_certificates_credential_id UNIQUE (credential_id),

  CONSTRAINT chk_certificates_credential_format
    CHECK (credential_id ~ '^LTE-[0-9A-HJKMNP-TV-Z]{16}$'),

  CONSTRAINT chk_certificates_subject
    CHECK (
      (certificate_type = 'course_completion' AND level_id IS NOT NULL AND role_id IS NULL)
      OR
      (certificate_type = 'role_readiness' AND role_id IS NOT NULL AND level_id IS NULL)
    ),

  CONSTRAINT chk_certificates_badge
    CHECK (badge IS NULL OR badge IN ('developing', 'skilled', 'mastery')),

  CONSTRAINT chk_certificates_issued_fields
    CHECK (
      status = 'pending_name'
      OR (
        learner_name IS NOT NULL
        AND length(btrim(learner_name)) > 0
        AND issued_at IS NOT NULL
      )
    ),

  CONSTRAINT chk_certificates_revoked_fields
    CHECK (status <> 'revoked' OR revoked_at IS NOT NULL),

  CONSTRAINT chk_certificates_pdf_fields
    CHECK (
      pdf_object_key IS NULL
      OR (pdf_template_version IS NOT NULL AND pdf_generated_at IS NOT NULL)
    )
);

-- One certificate per user per course / per role, across learning-path versions
CREATE UNIQUE INDEX uq_certificates_user_level
  ON public.certificates (user_id, level_id)
  WHERE certificate_type = 'course_completion';

CREATE UNIQUE INDEX uq_certificates_user_role
  ON public.certificates (user_id, role_id)
  WHERE certificate_type = 'role_readiness';

CREATE INDEX idx_certificates_user_status
  ON public.certificates (user_id, status);

-- SkillPassport incremental pull (updatedSince + cursor)
CREATE INDEX idx_certificates_updated_at_id
  ON public.certificates (updated_at, id);

-- ============================================================================
-- Immutability (replaces HMAC signing; see plan D16)
-- Allowed transitions:
--   pending_name → pending_name | issued   (snapshot may be set until issued)
--   issued       → issued (PDF cache columns only) | revoked (revocation columns only)
--   revoked      → revoked (no changes)
-- Always allowed: provenance FKs set to NULL by ON DELETE SET NULL; updated_at.
-- Identity columns never change.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.certificates_enforce_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.credential_id IS DISTINCT FROM OLD.credential_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.certificate_type IS DISTINCT FROM OLD.certificate_type
     OR NEW.level_id IS DISTINCT FROM OLD.level_id
     OR NEW.role_id IS DISTINCT FROM OLD.role_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'certificate identity is immutable (credential %)', OLD.credential_id
      USING ERRCODE = 'check_violation';
  END IF;

  IF (NEW.learning_path_id IS DISTINCT FROM OLD.learning_path_id AND NEW.learning_path_id IS NOT NULL)
     OR (NEW.level_progress_id IS DISTINCT FROM OLD.level_progress_id AND NEW.level_progress_id IS NOT NULL) THEN
    RAISE EXCEPTION 'certificate provenance can only be cleared (credential %)', OLD.credential_id
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.status = 'pending_name' THEN
    IF NEW.status NOT IN ('pending_name', 'issued') THEN
      RAISE EXCEPTION 'pending certificate must be issued before revocation' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.learner_name IS DISTINCT FROM OLD.learner_name
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.subtitle IS DISTINCT FROM OLD.subtitle
     OR NEW.level_label IS DISTINCT FROM OLD.level_label
     OR NEW.badge IS DISTINCT FROM OLD.badge
     OR NEW.completion_date IS DISTINCT FROM OLD.completion_date
     OR NEW.metadata IS DISTINCT FROM OLD.metadata
     OR NEW.issued_at IS DISTINCT FROM OLD.issued_at THEN
    RAISE EXCEPTION 'issued certificate content is immutable (credential %)', OLD.credential_id
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.status = 'issued' AND NEW.status = 'pending_name' THEN
    RAISE EXCEPTION 'issued certificate cannot return to pending_name (credential %)', OLD.credential_id
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.status = 'issued' AND NEW.status = 'issued' AND (
    NEW.revoked_at IS DISTINCT FROM OLD.revoked_at OR
    NEW.revoked_reason IS DISTINCT FROM OLD.revoked_reason OR
    NEW.revoked_by IS DISTINCT FROM OLD.revoked_by) THEN
    RAISE EXCEPTION 'revocation fields require revocation' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.status = 'issued' AND NEW.status = 'revoked' AND (
    NEW.pdf_object_key IS DISTINCT FROM OLD.pdf_object_key OR
    NEW.pdf_template_version IS DISTINCT FROM OLD.pdf_template_version OR
    NEW.pdf_generated_at IS DISTINCT FROM OLD.pdf_generated_at) THEN
    RAISE EXCEPTION 'revocation cannot change PDF cache' USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.status = 'revoked' THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.revoked_at IS DISTINCT FROM OLD.revoked_at
       OR NEW.revoked_reason IS DISTINCT FROM OLD.revoked_reason
       OR (NEW.revoked_by IS DISTINCT FROM OLD.revoked_by AND NEW.revoked_by IS NOT NULL)
       OR NEW.pdf_object_key IS DISTINCT FROM OLD.pdf_object_key
       OR NEW.pdf_template_version IS DISTINCT FROM OLD.pdf_template_version
       OR NEW.pdf_generated_at IS DISTINCT FROM OLD.pdf_generated_at THEN
      RAISE EXCEPTION 'revoked certificate is frozen (credential %)', OLD.credential_id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_certificates_enforce_immutability
BEFORE UPDATE ON public.certificates
FOR EACH ROW
EXECUTE FUNCTION public.certificates_enforce_immutability();

CREATE TRIGGER trg_certificates_set_updated_at
BEFORE UPDATE ON public.certificates
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.certificates IS
  'Immutable certificate snapshots for course (level) and role (learning path) completion. Authenticity = authoritative lookup by credential_id; integrity = trg_certificates_enforce_immutability.';
COMMENT ON COLUMN public.certificates.credential_id IS
  'Public 80-bit identifier (LTE-<16 Crockford base32>) used in verify URLs.';
COMMENT ON COLUMN public.certificates.pdf_object_key IS
  'R2 key of the rendered PDF; contains a 128-bit random segment. Never exposed publicly.';

CREATE INDEX idx_certificates_learning_path ON public.certificates (learning_path_id) WHERE learning_path_id IS NOT NULL;
CREATE INDEX idx_certificates_level_progress ON public.certificates (level_progress_id) WHERE level_progress_id IS NOT NULL;
CREATE INDEX idx_certificates_revoked_by ON public.certificates (revoked_by) WHERE revoked_by IS NOT NULL;

COMMIT;
