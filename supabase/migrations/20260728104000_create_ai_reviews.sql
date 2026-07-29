-- ============================================================================
-- Migration: AI reviews (TRD-DB-005)
-- Stores AI evaluation results. Strictly immutable — one row per
-- evaluation attempt.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_reviews (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id       uuid NOT NULL REFERENCES public.artifact_submissions(id) ON DELETE RESTRICT,
  -- AI output
  overall_score       numeric(5,2) NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  criterion_scores    jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence          numeric(3,2) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  is_critical_failure boolean DEFAULT false NOT NULL,
  -- Feedback
  strengths           text[] DEFAULT '{}' NOT NULL,
  improvement_areas   text[] DEFAULT '{}' NOT NULL,
  evidence_found      text[] DEFAULT '{}' NOT NULL,
  evidence_missing    text[] DEFAULT '{}' NOT NULL,
  learner_feedback    text NOT NULL,
  resubmission_guidance text,
  -- Immutability & Superseding tracking
  superseded_by_id    uuid REFERENCES public.ai_reviews(id),
  -- Metadata
  rubric_version      integer NOT NULL,
  model_id            varchar(100) NOT NULL,
  prompt_version      varchar(50) NOT NULL,
  latency_ms          integer,
  raw_response        jsonb,
  created_at          timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT chk_criterion_scores CHECK (jsonb_typeof(criterion_scores) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_ar_submission_id ON public.ai_reviews(submission_id);
CREATE INDEX IF NOT EXISTS idx_ar_org ON public.ai_reviews(org_id);
CREATE INDEX IF NOT EXISTS idx_ar_critical ON public.ai_reviews(is_critical_failure) WHERE is_critical_failure = true;
CREATE INDEX IF NOT EXISTS idx_ar_low_confidence ON public.ai_reviews(confidence) WHERE confidence < 0.7;

COMMIT;
