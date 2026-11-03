-- The service resolves the destination from the signed learner scope authority.
-- Browser callers cannot choose a destination or invoke this recovery transaction.
CREATE FUNCTION public.reconcile_artifact_review_scope(
 p_review_id uuid,p_learner_id uuid,p_version integer,p_scope_id uuid,p_scope_type text
) RETURNS public.review_assignments LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE r public.review_assignments; previous_scope uuid; previous_type text; previous_reviewer uuid;
BEGIN
 IF p_scope_id IS NULL OR p_scope_type IS NULL OR p_scope_type NOT IN ('college_program','school_class') THEN
  RAISE EXCEPTION 'INVALID_REVIEW_COMMAND';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('review-assignment-selection',0));
 SELECT * INTO r FROM public.review_assignments WHERE id=p_review_id FOR UPDATE;
 IF NOT FOUND OR r.learner_id IS DISTINCT FROM p_learner_id THEN RAISE EXCEPTION 'REVIEW_NOT_FOUND'; END IF;
 IF r.version IS DISTINCT FROM p_version OR r.status NOT IN ('unassigned','pending','in_progress') THEN RAISE EXCEPTION 'REVIEW_CONFLICT'; END IF;
 IF r.scope_id=p_scope_id AND r.scope_type=p_scope_type THEN RETURN r; END IF;
 previous_scope:=r.scope_id; previous_type:=r.scope_type; previous_reviewer:=r.reviewer_id;
 UPDATE public.review_assignments SET scope_id=p_scope_id,scope_type=p_scope_type,reviewer_id=NULL,
 status='unassigned',version=version+1,assigned_at=NULL,started_at=NULL,due_by=NULL,next_check_at=now()
 WHERE id=r.id RETURNING * INTO r;
 INSERT INTO public.review_audit(review_id,action,detail) VALUES(r.id,'scope_reconciled',jsonb_build_object(
 'authority','skillpassport_learner_scope','previousScopeId',previous_scope,'previousScopeType',previous_type,
 'scopeId',r.scope_id,'scopeType',r.scope_type,'previousReviewerId',previous_reviewer,'version',r.version));
 UPDATE public.review_outbox SET cancelled_at=now() WHERE review_id=r.id AND delivered_at IS NULL AND cancelled_at IS NULL
 AND event_type IN ('lte.review_assigned','lte.review_due_soon','lte.review_overdue');
 RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.reconcile_artifact_review_scope(uuid,uuid,integer,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_artifact_review_scope(uuid,uuid,integer,uuid,text) TO service_role;

CREATE INDEX review_scope_check_idx ON public.review_assignments(next_check_at,id) WHERE status IN ('pending','in_progress');
CREATE FUNCTION public.claim_review_scope_checks(p_limit integer DEFAULT 25) RETURNS SETOF public.review_assignments
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 RETURN QUERY UPDATE public.review_assignments SET next_check_at=now()+interval '15 minutes'
 WHERE id IN (SELECT id FROM public.review_assignments WHERE status IN ('unassigned','pending','in_progress') AND next_check_at<=now()
 ORDER BY next_check_at,id LIMIT least(greatest(p_limit,1),100) FOR UPDATE SKIP LOCKED) RETURNING *;
END $$;
REVOKE ALL ON FUNCTION public.claim_review_scope_checks(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_review_scope_checks(integer) TO service_role;
