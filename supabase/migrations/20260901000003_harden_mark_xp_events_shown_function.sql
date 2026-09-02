-- Migration: harden mark_xp_events_shown (IDOR + search_path) — replaces 20260812093636 in-place edit via new file (append-only)
-- Fixes: p_user_id spoof via auth.uid() check + SECURITY DEFINER SET search_path='' (see plan 2026-09-01 Option A)
-- Safe: CREATE OR REPLACE is idempotent, no table rewrite
BEGIN;

CREATE OR REPLACE FUNCTION public.mark_xp_events_shown(p_event_ids UUID[], p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.xp_events
  SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{modal_shown}', 'true'::jsonb)
  WHERE id = ANY(p_event_ids) AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path='';

GRANT EXECUTE ON FUNCTION public.mark_xp_events_shown(UUID[], UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_xp_events_shown(UUID[], UUID) TO service_role;

COMMIT;
