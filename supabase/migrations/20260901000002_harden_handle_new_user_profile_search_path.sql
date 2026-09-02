-- Migration: harden handle_new_user_profile search_path (legacy sibling of 20260812093636)
-- Fix search_path=public -> '' for SECURITY DEFINER
BEGIN;
SET search_path = '';
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, created_at, updated_at)
  VALUES (NEW.id, NOW(), NOW())
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
COMMIT;
