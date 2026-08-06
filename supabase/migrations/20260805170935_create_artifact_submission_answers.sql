-- Migration: Create per-question artifact submission answers table
-- Date: 2026-08-05

BEGIN;

CREATE TABLE IF NOT EXISTS public.artifact_submission_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  submission_id uuid NOT NULL,
  question_id uuid NOT NULL,

  text_response text,
  url_response text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fk_artifact_submission_answers_submission
    FOREIGN KEY (submission_id)
    REFERENCES public.artifact_submissions(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,

  CONSTRAINT fk_artifact_submission_answers_question
    FOREIGN KEY (question_id)
    REFERENCES public.artifact_questions(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT uq_artifact_submission_answers_question
    UNIQUE (submission_id, question_id),

  CONSTRAINT chk_artifact_submission_answers_has_response
    CHECK (
      text_response IS NOT NULL
      OR url_response IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_artifact_submission_answers_submission
  ON public.artifact_submission_answers(submission_id);

CREATE INDEX IF NOT EXISTS idx_artifact_submission_answers_question
  ON public.artifact_submission_answers(question_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.artifact_submission_answers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.artifact_submission_answers TO authenticated;

COMMIT;
