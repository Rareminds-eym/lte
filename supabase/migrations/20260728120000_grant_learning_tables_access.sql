-- ============================================================================
-- Migration: Grant learning tables access
-- Database: PostgreSQL / Supabase
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.learning_tracks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.learning_paths TO service_role;

GRANT SELECT ON TABLE public.user_profiles TO authenticated;
GRANT SELECT ON TABLE public.learning_tracks TO authenticated;
GRANT SELECT ON TABLE public.learning_paths TO authenticated;
