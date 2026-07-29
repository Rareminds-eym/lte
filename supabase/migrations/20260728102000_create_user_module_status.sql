-- ============================================================================
-- Migration: User module status (TRD-DB-003)
-- Tracks learning-complete vs mastered per module per user.
-- ============================================================================

BEGIN;

CREATE TYPE IF NOT EXISTS public.module_mastery_status AS ENUM (
  'not_started', 'in_progress', 'learning_complete', 'mastered'
);

CREATE TABLE IF NOT EXISTS public.user_module_status (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  module_id       uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  status          public.module_mastery_status DEFAULT 'not_started' NOT NULL,
  stages_completed smallint DEFAULT 0 NOT NULL CHECK (stages_completed BETWEEN 0 AND 6),
  learning_completed_at timestamptz,
  mastered_at     timestamptz,
  created_at      timestamptz DEFAULT now() NOT NULL,
  updated_at      timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uq_user_module UNIQUE (user_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_ums_org_user ON public.user_module_status(org_id, user_id);

COMMIT;
