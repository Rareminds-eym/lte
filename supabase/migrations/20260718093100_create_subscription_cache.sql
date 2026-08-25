CREATE TABLE IF NOT EXISTS public.subscription_cache (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id uuid,
  plan_id uuid,
  plan_code text,
  plan_name text,
  plan_type text,
  plan_amount numeric,
  billing_cycle text,
  status text NOT NULL,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  product_code text NOT NULL DEFAULT 'lte',
  product_id uuid,
  subscription_start_date timestamptz,
  subscription_end_date timestamptz,
  synced_at timestamptz NOT NULL DEFAULT now(),
  auth_updated_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_subscription_cache_user
  ON public.subscription_cache (user_id);

CREATE INDEX IF NOT EXISTS idx_subscription_cache_status
  ON public.subscription_cache (status);

CREATE INDEX IF NOT EXISTS idx_subscription_cache_product_code
  ON public.subscription_cache (product_code);

COMMENT ON TABLE public.subscription_cache IS
  'Read-only local shadow of SSO subscription/product entitlement for LTE feature access.';

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.subscription_cache TO service_role;
GRANT SELECT ON TABLE public.subscription_cache TO authenticated;
