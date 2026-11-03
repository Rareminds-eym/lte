BEGIN;

REVOKE ALL ON TABLE public.certificates FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.certificates TO service_role;
-- No DELETE grant: certificates are revoked, never deleted (except via user CASCADE).

REVOKE ALL ON FUNCTION public.certificates_enforce_immutability() FROM PUBLIC, anon, authenticated;

COMMIT;
