-- Durable R2 cleanup. Database transactions record intent; R2 I/O runs outside locks.
BEGIN;

-- Path deletion cascades through progress while both provenance FKs are
-- cleared. Validate after the cascade, not between its individual triggers.
ALTER TABLE public.certificates ALTER CONSTRAINT certificates_learning_path_id_fkey DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public.certificates ALTER CONSTRAINT certificates_level_progress_id_fkey DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE public.certificate_storage_cleanup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  certificate_id uuid,
  object_key text,
  prefix text,
  available_at timestamptz NOT NULL DEFAULT now() + interval '2 minutes',
  lease_token uuid,
  lease_until timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  CHECK ((object_key IS NULL) <> (prefix IS NULL)),
  CHECK (coalesce(object_key, prefix) LIKE 'certificates/users/' || user_id::text || '/%')
);
CREATE INDEX certificate_storage_cleanup_due ON public.certificate_storage_cleanup(available_at, id);
ALTER TABLE public.certificate_storage_cleanup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.certificate_storage_cleanup FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.register_certificate_pdf_upload(p_certificate_id uuid, p_object_key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE saved public.certificates;
BEGIN
  SELECT * INTO saved FROM public.certificates WHERE id = p_certificate_id FOR UPDATE;
  IF NOT FOUND OR saved.status <> 'issued' THEN
    RAISE EXCEPTION 'CERTIFICATE_NOT_ISSUED' USING ERRCODE = '22023';
  END IF;
  IF p_object_key IS NULL OR p_object_key !~ (
    '^certificates/users/' || saved.user_id::text || '/' || saved.credential_id || '/[a-f0-9]{32}-certificate\.pdf$'
  ) THEN RAISE EXCEPTION 'INVALID_CERTIFICATE_OBJECT_KEY' USING ERRCODE = '22023'; END IF;
  -- Written before R2 put: even an isolate termination leaves a cleanup intent.
  INSERT INTO public.certificate_storage_cleanup(user_id, certificate_id, object_key)
  VALUES(saved.user_id, saved.id, p_object_key);
END;
$$;

CREATE FUNCTION public.queue_certificate_storage_cleanup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.certificate_storage_cleanup(user_id, certificate_id, prefix)
    VALUES(OLD.user_id, OLD.id, 'certificates/users/' || OLD.user_id::text || '/' || OLD.credential_id || '/');
    RETURN OLD;
  END IF;
  IF OLD.pdf_object_key IS NOT NULL AND OLD.pdf_object_key IS DISTINCT FROM NEW.pdf_object_key THEN
    INSERT INTO public.certificate_storage_cleanup(user_id, certificate_id, object_key)
    VALUES(OLD.user_id, OLD.id, OLD.pdf_object_key);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER certificates_queue_storage_cleanup AFTER DELETE OR UPDATE OF pdf_object_key
ON public.certificates FOR EACH ROW EXECUTE FUNCTION public.queue_certificate_storage_cleanup();

CREATE FUNCTION public.queue_erased_learner_certificate_storage()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO public.certificate_storage_cleanup(user_id, prefix)
  VALUES(OLD.id, 'certificates/users/' || OLD.id::text || '/');
  RETURN OLD;
END;
$$;
CREATE TRIGGER users_queue_certificate_storage_cleanup BEFORE DELETE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.queue_erased_learner_certificate_storage();

CREATE FUNCTION public.claim_certificate_storage_cleanup(p_lease_token uuid, p_limit integer DEFAULT 10)
RETURNS SETOF public.certificate_storage_cleanup
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF p_lease_token IS NULL OR p_limit NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'INVALID_CLEANUP_CLAIM' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  WITH due AS (
    SELECT id FROM public.certificate_storage_cleanup
    WHERE available_at <= now() AND (lease_until IS NULL OR lease_until <= now())
    ORDER BY available_at, id LIMIT p_limit FOR UPDATE SKIP LOCKED
  ) UPDATE public.certificate_storage_cleanup AS job
    SET lease_token = p_lease_token, lease_until = now() + interval '2 minutes', attempts = attempts + 1
    FROM due WHERE job.id = due.id RETURNING job.*;
END;
$$;

CREATE FUNCTION public.finish_certificate_storage_cleanup(p_id uuid, p_lease_token uuid, p_success boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF p_success THEN
    DELETE FROM public.certificate_storage_cleanup WHERE id = p_id AND lease_token = p_lease_token;
  ELSE
    UPDATE public.certificate_storage_cleanup
    SET lease_token = NULL, lease_until = NULL,
      available_at = now() + make_interval(secs => least(3600, 30 * power(2, least(attempts, 7)))::integer)
    WHERE id = p_id AND lease_token = p_lease_token;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.register_certificate_pdf_upload(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.queue_certificate_storage_cleanup() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.queue_erased_learner_certificate_storage() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_certificate_storage_cleanup(uuid,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_certificate_storage_cleanup(uuid,uuid,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_certificate_pdf_upload(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_certificate_storage_cleanup(uuid,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_certificate_storage_cleanup(uuid,uuid,boolean) TO service_role;
COMMIT;
