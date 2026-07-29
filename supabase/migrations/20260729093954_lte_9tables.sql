-- ============================================================================
-- Migration: Recreate user learning progress and artifact workflow tables
-- Date: 2026-07-29
-- Database: PostgreSQL / Supabase
--

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

CREATE TYPE public.artifact_evaluation_stage AS ENUM ('ai');

-- ============================================================================
-- 1. USER CAPABILITIES
-- ============================================================================

CREATE TABLE public.user_capabilities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id uuid NOT NULL,
    learning_path_id uuid NOT NULL,
    role_sequence_id uuid NOT NULL,

    current_level integer NOT NULL DEFAULT 0,
    required_level integer NOT NULL,
    gap integer NOT NULL,
    has_gap boolean NOT NULL DEFAULT true,
    gap_score integer NOT NULL,

    badge varchar NOT NULL DEFAULT 'none',

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_user_capabilities_user
        FOREIGN KEY (user_id)
        REFERENCES public.users(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_user_capabilities_learning_path
        FOREIGN KEY (learning_path_id)
        REFERENCES public.learning_paths(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_user_capabilities_role_sequence
        FOREIGN KEY (role_sequence_id)
        REFERENCES public.role_capability_sequence(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT uq_user_capabilities_user_role_sequence
        UNIQUE (user_id, role_sequence_id)
);

CREATE INDEX idx_user_capabilities_user_path
    ON public.user_capabilities(user_id, learning_path_id);

CREATE INDEX idx_user_capabilities_role_sequence
    ON public.user_capabilities(role_sequence_id);

CREATE INDEX idx_user_capabilities_user_gap
    ON public.user_capabilities(user_id, has_gap);

CREATE INDEX idx_user_capabilities_user_badge
    ON public.user_capabilities(user_id, badge);

-- ============================================================================
-- 2. USER CAPABILITY LEVEL PROGRESS
-- ============================================================================

CREATE TABLE public.user_capability_level_progress (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id uuid NOT NULL,
    learning_path_id uuid NOT NULL,
    level_id uuid NOT NULL,

    sequence_no integer NOT NULL,

    from_level integer NOT NULL,
    to_level integer NOT NULL,
    current_score integer NOT NULL,
    current_level integer NOT NULL,
    required_level integer NOT NULL,

    gap integer NOT NULL,
    has_gap boolean NOT NULL DEFAULT false,
    gap_score integer NOT NULL,

    priority_band varchar NOT NULL DEFAULT 'none',
    status varchar NOT NULL DEFAULT 'not_started',
    badge varchar NOT NULL DEFAULT 'none',

    completion_percentage integer NOT NULL DEFAULT 0,

    started_at timestamptz,
    completed_at timestamptz,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_user_capability_level_progress_user
        FOREIGN KEY (user_id)
        REFERENCES public.users(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_user_capability_level_progress_learning_path
        FOREIGN KEY (learning_path_id)
        REFERENCES public.learning_paths(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_user_capability_level_progress_level
        FOREIGN KEY (level_id)
        REFERENCES public.levels(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT uq_user_capability_level_progress
        UNIQUE (user_id, learning_path_id, level_id)
);

CREATE INDEX idx_user_capability_level_progress_user_path_level
    ON public.user_capability_level_progress(
        user_id,
        learning_path_id,
        level_id
    );

CREATE INDEX idx_user_capability_level_progress_user_gap
    ON public.user_capability_level_progress(user_id, has_gap);

CREATE INDEX idx_user_capability_level_progress_user_priority
    ON public.user_capability_level_progress(user_id, priority_band);

CREATE INDEX idx_user_capability_level_progress_user_status
    ON public.user_capability_level_progress(user_id, status);

CREATE INDEX idx_user_capability_level_progress_level
    ON public.user_capability_level_progress(level_id);

-- ============================================================================
-- 3. USER MODULE PROGRESS
-- ============================================================================

CREATE TABLE public.user_module_progress (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id uuid NOT NULL,
    user_capability_level_progress_id uuid NOT NULL,
    module_id uuid NOT NULL,

    module_status varchar NOT NULL DEFAULT 'not_started',
    current_stage varchar NOT NULL DEFAULT 'none',

    stages_completed integer NOT NULL DEFAULT 0,
    completion_percentage integer NOT NULL DEFAULT 0,

    artifact_submitted boolean NOT NULL DEFAULT false,
    artifact_approval_status varchar NOT NULL DEFAULT 'not_submitted',

    last_activity_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_user_module_progress_user
        FOREIGN KEY (user_id)
        REFERENCES public.users(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_user_module_progress_capability_level_progress
        FOREIGN KEY (user_capability_level_progress_id)
        REFERENCES public.user_capability_level_progress(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_user_module_progress_module
        FOREIGN KEY (module_id)
        REFERENCES public.modules(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT uq_user_module_progress
        UNIQUE (
            user_id,
            user_capability_level_progress_id,
            module_id
        )
);

CREATE INDEX idx_user_module_progress_user
    ON public.user_module_progress(user_id);

CREATE INDEX idx_user_module_progress_capability_level
    ON public.user_module_progress(user_capability_level_progress_id);

CREATE INDEX idx_user_module_progress_module
    ON public.user_module_progress(module_id);

CREATE INDEX idx_user_module_progress_artifact_status
    ON public.user_module_progress(artifact_approval_status);

-- ============================================================================
-- 4. ARTIFACT SUBMISSIONS
--
-- evaluation_id is intentionally not stored here because it creates a circular
-- foreign-key dependency. The current evaluation is identified from
-- artifact_evaluation_flows.is_current_stage.
-- ============================================================================

CREATE TABLE public.artifact_submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    artifact_id uuid NOT NULL,
    user_id uuid NOT NULL,
    user_module_progress_id uuid NOT NULL,

    attempt_no integer NOT NULL DEFAULT 1,
    version_label varchar NOT NULL,
    is_latest boolean NOT NULL DEFAULT true,

    previous_submission_id uuid,

    submission_mode varchar NOT NULL DEFAULT 'normal',
    status varchar NOT NULL DEFAULT 'submitted',

    submitted_at timestamptz NOT NULL DEFAULT now(),
    sealed_at timestamptz,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_artifact_submissions_artifact
        FOREIGN KEY (artifact_id)
        REFERENCES public.module_artifacts(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_artifact_submissions_user
        FOREIGN KEY (user_id)
        REFERENCES public.users(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_artifact_submissions_module_progress
        FOREIGN KEY (user_module_progress_id)
        REFERENCES public.user_module_progress(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_artifact_submissions_previous
        FOREIGN KEY (previous_submission_id)
        REFERENCES public.artifact_submissions(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT uq_artifact_submission_attempt
        UNIQUE (artifact_id, user_id, attempt_no)
);

CREATE INDEX idx_artifact_submissions_artifact
    ON public.artifact_submissions(artifact_id);

CREATE INDEX idx_artifact_submissions_user
    ON public.artifact_submissions(user_id);

CREATE INDEX idx_artifact_submissions_progress
    ON public.artifact_submissions(user_module_progress_id);

CREATE INDEX idx_artifact_submissions_latest
    ON public.artifact_submissions(artifact_id, user_id, is_latest);

CREATE INDEX idx_artifact_submissions_status
    ON public.artifact_submissions(status);

CREATE INDEX idx_artifact_submissions_previous
    ON public.artifact_submissions(previous_submission_id);

-- ============================================================================
-- 5. SKILL GAP
-- assessment_id and attempt_id come from the external assessment system.
-- ============================================================================

CREATE TABLE public.skill_gap (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id uuid NOT NULL,
    assessment_id uuid NOT NULL,
    attempt_id uuid,

    priorities jsonb NOT NULL DEFAULT '[]'::jsonb,
    learning_tracks jsonb NOT NULL DEFAULT '[]'::jsonb,
    current_strengths jsonb NOT NULL DEFAULT '[]'::jsonb,

    recommended_track varchar,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_skill_gap_user
        FOREIGN KEY (user_id)
        REFERENCES public.users(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT uq_skill_gap_user_assessment
        UNIQUE (user_id, assessment_id)
);

CREATE INDEX idx_skill_gap_user
    ON public.skill_gap(user_id);

CREATE INDEX idx_skill_gap_assessment
    ON public.skill_gap(assessment_id);

CREATE INDEX idx_skill_gap_recommended_track
    ON public.skill_gap(recommended_track);

-- ============================================================================
-- 6. PROFILE SNAPSHOT
-- assessment_id and attempt_id come from the external assessment system.
-- ============================================================================

CREATE TABLE public.profile_snapshot (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id uuid NOT NULL,
    assessment_id uuid NOT NULL,
    attempt_id uuid,

    key_patterns jsonb NOT NULL DEFAULT '[]'::jsonb,
    aptitude_strengths jsonb NOT NULL DEFAULT '[]'::jsonb,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_profile_snapshot_user
        FOREIGN KEY (user_id)
        REFERENCES public.users(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT uq_profile_snapshot_user_assessment
        UNIQUE (user_id, assessment_id)
);

CREATE INDEX idx_profile_snapshot_user
    ON public.profile_snapshot(user_id);

CREATE INDEX idx_profile_snapshot_assessment
    ON public.profile_snapshot(assessment_id);

-- ============================================================================
-- 7. LEARNING TRACK EVIDENCE
-- assessment_id comes from the external assessment system.
-- ============================================================================

CREATE TABLE public.learning_track_evidence (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    learning_track_id uuid NOT NULL,
    user_id uuid NOT NULL,
    assessment_id uuid NOT NULL,

    evidence_values text NOT NULL,
    evidence_aptitude text NOT NULL,
    evidence_interest text NOT NULL,
    evidence_personality text NOT NULL,
    evidence_employability text NOT NULL,
    evidence_adaptive_aptitude text NOT NULL,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_learning_track_evidence_track
        FOREIGN KEY (learning_track_id)
        REFERENCES public.learning_tracks(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_learning_track_evidence_user
        FOREIGN KEY (user_id)
        REFERENCES public.users(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT uq_learning_track_evidence_track
        UNIQUE (learning_track_id)
);

CREATE INDEX idx_learning_track_evidence_user
    ON public.learning_track_evidence(user_id);

CREATE INDEX idx_learning_track_evidence_assessment
    ON public.learning_track_evidence(assessment_id);

CREATE INDEX idx_learning_track_evidence_user_assessment
    ON public.learning_track_evidence(user_id, assessment_id);

-- ============================================================================
-- 8. ARTIFACT EVALUATION FLOWS
-- Stage is currently AI-only.
-- evaluated_by is NULL for automated AI evaluation and may store a user UUID when a staff member reviews the result.
-- metadata is optional and has no enforced JSON structure.
-- ============================================================================

CREATE TABLE public.artifact_evaluation_flows (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    submission_id uuid NOT NULL,

    stage public.artifact_evaluation_stage NOT NULL DEFAULT 'ai',
    stage_order integer NOT NULL DEFAULT 1,

    status varchar NOT NULL DEFAULT 'pending',

    evaluated_by uuid,

    score integer,
    feedback text,
    improvements text,
    decision varchar,

    completed_at timestamptz,

    overall_status varchar NOT NULL DEFAULT 'initiated',
    is_current_stage boolean NOT NULL DEFAULT false,
    progression_triggered boolean NOT NULL DEFAULT false,

    metadata jsonb,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_artifact_evaluation_submission
        FOREIGN KEY (submission_id)
        REFERENCES public.artifact_submissions(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_artifact_evaluation_user
        FOREIGN KEY (evaluated_by)
        REFERENCES public.users(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT uq_artifact_evaluation_submission_stage
        UNIQUE (submission_id, stage)
);

COMMENT ON COLUMN public.artifact_evaluation_flows.metadata IS
'Optional evaluation metadata such as confidence, model_name, provider, prompt_version, token usage, latency, reviewer notes, or other details. No JSON shape is enforced.';

CREATE INDEX idx_artifact_evaluation_submission
    ON public.artifact_evaluation_flows(submission_id);

CREATE INDEX idx_artifact_evaluation_current_stage
    ON public.artifact_evaluation_flows(submission_id, is_current_stage);

CREATE INDEX idx_artifact_evaluation_evaluated_by
    ON public.artifact_evaluation_flows(evaluated_by);

CREATE INDEX idx_artifact_evaluation_overall_status
    ON public.artifact_evaluation_flows(overall_status);

CREATE INDEX idx_artifact_evaluation_progression
    ON public.artifact_evaluation_flows(
        overall_status,
        progression_triggered
    );

-- ============================================================================
-- 9. ARTIFACT SUBMISSION FILES
-- ============================================================================

CREATE TABLE public.artifact_submission_files (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    submission_id uuid NOT NULL,
    question_id uuid NOT NULL,

    file_name varchar NOT NULL,
    file_url varchar NOT NULL,
    file_type varchar NOT NULL,
    file_size_bytes bigint,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_artifact_submission_files_submission
        FOREIGN KEY (submission_id)
        REFERENCES public.artifact_submissions(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_artifact_submission_files_question
        FOREIGN KEY (question_id)
        REFERENCES public.artifact_questions(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX idx_artifact_submission_files_submission
    ON public.artifact_submission_files(submission_id);

CREATE INDEX idx_artifact_submission_files_submission_question
    ON public.artifact_submission_files(submission_id, question_id);

COMMIT;