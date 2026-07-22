GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.users TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.subscription_cache TO service_role;

GRANT SELECT ON TABLE public.users TO authenticated;
GRANT SELECT ON TABLE public.subscription_cache TO authenticated;
