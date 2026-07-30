GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_capabilities TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_capability_level_progress TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_capabilities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_capability_level_progress TO authenticated;

