ALTER TABLE public.review_outbox ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE public.review_outbox DROP CONSTRAINT review_outbox_event_type_check;
ALTER TABLE public.review_outbox ADD CONSTRAINT review_outbox_event_type_check CHECK(event_type IN (
 'lte.review_assigned','lte.review_completed','lte.artifact_reviewed_pass','lte.review_due_soon','lte.review_overdue'
));

CREATE OR REPLACE FUNCTION public.schedule_review_deadlines(p_limit integer DEFAULT 100) RETURNS integer
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE r public.review_assignments; kind text; event_id uuid; inserted integer := 0; affected integer;
BEGIN
 FOR r IN SELECT * FROM public.review_assignments WHERE status IN ('pending','in_progress') AND due_by<=now()+interval '24 hours'
 AND NOT EXISTS(SELECT 1 FROM public.review_outbox o WHERE o.review_id=review_assignments.id AND o.assignment_version=review_assignments.version
 AND o.event_type=CASE WHEN review_assignments.due_by<=now() THEN 'lte.review_overdue' ELSE 'lte.review_due_soon' END)
 ORDER BY due_by,id LIMIT least(greatest(p_limit,1),500) FOR UPDATE SKIP LOCKED LOOP
  kind := CASE WHEN r.due_by<=now() THEN 'lte.review_overdue' ELSE 'lte.review_due_soon' END;
  event_id := gen_random_uuid();
  INSERT INTO public.review_outbox(id,review_id,event_type,assignment_version,payload) VALUES(event_id,r.id,kind,r.version,
   jsonb_build_object('schemaVersion',1,'eventId',event_id,'occurredAt',now(),'reviewId',r.id,'submissionId',r.submission_id,
   'assignmentVersion',r.version,'learnerId',r.learner_id,'reviewerId',r.reviewer_id,'scopeId',r.scope_id,'scopeType',r.scope_type,'dueBy',r.due_by))
  ON CONFLICT(review_id,event_type,assignment_version) DO NOTHING;
  GET DIAGNOSTICS affected=ROW_COUNT; inserted:=inserted+affected;
 END LOOP;
 -- Cancel queued reminders and assignments invalidated by a completed or
 -- reassigned review. Stable IDs still protect an already in-flight delivery.
 UPDATE public.review_outbox o SET cancelled_at=now(),lease_until=NULL,lease_token=NULL
 FROM public.review_assignments a WHERE o.review_id=a.id AND o.delivered_at IS NULL AND o.cancelled_at IS NULL
 AND o.event_type IN ('lte.review_due_soon','lte.review_overdue','lte.review_assigned')
 AND (a.status NOT IN ('pending','in_progress') OR (o.payload->>'reviewerId')::uuid IS DISTINCT FROM a.reviewer_id
 OR o.event_type<>'lte.review_assigned' AND o.assignment_version<>a.version);
 RETURN inserted;
END $$;
REVOKE ALL ON FUNCTION public.schedule_review_deadlines(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_review_deadlines(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_review_outbox(p_limit integer DEFAULT 25) RETURNS SETOF public.review_outbox
LANGUAGE sql SET search_path=public,pg_temp AS $$
 UPDATE public.review_outbox SET lease_until=now()+interval '2 minutes',lease_token=gen_random_uuid(),attempts=attempts+1
 WHERE id IN (SELECT id FROM public.review_outbox WHERE delivered_at IS NULL AND cancelled_at IS NULL AND next_attempt_at<=now()
 AND (lease_until IS NULL OR lease_until<now()) ORDER BY next_attempt_at,id LIMIT least(greatest(p_limit,1),100) FOR UPDATE SKIP LOCKED)
 RETURNING *;
$$;
CREATE FUNCTION public.review_operations_stats(p_scope_id uuid,p_scope_type text) RETURNS jsonb
LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object(
 'unassigned',(SELECT count(*) FROM public.review_assignments WHERE scope_id=p_scope_id AND scope_type=p_scope_type AND status='unassigned'),
 'overdue',(SELECT count(*) FROM public.review_assignments WHERE scope_id=p_scope_id AND scope_type=p_scope_type AND status IN ('pending','in_progress') AND due_by<now()),
 'oldestRequiredAt',(SELECT min(required_at) FROM public.review_assignments WHERE scope_id=p_scope_id AND scope_type=p_scope_type AND status IN ('unassigned','pending','in_progress')),
 'pendingEvents',(SELECT count(*) FROM public.review_outbox o JOIN public.review_assignments a ON a.id=o.review_id WHERE a.scope_id=p_scope_id AND a.scope_type=p_scope_type AND o.delivered_at IS NULL AND o.cancelled_at IS NULL),
 'oldestPendingEventAt',(SELECT min(o.created_at) FROM public.review_outbox o JOIN public.review_assignments a ON a.id=o.review_id WHERE a.scope_id=p_scope_id AND a.scope_type=p_scope_type AND o.delivered_at IS NULL AND o.cancelled_at IS NULL)
 );
$$;
REVOKE ALL ON FUNCTION public.review_operations_stats(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_operations_stats(uuid,text) TO service_role;
