ALTER TABLE public.review_assignments ADD COLUMN next_check_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX review_reconciliation_idx ON public.review_assignments(next_check_at,id) WHERE status='unassigned';
CREATE FUNCTION public.claim_review_reconciliation(p_limit integer DEFAULT 25) RETURNS SETOF public.review_assignments
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 INSERT INTO public.review_assignments(submission_id,learner_id,rubric_id,rubric_snapshot,reason)
 SELECT s.id,s.user_id,t.id,jsonb_build_object('version',t.version,'criteria',t.criteria),'reconciliation'
 FROM public.artifact_submissions s CROSS JOIN public.review_rubric_templates t
 WHERE s.status='human_review' AND s.is_latest AND t.id='61000000-0000-4000-8000-000000000001'
 ON CONFLICT(submission_id,stage) DO NOTHING;
 RETURN QUERY UPDATE public.review_assignments SET next_check_at=now()+interval '15 minutes'
 WHERE id IN (SELECT id FROM public.review_assignments WHERE status='unassigned' AND next_check_at<=now()
 ORDER BY next_check_at,id LIMIT least(greatest(p_limit,1),100) FOR UPDATE SKIP LOCKED) RETURNING *;
END $$;
REVOKE ALL ON FUNCTION public.claim_review_reconciliation(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_review_reconciliation(integer) TO service_role;
