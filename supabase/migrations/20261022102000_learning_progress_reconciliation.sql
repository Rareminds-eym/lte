-- Ongoing delivery state belongs to the revision aggregate. No historical scan,
-- marker copying, or startup replay. Old marker tables, if present, are untouched.
BEGIN;
ALTER TABLE public.learning_progress_revisions ADD COLUMN reconciled_at timestamptz,
 ADD COLUMN reconciled_revision bigint CHECK(reconciled_revision>=0);
DROP FUNCTION IF EXISTS public.reconcile_learning_progress();
CREATE OR REPLACE FUNCTION public.ack_learning_progress_delivery(p_user uuid,p_level uuid,p_revision bigint) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 -- Source updates lock the aggregate before the delivery row; keep that order.
 PERFORM 1 FROM public.learning_progress_revisions WHERE user_id=p_user FOR UPDATE;
 DELETE FROM public.learning_progress_delivery WHERE user_id=p_user AND level_id=p_level AND revision<=p_revision;
 UPDATE public.learning_progress_revisions r SET reconciled_at=now(),reconciled_revision=p_revision
 WHERE user_id=p_user AND revision=p_revision AND NOT EXISTS(SELECT 1 FROM public.learning_progress_delivery d WHERE d.user_id=p_user);
END $$;
REVOKE ALL ON FUNCTION public.ack_learning_progress_delivery(uuid,uuid,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ack_learning_progress_delivery(uuid,uuid,bigint) TO service_role;
COMMIT;
