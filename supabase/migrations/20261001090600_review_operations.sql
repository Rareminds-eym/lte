-- Scope authority is resolved from current school/college administrator membership
-- by the service before this service-only transaction. Recheck scope and version under lock.
CREATE FUNCTION public.reassign_artifact_review(p_review_id uuid,p_actor_id uuid,p_reviewer_id uuid,p_version integer,p_reason text,p_scope_id uuid,p_scope_type text,p_load_cap integer,p_sla_days integer,p_timezone text)
RETURNS public.review_assignments LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE r public.review_assignments; previous uuid; event_id uuid;
BEGIN
 IF length(trim(coalesce(p_reason,''))) NOT BETWEEN 1 AND 2000 OR p_load_cap IS NULL OR p_load_cap NOT BETWEEN 1 AND 100 THEN
  RAISE EXCEPTION 'INVALID_REVIEW_COMMAND';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('review-assignment-selection',0));
 SELECT * INTO r FROM public.review_assignments WHERE id=p_review_id FOR UPDATE;
 IF NOT FOUND OR r.scope_id IS DISTINCT FROM p_scope_id OR r.scope_type IS DISTINCT FROM p_scope_type THEN
  RAISE EXCEPTION 'REVIEW_NOT_FOUND';
 END IF;
 IF r.status NOT IN ('unassigned','pending','in_progress') OR r.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'REVIEW_CONFLICT'; END IF;
 IF p_reviewer_id IS NULL OR p_reviewer_id=r.learner_id OR p_reviewer_id=r.reviewer_id THEN RAISE EXCEPTION 'INVALID_REVIEW_COMMAND'; END IF;
 IF (SELECT count(*) FROM public.review_assignments WHERE reviewer_id=p_reviewer_id AND status IN ('pending','in_progress'))>=p_load_cap THEN RAISE EXCEPTION 'REVIEW_CONFLICT'; END IF;
 previous := r.reviewer_id;
 UPDATE public.review_assignments SET reviewer_id=p_reviewer_id,status='pending',version=version+1,assigned_at=now(),started_at=NULL,
 due_by=public.review_business_deadline(p_sla_days,p_timezone) WHERE id=r.id RETURNING * INTO r;
 INSERT INTO public.review_audit(review_id,actor_id,action,detail) VALUES(r.id,p_actor_id,'reassigned',jsonb_build_object('previousReviewerId',previous,'reviewerId',p_reviewer_id,'reason',p_reason,'version',r.version));
 event_id := gen_random_uuid();
 INSERT INTO public.review_outbox(id,review_id,event_type,assignment_version,payload) VALUES(event_id,r.id,'lte.review_assigned',r.version,
 jsonb_build_object('schemaVersion',1,'eventId',event_id,'occurredAt',now(),'reviewId',r.id,'submissionId',r.submission_id,
 'assignmentVersion',r.version,'learnerId',r.learner_id,'reviewerId',r.reviewer_id,'scopeId',r.scope_id,'scopeType',r.scope_type,'dueBy',r.due_by));
 RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.reassign_artifact_review(uuid,uuid,uuid,integer,text,uuid,text,integer,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reassign_artifact_review(uuid,uuid,uuid,integer,text,uuid,text,integer,integer,text) TO service_role;
