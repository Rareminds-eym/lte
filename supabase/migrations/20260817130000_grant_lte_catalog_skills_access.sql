-- Grant SELECT on the skill catalog tables to the service role so the
-- SkillPassport skill sync (`skills:get`) can read the earned skills.
-- These tables were created in lte_learning_catalog but never granted to
-- service_role, causing "permission denied for table level_skills".
GRANT SELECT ON public.skills TO service_role;
GRANT SELECT ON public.level_skills TO service_role;
