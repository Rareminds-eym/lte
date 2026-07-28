-- ============================================================================
-- Migration: LTE learning catalog (2-DB split, 2026-07-16)
-- Design source: lte/docs/LTE_SPLIT_ER_DIAGRAM.md
--
-- Split contract with SkillPassport DB:
--   SkillPassport owns: industries, domains, industry_domains, role_families,
--   role, role_family_roles (all assessment data: RIASEC, aptitude, Big5,
--   work values, degree gate) and role embeddings.
--   LTE owns: capabilities, role_capability_sequence, level_scale, skills,
--   courses, course_skills, modules, modules_content, e_content,
--   module_artifacts, artifact_questions, artifact_templates.
--
-- Bridge: public.roles here is a SHADOW table. Its id mirrors
-- SkillPassport.role_family_roles.id — one row per role-in-family/domain
-- CONTEXT (deterministic UUIDv5, regenerated identically by both seed sets
-- from the same Master sheet). role_name / role_family_name / domain_name are
-- denormalized display labels; the triple is unique per context (verified in
-- Master sheet.xlsx). No cross-database FK exists.
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE public.capability_priority AS ENUM (
  'Core', 'Important', 'Supporting'
);

CREATE TYPE public.proficiency_level AS ENUM ('L1', 'L2', 'L3', 'L4', 'L5');

CREATE TYPE public.difficulty_level AS ENUM (
  'beginner', 'foundation', 'intermediate', 'advanced', 'expert'
);

CREATE TYPE public.course_status AS ENUM ('draft', 'published', 'archived');

CREATE TYPE public.lte_6e_stage AS ENUM (
  'engage', 'explore', 'explain', 'express', 'empower', 'evolve'
);

CREATE TYPE public.content_type AS ENUM (
  'pdf', 'doc', 'video', 'image', 'slide', 'link', 'audio', 'text'
);

CREATE TYPE public.content_publish_status AS ENUM (
  'draft', 'published', 'archived'
);

CREATE TYPE public.lte_artifact_type AS ENUM ('practice', 'final');

CREATE TYPE public.lte_file_type AS ENUM (
  'doc', 'ppt', 'excel', 'pdf', 'mp4', 'mp3', 'jpeg', 'png',
  'sheet', 'xls', 'docs', 'text', 'zip'
);

-- ============================================================================
-- 1. ROLES (SHADOW)
-- id is NOT auto-generated: it mirrors SkillPassport.role_family_roles.id
-- (the role context id sent by the assessment flow). Labels are denormalized
-- for display/debugging only and are intentionally NOT unique.
-- deleted_at is a soft delete: NULL = active.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public."roles" (
  "id" uuid NOT NULL,
  "role_name" varchar(255) NOT NULL,
  "role_family_name" varchar(255) NOT NULL,
  "domain_name" varchar(500) NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz,
  CONSTRAINT "pk_roles" PRIMARY KEY ("id"),
  -- Verified against Master sheet.xlsx: the name triple is unique across all
  -- 2,228 role contexts (names alone are not — multi-domain roles repeat them).
  CONSTRAINT "uq_roles_labels"
    UNIQUE ("role_name", "role_family_name", "domain_name")
);

CREATE INDEX IF NOT EXISTS "idx_roles_role_name" ON public."roles" ("role_name");
CREATE INDEX IF NOT EXISTS "idx_roles_role_family_name"
  ON public."roles" ("role_family_name");
CREATE INDEX IF NOT EXISTS "idx_roles_domain_name"
  ON public."roles" ("domain_name");
CREATE INDEX IF NOT EXISTS "idx_roles_deleted_at"
  ON public."roles" ("deleted_at") WHERE "deleted_at" IS NULL;

COMMENT ON TABLE public."roles" IS 'Shadow of SkillPassport role_family_roles: one row per role-in-family/domain context. id mirrors role_family_roles.id (deterministic UUIDv5). Labels are non-unique display copies.';

-- ============================================================================
-- 2. CAPABILITIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public."capabilities" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "code" varchar(50) NOT NULL,
  "name" text NOT NULL,
  "description" text NOT NULL,
  "master_sequence" integer,
  -- Nullable: no thumbnail assets exist yet for Excel-sourced capabilities.
  "thumbnail_url" varchar(500),
  "is_active" boolean DEFAULT true NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "pk_capabilities" PRIMARY KEY ("id"),
  CONSTRAINT "uq_capabilities_code" UNIQUE ("code")
);

CREATE INDEX IF NOT EXISTS "idx_capabilities_active"
  ON public."capabilities" ("is_active");
CREATE INDEX IF NOT EXISTS "idx_capabilities_sequence"
  ON public."capabilities" ("master_sequence");

