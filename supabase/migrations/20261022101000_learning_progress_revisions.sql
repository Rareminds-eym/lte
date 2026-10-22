BEGIN;
CREATE TABLE public.learning_progress_revisions(user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,revision bigint NOT NULL DEFAULT 1);
ALTER TABLE public.learning_progress_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.learning_progress_revisions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.learning_progress_revisions TO service_role;
CREATE TABLE public.learning_progress_delivery(user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 level_id uuid NOT NULL REFERENCES public.levels(id) ON DELETE CASCADE,revision bigint NOT NULL,updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(user_id,level_id));
ALTER TABLE public.learning_progress_delivery ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.learning_progress_delivery FROM PUBLIC,anon,authenticated;
GRANT SELECT,DELETE ON public.learning_progress_delivery TO service_role;
CREATE FUNCTION public.bump_learning_progress_revision() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
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
    ON CONFLICT(user_id,level_id) DO UPDATE SET revision=excluded.revision,updated_at=now();
  END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER level_learning_revision AFTER INSERT OR UPDATE OR DELETE ON public.user_capability_level_progress FOR EACH ROW EXECUTE FUNCTION public.bump_learning_progress_revision();
CREATE TRIGGER module_learning_revision AFTER INSERT OR UPDATE OR DELETE ON public.user_module_progress FOR EACH ROW EXECUTE FUNCTION public.bump_learning_progress_revision();
REVOKE ALL ON FUNCTION public.bump_learning_progress_revision() FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.ack_learning_progress_delivery(p_user uuid,p_level uuid,p_revision bigint) RETURNS void
 LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 DELETE FROM public.learning_progress_delivery WHERE user_id=p_user AND level_id=p_level AND revision<=p_revision;
$$;
REVOKE ALL ON FUNCTION public.ack_learning_progress_delivery(uuid,uuid,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ack_learning_progress_delivery(uuid,uuid,bigint) TO service_role;
COMMIT;
