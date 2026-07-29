-- ============================================================================
-- Migration: User 6E stage progress (TRD-DB-002)
-- Tracks 6E stage completion per module per user.
-- ============================================================================

BEGIN;

CREATE TYPE IF NOT EXISTS public.stage_completion_status AS ENUM (
  'not_started', 'in_progress', 'completed'
);

CREATE TABLE IF NOT EXISTS public.user_stage_progress (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  modules_content_id uuid NOT NULL REFERENCES public.modules_content(id) ON DELETE CASCADE,
  status            public.stage_completion_status DEFAULT 'not_started' NOT NULL,
  started_at        timestamptz,
  completed_at      timestamptz,
  time_spent_seconds integer DEFAULT 0 NOT NULL,
  created_at        timestamptz DEFAULT now() NOT NULL,
  updated_at        timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uq_user_stage UNIQUE (user_id, modules_content_id),
  CONSTRAINT chk_time_spent CHECK (time_spent_seconds >= 0)
);

CREATE INDEX IF NOT EXISTS idx_usp_user_module ON public.user_stage_progress(user_id, modules_content_id);
CREATE INDEX IF NOT EXISTS idx_usp_org_user ON public.user_stage_progress(org_id, user_id);

COMMIT;