-- ============================================================================
-- 3. LEVEL SCALE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public."level_scale" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "level_no" integer NOT NULL,
  "level_code" varchar(10) NOT NULL,
  "level_label" varchar(100) NOT NULL,
  "generic_definition" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "pk_level_scale" PRIMARY KEY ("id"),
  CONSTRAINT "uq_level_scale_level_no" UNIQUE ("level_no"),
  CONSTRAINT "uq_level_scale_level_code" UNIQUE ("level_code"),
  CONSTRAINT "chk_level_scale_level_no" CHECK ("level_no" BETWEEN 1 AND 5)
);

-- ============================================================================
-- 4. ROLE-CAPABILITY SEQUENCE
-- Learning path per role CONTEXT: FK to the shadow roles table (real
-- integrity inside LTE); identity crosses the DB boundary via the shared
-- context id (UUIDv5).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public."role_capability_sequence" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "role_id" uuid NOT NULL
    REFERENCES public."roles" ("id")
    ON UPDATE CASCADE ON DELETE CASCADE,
  "capability_id" uuid NOT NULL
    REFERENCES public."capabilities" ("id")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  "sequence_step" integer NOT NULL,
  "capability_priority" public.capability_priority,
  "required_level" public.proficiency_level,
  "duration_weeks" integer,
  "work_style_demands" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "pk_role_capability_sequence" PRIMARY KEY ("id"),
  CONSTRAINT "uq_role_capability_sequence_step"
    UNIQUE ("role_id", "sequence_step"),
  CONSTRAINT "uq_role_capability_sequence_capability"
    UNIQUE ("role_id", "capability_id"),
  CONSTRAINT "chk_role_capability_sequence_step"
    CHECK ("sequence_step" >= 1),
  CONSTRAINT "chk_role_capability_sequence_duration"
    CHECK ("duration_weeks" IS NULL OR "duration_weeks" > 0)
);

CREATE INDEX IF NOT EXISTS "idx_rcs_capability_id"
  ON public."role_capability_sequence" ("capability_id");

-- ============================================================================
-- 5. SKILLS
-- Reusable skill catalog. Skills link to COURSES (many-to-many via
-- course_skills), not to capabilities — the capability link is implied
-- via courses.capability_id.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public."skills" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "code" varchar(50) NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "pk_skills" PRIMARY KEY ("id"),
  CONSTRAINT "uq_skills_code" UNIQUE ("code")
);

CREATE INDEX IF NOT EXISTS "idx_skills_name" ON public."skills" ("name");
CREATE INDEX IF NOT EXISTS "idx_skills_tags"
  ON public."skills" USING gin ("tags");

-- ============================================================================
-- 6. COURSES
-- One course per capability per level. XP lives on e_content items,
-- not on the course.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public."courses" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "course_code" varchar(50) NOT NULL,
  "capability_id" uuid NOT NULL
    REFERENCES public."capabilities" ("id")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  "level_id" uuid NOT NULL
    REFERENCES public."level_scale" ("id")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  "title" varchar(200) NOT NULL,
  "description" text NOT NULL,
  "observable_behavior" text NOT NULL,
  "example_outputs" text NOT NULL,
  "duration_minutes" integer NOT NULL,
  "difficulty_level" public.difficulty_level NOT NULL,
  "course_status" public.course_status DEFAULT 'draft' NOT NULL,
  "version_no" integer DEFAULT 1 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "pk_courses" PRIMARY KEY ("id"),
  CONSTRAINT "uq_courses_course_code" UNIQUE ("course_code"),
  CONSTRAINT "uq_courses_capability_level"
    UNIQUE ("capability_id", "level_id"),
  CONSTRAINT "chk_courses_duration" CHECK ("duration_minutes" > 0),
  CONSTRAINT "chk_courses_version" CHECK ("version_no" >= 1)
);

CREATE INDEX IF NOT EXISTS "idx_courses_level_id"
  ON public."courses" ("level_id");
CREATE INDEX IF NOT EXISTS "idx_courses_status"
  ON public."courses" ("course_status");
CREATE INDEX IF NOT EXISTS "idx_courses_difficulty"
  ON public."courses" ("difficulty_level");
CREATE INDEX IF NOT EXISTS "idx_courses_active"
  ON public."courses" ("is_active");

-- ============================================================================
-- 7. COURSE-SKILL JUNCTION
-- ============================================================================

CREATE TABLE IF NOT EXISTS public."course_skills" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "course_id" uuid NOT NULL
    REFERENCES public."courses" ("id")
    ON UPDATE CASCADE ON DELETE CASCADE,
  "skill_id" uuid NOT NULL
    REFERENCES public."skills" ("id")
    ON UPDATE CASCADE ON DELETE CASCADE,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "pk_course_skills" PRIMARY KEY ("id"),
  CONSTRAINT "uq_course_skills" UNIQUE ("course_id", "skill_id")
);

