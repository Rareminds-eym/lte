-- Migration: revert mark_xp_events_shown to gateway guard (SSO-only, no auth.uid)
-- Replaces 20260901000003 broken auth.uid() guard (always NULL via service_role) with service_role + gateway injection
-- Keep SECURITY DEFINER SET search_path='', revoke authenticated (gateway-only)
BEGIN;

CREATE OR REPLACE FUNCTION public.mark_xp_events_shown(p_event_ids UUID[], p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
  IF p_user_id IS NULL OR array_length(p_event_ids, 1) IS NULL THEN
    RETURN;
  END IF;
  UPDATE public.xp_events
  SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{modal_shown}', 'true'::jsonb),
      updated_at = now()
  WHERE id = ANY(p_event_ids) AND user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_xp_events_shown(UUID[], UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_xp_events_shown(UUID[], UUID) TO service_role;

COMMIT;
