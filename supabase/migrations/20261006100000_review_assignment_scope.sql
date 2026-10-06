-- Organization-wide reviews may have no class/program; the pair remains nullable together.
DO $$ DECLARE c record; BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='public.review_assignments'::regclass
 AND pg_get_constraintdef(oid) LIKE '%scope_id IS NOT NULL%' AND pg_get_constraintdef(oid) LIKE '%due_by IS NOT NULL%' LOOP
  EXECUTE format('ALTER TABLE public.review_assignments DROP CONSTRAINT %I',c.conname);
 END LOOP;
END $$;
ALTER TABLE public.review_assignments ADD CONSTRAINT review_assignment_deadline_required
 CHECK(status='unassigned' OR due_by IS NOT NULL);
-- The service resolves the destination from the signed learner scope authority.
-- Browser callers cannot choose a destination or invoke this recovery transaction.
CREATE OR REPLACE FUNCTION public.reconcile_artifact_review_scope(
 p_review_id uuid,p_learner_id uuid,p_version integer,p_scope_id uuid,p_scope_type text
) RETURNS public.review_assignments LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE r public.review_assignments; previous_scope uuid; previous_type text; previous_reviewer uuid;
BEGIN
 IF (p_scope_id IS NULL) <> (p_scope_type IS NULL) OR p_scope_type NOT IN ('college_program','school_class') THEN
  RAISE EXCEPTION 'INVALID_REVIEW_COMMAND';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('review-assignment-selection',0));
 SELECT * INTO r FROM public.review_assignments WHERE id=p_review_id FOR UPDATE;
 IF NOT FOUND OR r.learner_id IS DISTINCT FROM p_learner_id THEN RAISE EXCEPTION 'REVIEW_NOT_FOUND'; END IF;
 IF r.version IS DISTINCT FROM p_version OR r.status NOT IN ('unassigned','pending','in_progress') THEN RAISE EXCEPTION 'REVIEW_CONFLICT'; END IF;
 IF r.scope_id IS NOT DISTINCT FROM p_scope_id AND r.scope_type IS NOT DISTINCT FROM p_scope_type THEN RETURN r; END IF;
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


-- Scope recovery and assignment commit together, with the original version checked under lock.
CREATE FUNCTION public.assign_review_in_scope(p_review_id uuid,p_actor_id uuid,p_reviewer_id uuid,
 p_version integer,p_reason text,p_expected_scope_id uuid,p_expected_scope_type text,
 p_scope_id uuid,p_scope_type text,p_load_cap integer,p_sla_days integer,p_timezone text)
RETURNS public.review_assignments LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE r public.review_assignments;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('review-assignment-selection',0));
 SELECT * INTO r FROM public.review_assignments WHERE id=p_review_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'REVIEW_NOT_FOUND'; END IF;
 IF r.version IS DISTINCT FROM p_version OR r.status NOT IN ('unassigned','pending','in_progress')
 OR r.scope_id IS DISTINCT FROM p_expected_scope_id OR r.scope_type IS DISTINCT FROM p_expected_scope_type THEN
  RAISE EXCEPTION 'REVIEW_CONFLICT';
 END IF;
 IF r.scope_id IS DISTINCT FROM p_scope_id OR r.scope_type IS DISTINCT FROM p_scope_type THEN
  r:=public.reconcile_artifact_review_scope(r.id,r.learner_id,r.version,p_scope_id,p_scope_type);
 END IF;
 RETURN public.reassign_artifact_review(r.id,p_actor_id,p_reviewer_id,r.version,p_reason,p_scope_id,p_scope_type,p_load_cap,p_sla_days,p_timezone);
END $$;
REVOKE ALL ON FUNCTION public.assign_review_in_scope(uuid,uuid,uuid,integer,text,uuid,text,uuid,text,integer,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.assign_review_in_scope(uuid,uuid,uuid,integer,text,uuid,text,uuid,text,integer,integer,text) TO service_role;