CREATE INDEX IF NOT EXISTS "idx_course_skills_skill_id"
  ON public."course_skills" ("skill_id");

-- ============================================================================
-- 8. MODULES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public."modules" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "course_id" uuid NOT NULL
    REFERENCES public."courses" ("id")
    ON UPDATE CASCADE ON DELETE CASCADE,
  "module_no" smallint NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "learning_content" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "support" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "knowledge" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "tools" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "is_published" boolean DEFAULT false NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "pk_modules" PRIMARY KEY ("id"),
  CONSTRAINT "uq_modules_course_module_no" UNIQUE ("course_id", "module_no"),
  CONSTRAINT "chk_modules_module_no" CHECK ("module_no" >= 0)
);

CREATE INDEX IF NOT EXISTS "idx_modules_active"
  ON public."modules" ("is_active");
CREATE INDEX IF NOT EXISTS "idx_modules_published"
  ON public."modules" ("is_published");

-- ============================================================================
-- 9. MODULE 6E STAGES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public."modules_content" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "module_id" uuid NOT NULL
    REFERENCES public."modules" ("id")
    ON UPDATE CASCADE ON DELETE CASCADE,
  "stage_name" public.lte_6e_stage NOT NULL,
  "stage_order" integer NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "pk_modules_content" PRIMARY KEY ("id"),
  CONSTRAINT "uq_modules_content_module_stage"
    UNIQUE ("module_id", "stage_name"),
  CONSTRAINT "uq_modules_content_module_order"
    UNIQUE ("module_id", "stage_order"),
  CONSTRAINT "chk_modules_content_stage_order"
    CHECK ("stage_order" BETWEEN 1 AND 6)
);

CREATE INDEX IF NOT EXISTS "idx_modules_content_stage_name"
  ON public."modules_content" ("stage_name");
CREATE INDEX IF NOT EXISTS "idx_modules_content_active"
  ON public."modules_content" ("is_active");

-- ============================================================================
-- 10. E-CONTENT (6E stage content items; carries xp_reward)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public."e_content" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "modules_content_id" uuid NOT NULL
    REFERENCES public."modules_content" ("id")
    ON UPDATE CASCADE ON DELETE CASCADE,
  "content_type" public.content_type NOT NULL,
  "title" varchar(255) NOT NULL,
  "description" text,
  "url" varchar(1000) NOT NULL,
  "sort_order" integer DEFAULT 1 NOT NULL,
  "duration_seconds" integer,
  "xp_reward" integer,
  "mime_type" varchar(150),
  "file_size_bytes" bigint,
  "version" integer DEFAULT 1 NOT NULL,
  "status" public.content_publish_status DEFAULT 'draft' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "pk_e_content" PRIMARY KEY ("id"),
  CONSTRAINT "chk_e_content_sort_order" CHECK ("sort_order" >= 1),
  CONSTRAINT "chk_e_content_duration"
    CHECK ("duration_seconds" IS NULL OR "duration_seconds" >= 0),
  CONSTRAINT "chk_e_content_xp"
    CHECK ("xp_reward" IS NULL OR "xp_reward" >= 0),
  CONSTRAINT "chk_e_content_file_size"
    CHECK ("file_size_bytes" IS NULL OR "file_size_bytes" >= 0),
  CONSTRAINT "chk_e_content_version" CHECK ("version" >= 1),
  CONSTRAINT "chk_e_content_mime_type" CHECK (
    "mime_type" IS NULL OR "mime_type" IN (
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/zip',
      'application/x-zip-compressed',
      'application/json',
      'application/xml',
      'application/octet-stream',
      'text/plain',
      'text/html',
      'text/csv',
      'text/markdown',
      'video/mp4',
      'video/webm',
      'video/ogg',
      'video/quicktime',
      'audio/mpeg',
      'audio/ogg',
      'audio/wav',
      'audio/webm',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml'
    )
  )
);

CREATE INDEX IF NOT EXISTS "idx_e_content_stage_sort"
  ON public."e_content" ("modules_content_id", "sort_order");
CREATE INDEX IF NOT EXISTS "idx_e_content_type"
  ON public."e_content" ("content_type");
CREATE INDEX IF NOT EXISTS "idx_e_content_status"
  ON public."e_content" ("status");

-- ============================================================================
-- 11. MODULE ARTIFACTS
-- Artifact requirements belong to an exact module 6E stage. This identifies
-- the stage at which the learner must produce the artifact without introducing
-- any submission or evaluation tables.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public."module_artifacts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "modules_content_id" uuid NOT NULL
    REFERENCES public."modules_content" ("id")
    ON UPDATE CASCADE ON DELETE CASCADE,
  "artifact_type" public.lte_artifact_type NOT NULL,
  "total_score" integer NOT NULL,
  "passing_score" integer,
  "is_active" boolean DEFAULT true NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "pk_module_artifacts" PRIMARY KEY ("id"),
  CONSTRAINT "chk_module_artifacts_total_score" CHECK ("total_score" > 0),
  CONSTRAINT "chk_module_artifacts_passing_score"
    CHECK (
      "passing_score" IS NULL
      OR "passing_score" BETWEEN 0 AND "total_score"
    )
);

