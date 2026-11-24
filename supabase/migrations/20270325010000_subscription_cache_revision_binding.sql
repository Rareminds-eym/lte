BEGIN;

ALTER TABLE public.subscription_cache
  ADD COLUMN plan_revision_id uuid,
  ADD COLUMN lifecycle_state jsonb,
  ADD COLUMN lifecycle_policy jsonb,
  ADD COLUMN lifecycle_activated_at timestamptz,
  ADD CONSTRAINT subscription_cache_revision_binding CHECK (
    (plan_revision_id IS NULL AND lifecycle_state IS NULL AND lifecycle_policy IS NULL AND lifecycle_activated_at IS NULL)
    OR (plan_revision_id IS NOT NULL AND lifecycle_state IS NOT NULL AND lifecycle_policy IS NOT NULL AND lifecycle_activated_at IS NOT NULL
      AND jsonb_typeof(lifecycle_state) = 'object' AND jsonb_typeof(lifecycle_policy) = 'object'
      AND (lifecycle_state->>'id' = id::text) IS TRUE
      AND (lifecycle_state->>'planId' = plan_id::text) IS TRUE
      AND (lifecycle_state->>'revisionId' = plan_revision_id::text) IS TRUE
      AND (lifecycle_state->>'productId' = product_id::text) IS TRUE
      AND (lifecycle_state->>'status' = status) IS TRUE)
  );

COMMENT ON COLUMN public.subscription_cache.plan_revision_id IS
  'Exact SSO-owned revision binding for projections. Cache state never authorizes access without current owner verification.';

CREATE FUNCTION public.guard_subscription_cache_snapshot_order()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF OLD.auth_updated_at IS NOT NULL AND (NEW.auth_updated_at IS NULL OR NEW.auth_updated_at < OLD.auth_updated_at) THEN RETURN NULL; END IF;
  IF OLD.plan_revision_id IS NOT NULL AND NEW.plan_revision_id IS NULL THEN RETURN NULL; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_subscription_cache_snapshot_order() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_subscription_cache_snapshot_order BEFORE UPDATE ON public.subscription_cache
  FOR EACH ROW EXECUTE FUNCTION public.guard_subscription_cache_snapshot_order();

COMMIT;
