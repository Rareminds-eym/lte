-- ============================================================================
-- Migration: XP events (TRD-DB-007)
-- Append-only XP ledger. Immutable after creation.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'xp_category' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.xp_category AS ENUM ('evidence', 'engagement');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'xp_event_type' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.xp_event_type AS ENUM (
      -- Evidence-Bearing Events (Contributes to Readiness)
      'stage_completed',
      'practice_artifact_accepted',
      'final_artifact_accepted_1',
      'final_artifact_accepted_2',
      'final_artifact_accepted_3',
      'manual_eval_accepted',
      'course_completed_on_time',
      'fast_track_capability',
      'capstone_completed',
      -- Engagement & Consistency Events (Excluded from Readiness)
      'daily_login',
      'profile_completed',
      'streak_7_day',
      'consistency_30_day',
      'readiness_milestone_25',
      'readiness_milestone_50',
      'readiness_milestone_75',
      'readiness_milestone_100',
      'legacy_consistency_bonus',
      'promotional_xp',
      'practice_artifact_failed',
      'fallback_eval_failed',
      'final_artifact_failed'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.xp_events (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_type      public.xp_event_type NOT NULL,
  xp_category     public.xp_category NOT NULL,
  xp_amount       integer NOT NULL CHECK (xp_amount >= 0),
  -- Source references (polymorphic)
  source_type     varchar(50) NOT NULL,
  source_id       uuid NOT NULL,
  -- Deduplication
  idempotency_key varchar(200) NOT NULL,
  -- Audit
  metadata        jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at      timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uq_xp_idempotency UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_xp_user ON public.xp_events(user_id);
CREATE INDEX IF NOT EXISTS idx_xp_user_category ON public.xp_events(user_id, xp_category);
CREATE INDEX IF NOT EXISTS idx_xp_user_evidence ON public.xp_events(user_id)
  WHERE xp_category = 'evidence';

COMMIT;
