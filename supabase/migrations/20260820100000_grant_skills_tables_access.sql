-- Grant server-side (service_role) read access to the skill catalog so the
-- queue-sync producer can attach real earned skills (level_skills -> skills)
-- to lte.module_completed / lte.level_completed messages.
GRANT SELECT ON TABLE public.skills TO service_role;
GRANT SELECT ON TABLE public.level_skills TO service_role;
