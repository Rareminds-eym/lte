-- Migration: Grant xp_events table permissions
-- Date: 2026-07-31

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.xp_events TO service_role;
GRANT SELECT ON TABLE public.xp_events TO authenticated;
