-- Migration: Add mark_xp_events_shown  function
BEGIN;

CREATE OR REPLACE FUNCTION public.mark_xp_events_shown(p_event_ids UUID[], p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.xp_events
  SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{modal_shown}', 'true'::jsonb)
  WHERE id = ANY(p_event_ids) AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.mark_xp_events_shown(UUID[], UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_xp_events_shown(UUID[], UUID) TO service_role;

COMMIT;