CREATE INDEX IF NOT EXISTS "idx_module_artifacts_modules_content_id"
  ON public."module_artifacts" ("modules_content_id");

-- ============================================================================
-- 12. ARTIFACT QUESTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public."artifact_questions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "artifact_id" uuid NOT NULL
    REFERENCES public."module_artifacts" ("id")
    ON UPDATE CASCADE ON DELETE CASCADE,
  "question_order" integer NOT NULL,
  "title" varchar(255) NOT NULL,
  "description" text NOT NULL,
  "instructions" text NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "pk_artifact_questions" PRIMARY KEY ("id"),
  CONSTRAINT "uq_artifact_questions_order"
    UNIQUE ("artifact_id", "question_order"),
  CONSTRAINT "chk_artifact_questions_order" CHECK ("question_order" >= 1)
);

-- ============================================================================
-- 13. ARTIFACT TEMPLATES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public."artifact_templates" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "artifact_id" uuid NOT NULL
    REFERENCES public."module_artifacts" ("id")
    ON UPDATE CASCADE ON DELETE CASCADE,
  "question_id" uuid
    REFERENCES public."artifact_questions" ("id")
    ON UPDATE CASCADE ON DELETE SET NULL,
  "file_name" varchar(255) NOT NULL,
  "file_url" varchar(1000) NOT NULL,
  "file_type" public.lte_file_type NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "is_downloadable" boolean DEFAULT true NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "pk_artifact_templates" PRIMARY KEY ("id"),
  CONSTRAINT "chk_artifact_templates_version" CHECK ("version" >= 1)
);

CREATE INDEX IF NOT EXISTS "idx_artifact_templates_artifact_id"
  ON public."artifact_templates" ("artifact_id");

CREATE INDEX IF NOT EXISTS "idx_artifact_templates_question_id"
  ON public."artifact_templates" ("question_id")
  WHERE "question_id" IS NOT NULL;

-- ============================================================================
-- AUTOMATIC TIMESTAMPS
-- Each table needs its own trigger, but all triggers share one function.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_lte_timestamps()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := COALESCE(NEW.created_at, now());
  ELSE
    -- Keep the original creation time when a row is updated.
    NEW.created_at := OLD.created_at;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_roles_timestamps
  BEFORE INSERT OR UPDATE ON public."roles"
  FOR EACH ROW EXECUTE FUNCTION public.set_lte_timestamps();

CREATE TRIGGER set_capabilities_timestamps
  BEFORE INSERT OR UPDATE ON public."capabilities"
  FOR EACH ROW EXECUTE FUNCTION public.set_lte_timestamps();

CREATE TRIGGER set_level_scale_timestamps
  BEFORE INSERT OR UPDATE ON public."level_scale"
  FOR EACH ROW EXECUTE FUNCTION public.set_lte_timestamps();

CREATE TRIGGER set_skills_timestamps
  BEFORE INSERT OR UPDATE ON public."skills"
  FOR EACH ROW EXECUTE FUNCTION public.set_lte_timestamps();

CREATE TRIGGER set_courses_timestamps
  BEFORE INSERT OR UPDATE ON public."courses"
  FOR EACH ROW EXECUTE FUNCTION public.set_lte_timestamps();

CREATE TRIGGER set_modules_timestamps
  BEFORE INSERT OR UPDATE ON public."modules"
  FOR EACH ROW EXECUTE FUNCTION public.set_lte_timestamps();

CREATE TRIGGER set_modules_content_timestamps
  BEFORE INSERT OR UPDATE ON public."modules_content"
  FOR EACH ROW EXECUTE FUNCTION public.set_lte_timestamps();

CREATE TRIGGER set_e_content_timestamps
  BEFORE INSERT OR UPDATE ON public."e_content"
  FOR EACH ROW EXECUTE FUNCTION public.set_lte_timestamps();

CREATE TRIGGER set_module_artifacts_timestamps
  BEFORE INSERT OR UPDATE ON public."module_artifacts"
  FOR EACH ROW EXECUTE FUNCTION public.set_lte_timestamps();

CREATE TRIGGER set_artifact_questions_timestamps
  BEFORE INSERT OR UPDATE ON public."artifact_questions"
  FOR EACH ROW EXECUTE FUNCTION public.set_lte_timestamps();

CREATE TRIGGER set_artifact_templates_timestamps
  BEFORE INSERT OR UPDATE ON public."artifact_templates"
  FOR EACH ROW EXECUTE FUNCTION public.set_lte_timestamps();

COMMIT;
