-- ============================================================================
-- Migration: Create LTE users mirror
--
-- public.users stores the minimal user identity required by LTE. The id is
-- supplied by SSO and must match the corresponding SSO user id.
--
-- This migration intentionally creates no roles, RLS policies, or secondary
-- indexes. The primary-key and email-unique constraints create the only user
-- indexes required by this table.
-- ============================================================================

BEGIN;

CREATE TYPE public.lte_user_status AS ENUM (
  'active',
  'inactive',
  'suspended',
  'deleted'
);

CREATE TABLE public."users" (
  "id" uuid NOT NULL,
  "email" text NOT NULL,
  "first_name" varchar(255),
  "last_name" varchar(255),
  "phone" varchar(50),
  "status" public.lte_user_status DEFAULT 'active' NOT NULL,
  "deleted_at" timestamptz,
  "last_activity_at" timestamptz,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "pk_users" PRIMARY KEY ("id"),
  CONSTRAINT "uq_users_email" UNIQUE ("email")
);

COMMENT ON TABLE public."users" IS
  'Minimal LTE user mirror. id matches the user id issued by SSO.';

CREATE TRIGGER set_users_timestamps
  BEFORE INSERT OR UPDATE ON public."users"
  FOR EACH ROW EXECUTE FUNCTION public.set_lte_timestamps();

COMMIT;
