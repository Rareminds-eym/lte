GRANT SELECT ON public.roles TO service_role;
GRANT SELECT ON public.capabilities TO service_role;
GRANT SELECT ON public.role_capability_sequence TO service_role;

GRANT SELECT ON public.roles TO authenticated;
GRANT SELECT ON public.capabilities TO authenticated;
GRANT SELECT ON public.role_capability_sequence TO authenticated;
