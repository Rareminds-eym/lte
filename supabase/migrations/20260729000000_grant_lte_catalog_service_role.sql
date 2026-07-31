GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT ON TABLE public.modules TO service_role;
GRANT SELECT ON TABLE public.modules_content TO service_role;
GRANT SELECT ON TABLE public.e_content TO service_role;
GRANT SELECT ON TABLE public.module_artifacts TO service_role;
GRANT SELECT ON TABLE public.artifact_questions TO service_role;
GRANT SELECT ON TABLE public.artifact_templates TO service_role;
