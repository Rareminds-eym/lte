-- ============================================================================
-- Migration: User role assignments (TRD-DB-001)
-- Tracks which role a user is pursuing. Restricted to a single active role
-- per learner in MVP.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_role_assignments (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  org_id          uuid NOT NULL,
  role_id         uuid NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
  assignment_type varchar(20) NOT NULL CHECK (assignment_type IN ('self_selected', 'admin_assigned')),
  assigned_by     uuid REFERENCES public.users(id),
  assignment_reason text,
  is_active       boolean DEFAULT true NOT NULL,
  started_at      timestamptz DEFAULT now() NOT NULL,
  completed_at    timestamptz,
  created_at      timestamptz DEFAULT now() NOT NULL,
  updated_at      timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ura_user_id ON public.user_role_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_ura_org_user ON public.user_role_assignments(org_id, user_id);
CREATE INDEX IF NOT EXISTS idx_ura_role_id ON public.user_role_assignments(role_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_single_active_role
  ON public.user_role_assignments(user_id)
  WHERE is_active = true;

COMMIT;