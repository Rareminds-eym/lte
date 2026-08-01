-- Migration: Grant progress and related tables permissions
-- Date: 2026-07-31

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_module_progress TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_module_progress TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_stage_progress TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_stage_progress TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.artifact_submissions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.artifact_submissions TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.skill_gap TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.skill_gap TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profile_snapshot TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profile_snapshot TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.learning_track_evidence TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.learning_track_evidence TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.artifact_evaluation_flows TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.artifact_evaluation_flows TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.artifact_submission_files TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.artifact_submission_files TO authenticated;
