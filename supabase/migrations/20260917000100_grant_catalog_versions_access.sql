-- Catalog upload/versioning is managed by trusted server-side routes.
-- Do not grant direct authenticated writes unless RLS policies are added.

GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.catalog_versions
  TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.roles
  TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.capabilities
  TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.level_scale
  TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.role_capability_sequence
  TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.skills
  TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.levels
  TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.level_skills
  TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.modules
  TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.modules_content
  TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.e_content
  TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.module_artifacts
  TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.artifact_questions
  TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.artifact_templates
  TO service_role;
