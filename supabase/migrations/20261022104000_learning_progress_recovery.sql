BEGIN;
ALTER TABLE public.learning_progress_delivery ADD COLUMN attempts integer NOT NULL DEFAULT 0,
 ADD COLUMN next_attempt_at timestamptz NOT NULL DEFAULT now(),ADD COLUMN lease_token uuid,ADD COLUMN lease_until timestamptz,
 ADD COLUMN quarantined_at timestamptz,ADD COLUMN last_error text;
CREATE INDEX learning_progress_due ON public.learning_progress_delivery(next_attempt_at,updated_at) WHERE quarantined_at IS NULL;
CREATE INDEX learning_progress_level ON public.learning_progress_delivery(level_id);
CREATE FUNCTION public.claim_learning_progress_delivery() RETURNS SETOF public.learning_progress_delivery
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 WITH due AS (SELECT user_id,level_id FROM public.learning_progress_delivery WHERE quarantined_at IS NULL AND next_attempt_at<=now()
  AND (lease_until IS NULL OR lease_until<now()) ORDER BY next_attempt_at,updated_at,user_id,level_id LIMIT 25 FOR UPDATE SKIP LOCKED)
 UPDATE public.learning_progress_delivery d SET attempts=d.attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes'
 FROM due WHERE d.user_id=due.user_id AND d.level_id=due.level_id RETURNING d.*;
$$;
CREATE FUNCTION public.finish_learning_progress_delivery(p_user uuid,p_level uuid,p_token uuid,p_success boolean) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 UPDATE public.learning_progress_delivery SET lease_token=NULL,lease_until=NULL,
 next_attempt_at=now()+CASE WHEN p_success THEN interval '0 seconds' ELSE least(60,power(2,least(attempts,6))) * interval '1 minute' END,
 quarantined_at=CASE WHEN NOT p_success AND attempts>=8 THEN now() ELSE NULL END,
 last_error=CASE WHEN p_success THEN NULL ELSE 'Progress delivery failed; retry scheduled or quarantined after eight attempts.' END
 WHERE user_id=p_user AND level_id=p_level AND lease_token=p_token;
$$;
CREATE FUNCTION public.replay_learning_progress_delivery(p_user uuid,p_level uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 UPDATE public.learning_progress_delivery SET attempts=0,next_attempt_at=now(),quarantined_at=NULL,lease_until=NULL,lease_token=NULL,last_error=NULL
 WHERE user_id=p_user AND level_id=p_level;
$$;
CREATE OR REPLACE FUNCTION public.bump_learning_progress_revision() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE subject uuid; target_level uuid; next_revision bigint;
BEGIN
 subject:=CASE WHEN TG_OP='DELETE' THEN OLD.user_id ELSE NEW.user_id END;
 IF EXISTS(SELECT 1 FROM public.users WHERE id=subject) THEN
  INSERT INTO public.learning_progress_revisions(user_id) VALUES(subject)
   ON CONFLICT(user_id) DO UPDATE SET revision=learning_progress_revisions.revision+1 RETURNING revision INTO next_revision;
  IF TG_TABLE_NAME='user_capability_level_progress' THEN
   target_level:=CASE WHEN TG_OP='DELETE' THEN OLD.level_id ELSE NEW.level_id END;
  ELSE
   SELECT level_id INTO target_level FROM public.user_capability_level_progress WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.user_capability_level_progress_id ELSE NEW.user_capability_level_progress_id END;
  END IF;
  IF target_level IS NOT NULL THEN
   INSERT INTO public.learning_progress_delivery(user_id,level_id,revision) VALUES(subject,target_level,next_revision)
    ON CONFLICT(user_id,level_id) DO UPDATE SET revision=excluded.revision,updated_at=now(),attempts=0,next_attempt_at=now(),quarantined_at=NULL;
  END IF;
 END IF;
 RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public.claim_learning_progress_delivery(),public.finish_learning_progress_delivery(uuid,uuid,uuid,boolean),public.replay_learning_progress_delivery(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_learning_progress_delivery(),public.finish_learning_progress_delivery(uuid,uuid,uuid,boolean),public.replay_learning_progress_delivery(uuid,uuid) TO service_role;
COMMIT;
