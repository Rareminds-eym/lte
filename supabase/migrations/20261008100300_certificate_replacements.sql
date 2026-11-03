-- Explicit ops replacements retain revoked credentials and their original snapshots.
BEGIN;
ALTER TABLE public.certificates ADD COLUMN supersedes_id uuid
  REFERENCES public.certificates(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX uq_certificates_supersedes ON public.certificates(supersedes_id)
  WHERE supersedes_id IS NOT NULL;
DROP INDEX public.uq_certificates_user_level;
DROP INDEX public.uq_certificates_user_role;
CREATE UNIQUE INDEX uq_certificates_user_level ON public.certificates(user_id, level_id)
  WHERE certificate_type = 'course_completion' AND status <> 'revoked';
CREATE UNIQUE INDEX uq_certificates_user_role ON public.certificates(user_id, role_id)
  WHERE certificate_type = 'role_readiness' AND status <> 'revoked';

CREATE FUNCTION public.certificates_validate_replacement() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE previous public.certificates;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.supersedes_id IS DISTINCT FROM OLD.supersedes_id THEN
      RAISE EXCEPTION 'certificate replacement lineage is immutable' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.supersedes_id IS NOT NULL THEN
    SELECT * INTO previous FROM public.certificates WHERE id = NEW.supersedes_id FOR UPDATE;
    IF NOT FOUND OR previous.status <> 'revoked'
       OR previous.user_id <> NEW.user_id OR previous.certificate_type <> NEW.certificate_type
       OR previous.level_id IS DISTINCT FROM NEW.level_id
       OR previous.role_id IS DISTINCT FROM NEW.role_id THEN
      RAISE EXCEPTION 'replacement requires a revoked certificate for the same learner and subject' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_certificates_validate_replacement BEFORE INSERT OR UPDATE ON public.certificates
FOR EACH ROW EXECUTE FUNCTION public.certificates_validate_replacement();

CREATE FUNCTION public.replace_certificate(
  p_certificate_id uuid, p_actor_id uuid, p_reason text,
  p_credential_id text, p_corrections jsonb DEFAULT '{}'::jsonb
) RETURNS public.certificates LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE original public.certificates; replacement public.certificates;
BEGIN
  IF p_actor_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_actor_id)
    OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 4000 THEN
    RAISE EXCEPTION 'replacement requires an actor and reason' USING ERRCODE = '22023';
  END IF;
  IF p_corrections IS NULL OR jsonb_typeof(p_corrections) <> 'object'
    OR p_corrections - ARRAY['learner_name','title','subtitle','level_label','badge','completion_date','metadata'] <> '{}'::jsonb THEN
    RAISE EXCEPTION 'unsupported certificate correction fields' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO original FROM public.certificates WHERE id = p_certificate_id FOR UPDATE;
  IF NOT FOUND OR original.status = 'pending_name' THEN
    RAISE EXCEPTION 'only issued or revoked certificates can be replaced' USING ERRCODE = '22023';
  END IF;
  -- Serialize callers on the original row, and return the winner on repeated calls.
  SELECT * INTO replacement FROM public.certificates WHERE supersedes_id = original.id;
  IF FOUND THEN RETURN replacement; END IF;
  IF original.status = 'issued' THEN
    UPDATE public.certificates SET status = 'revoked', revoked_at = now(),
      revoked_reason = p_reason, revoked_by = p_actor_id WHERE id = original.id;
  END IF;
  replacement := jsonb_populate_record(original, p_corrections);
  INSERT INTO public.certificates(credential_id,user_id,certificate_type,status,level_id,role_id,
    learning_path_id,level_progress_id,learner_name,title,subtitle,level_label,badge,completion_date,
    metadata,issued_at,supersedes_id)
  VALUES(p_credential_id,original.user_id,original.certificate_type,'issued',original.level_id,original.role_id,
    original.learning_path_id,original.level_progress_id,replacement.learner_name,replacement.title,
    replacement.subtitle,replacement.level_label,replacement.badge,replacement.completion_date,
    replacement.metadata,now(),original.id) RETURNING * INTO replacement;
  RETURN replacement;
END; $$;
REVOKE ALL ON FUNCTION public.certificates_validate_replacement() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.replace_certificate(uuid,uuid,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_certificate(uuid,uuid,text,text,jsonb) TO service_role;
COMMENT ON COLUMN public.certificates.supersedes_id IS 'Immutable ops replacement lineage; old credentials remain revoked. Replacements do not award additional XP.';
COMMIT;
