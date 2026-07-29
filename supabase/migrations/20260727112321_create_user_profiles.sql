-- ============================================================================
-- Migration: Create user_profiles
-- Database: PostgreSQL / Supabase
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. USER PROFILES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id uuid NOT NULL UNIQUE,

    is_active boolean NOT NULL DEFAULT true,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_user_profiles_user
        FOREIGN KEY (user_id)
        REFERENCES public.users(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_user_id
    ON public.user_profiles (user_id);

CREATE INDEX IF NOT EXISTS idx_user_profiles_is_active
    ON public.user_profiles (is_active);


-- ============================================================================
-- UPDATED_AT FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS trg_user_profiles_set_updated_at
    ON public.user_profiles;

CREATE TRIGGER trg_user_profiles_set_updated_at
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();


-- ============================================================================
-- USER PROFILE PROVISIONING TRIGGER
-- Automatically creates one user_profiles record for every new public.users row
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.user_profiles (
        user_id,
        is_active
    )
    VALUES (
        NEW.id,
        true
    )
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$;


-- Remove the old trigger if it already exists
DROP TRIGGER IF EXISTS trg_create_user_profile
ON public.users;


-- Create the actual trigger
CREATE TRIGGER trg_create_user_profile
AFTER INSERT ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_profile();


-- ============================================================================
-- TABLE COMMENTS
-- ============================================================================

COMMENT ON TABLE public.user_profiles IS
    'Main user profile information table linked one-to-one with users.';

COMMENT ON COLUMN public.user_profiles.user_id IS
    'User identifier from the users table. Only one profile is allowed per user.';

COMMIT;
