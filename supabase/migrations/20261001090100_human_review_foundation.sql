-- Server-mediated review data. Scope/user identifiers from SkillPassport are
-- external identities; only LTE-local objects have foreign keys here.
CREATE TABLE public.review_rubric_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version integer NOT NULL CHECK (version > 0),
  name text NOT NULL,
  criteria jsonb NOT NULL CHECK (jsonb_typeof(criteria) = 'array'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, version)
);
INSERT INTO public.review_rubric_templates(id,version,name,criteria) VALUES (
 '61000000-0000-4000-8000-000000000001',1,'LTE basic rubric',
 '[{"id":"completeness","label":"Completeness","maxScore":3},{"id":"accuracy","label":"Accuracy","maxScore":3},{"id":"evidence-use","label":"Evidence use","maxScore":3},{"id":"judgement","label":"Judgement","maxScore":3},{"id":"next-action","label":"Next action","maxScore":3}]'
);
CREATE TABLE public.review_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.artifact_submissions(id) ON DELETE CASCADE,
  stage text NOT NULL DEFAULT 'staff_review' CHECK (stage = 'staff_review'),
  learner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reviewer_id uuid,
  scope_id uuid,
  scope_type text CHECK (scope_type IN ('college_program','school_class')),
  status text NOT NULL DEFAULT 'unassigned' CHECK (status IN ('unassigned','pending','in_progress','completed','returned')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  rubric_id uuid NOT NULL REFERENCES public.review_rubric_templates(id),
  rubric_snapshot jsonb NOT NULL,
  reason text NOT NULL,
  required_at timestamptz NOT NULL DEFAULT now(),
  assigned_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  due_by timestamptz,
  UNIQUE (submission_id,stage),
  CHECK ((status = 'unassigned') = (reviewer_id IS NULL)),
  CHECK (reviewer_id IS DISTINCT FROM learner_id),
  CHECK ((scope_id IS NULL) = (scope_type IS NULL)),
  CHECK (status = 'unassigned' OR (scope_id IS NOT NULL AND due_by IS NOT NULL))
);
CREATE INDEX review_learner_idx ON public.review_assignments(learner_id,status,completed_at DESC,id);
CREATE INDEX review_queue_idx ON public.review_assignments(reviewer_id,status,due_by,id);
CREATE INDEX review_backlog_idx ON public.review_assignments(required_at,id) WHERE status = 'unassigned';
CREATE INDEX review_deadline_idx ON public.review_assignments(due_by,id) WHERE status IN ('pending','in_progress');
CREATE TABLE public.review_commands (
  review_id uuid NOT NULL REFERENCES public.review_assignments(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL,
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 128),
  request_hash text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(review_id,actor_id,idempotency_key)
);
CREATE TABLE public.review_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.review_assignments(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.review_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.review_assignments(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK(event_type IN ('lte.review_assigned','lte.review_completed','lte.artifact_reviewed_pass')),
  assignment_version integer NOT NULL,
  payload jsonb NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  lease_token uuid,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(review_id,event_type,assignment_version)
);
CREATE INDEX review_outbox_pending_idx ON public.review_outbox(next_attempt_at,id) WHERE delivered_at IS NULL;
-- Fail visibly if historical rows violate the invariant. Never delete evidence
-- or guess which review wins during migration.
CREATE UNIQUE INDEX artifact_one_current_evaluation ON public.artifact_evaluation_flows(submission_id) WHERE is_current_stage;

DO $$ DECLARE t text; BEGIN
 FOR t IN SELECT unnest(ARRAY['review_rubric_templates','review_assignments','review_commands','review_audit','review_outbox']) LOOP
  EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated',t);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO service_role',t);
 END LOOP;
END $$;
-- Published templates and audit history are append-only for the application.
REVOKE UPDATE, DELETE ON public.review_rubric_templates, public.review_audit FROM service_role;

CREATE FUNCTION public.review_business_deadline(p_days integer,p_zone text,p_start timestamptz DEFAULT now())
RETURNS timestamptz LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE d timestamp; n integer := 0;
BEGIN
 IF p_days IS NULL OR p_start IS NULL OR p_days NOT BETWEEN 1 AND 30 OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_zone) THEN
  RAISE EXCEPTION 'INVALID_REVIEW_SLA' USING ERRCODE='22023';
 END IF;
 d := p_start AT TIME ZONE p_zone;
 WHILE n < p_days LOOP
  d := d + interval '1 day';
  IF extract(isodow FROM d) < 6 THEN n := n + 1; END IF;
 END LOOP;
 RETURN d AT TIME ZONE p_zone;
END $$;

-- This lock is shared by submission INSERT and review completion. Checking
-- prior attempts rather than is_latest prevents an earlier demotion bypass.
CREATE FUNCTION public.guard_active_artifact_review() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text || ':' || NEW.artifact_id::text,0));
 IF EXISTS(SELECT 1 FROM public.artifact_submissions s
  WHERE s.user_id=NEW.user_id AND s.artifact_id=NEW.artifact_id
  AND (s.status='human_review' OR EXISTS(SELECT 1 FROM public.review_assignments r
    WHERE r.submission_id=s.id AND r.status IN ('unassigned','pending','in_progress')))) THEN
  RAISE EXCEPTION 'REVIEW_PENDING' USING ERRCODE='P0001';
 END IF;
 IF EXISTS(SELECT 1 FROM public.artifact_submissions s WHERE s.user_id=NEW.user_id
  AND s.artifact_id=NEW.artifact_id AND (s.status='accepted' OR s.sealed_at IS NOT NULL)) THEN
  RAISE EXCEPTION 'SUBMISSION_ALREADY_ACCEPTED' USING ERRCODE='P0001';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_active_artifact_review BEFORE INSERT ON public.artifact_submissions
FOR EACH ROW EXECUTE FUNCTION public.guard_active_artifact_review();

-- Persist required review independently of cross-service availability. Scope
-- resolution and assignment can be retried without losing the learner's work.
CREATE FUNCTION public.ensure_artifact_review(p_submission_id uuid,p_learner_id uuid,p_reason text)
RETURNS public.review_assignments LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE s public.artifact_submissions; r public.review_assignments; rubric public.review_rubric_templates;
BEGIN
 SELECT * INTO s FROM public.artifact_submissions WHERE id=p_submission_id AND user_id=p_learner_id;
 IF NOT FOUND OR s.status <> 'human_review' OR NOT s.is_latest THEN RAISE EXCEPTION 'REVIEW_NOT_REQUIRED'; END IF;
 SELECT * INTO rubric FROM public.review_rubric_templates WHERE id='61000000-0000-4000-8000-000000000001';
 INSERT INTO public.review_assignments(submission_id,learner_id,rubric_id,rubric_snapshot,reason)
 VALUES(s.id,s.user_id,rubric.id,jsonb_build_object('version',rubric.version,'criteria',rubric.criteria),p_reason)
 ON CONFLICT(submission_id,stage) DO NOTHING;
 SELECT * INTO r FROM public.review_assignments WHERE submission_id=s.id AND stage='staff_review';
 RETURN r;
END $$;

-- Candidate identities and scope are resolved by the trusted backend from
-- SkillPassport. This function is never executable by browser roles.
CREATE FUNCTION public.assign_artifact_review(p_review_id uuid,p_scope_id uuid,p_scope_type text,
 p_candidates uuid[],p_sla_days integer,p_timezone text,p_load_cap integer)
RETURNS public.review_assignments LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE r public.review_assignments; candidate uuid; chosen uuid; deadline timestamptz; event_id uuid; previous uuid;
BEGIN
 IF p_scope_id IS NULL OR p_scope_type IS NULL OR p_scope_type NOT IN ('college_program','school_class') OR p_load_cap IS NULL OR p_load_cap NOT BETWEEN 1 AND 100
 OR p_candidates IS NULL OR cardinality(p_candidates)>100 THEN RAISE EXCEPTION 'INVALID_REVIEW_SCOPE'; END IF;
 -- Serialize selection across scopes to enforce global reviewer capacity.
 PERFORM pg_advisory_xact_lock(hashtextextended('review-assignment-selection',0));
 SELECT * INTO r FROM public.review_assignments WHERE id=p_review_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'REVIEW_NOT_FOUND'; END IF;
 IF r.status <> 'unassigned' THEN RETURN r; END IF;
 SELECT old.reviewer_id INTO previous FROM public.artifact_submissions s JOIN public.review_assignments old
 ON old.submission_id=s.previous_submission_id WHERE s.id=r.submission_id;
 FOR candidate IN SELECT DISTINCT c.id FROM unnest(p_candidates) c(id)
 WHERE c.id <> r.learner_id
 ORDER BY c.id LOOP
  IF (SELECT count(*) FROM public.review_assignments WHERE reviewer_id=candidate AND status IN ('pending','in_progress')) < p_load_cap THEN
   IF chosen IS NULL OR candidate=previous OR
    (SELECT count(*) FROM public.review_assignments WHERE reviewer_id=candidate AND status IN ('pending','in_progress')) <
    (SELECT count(*) FROM public.review_assignments WHERE reviewer_id=chosen AND status IN ('pending','in_progress')) THEN chosen := candidate; END IF;
   IF candidate=previous THEN EXIT; END IF;
  END IF;
 END LOOP;
 UPDATE public.review_assignments SET scope_id=p_scope_id,scope_type=p_scope_type WHERE id=r.id RETURNING * INTO r;
 IF chosen IS NULL THEN RETURN r; END IF;
 deadline := public.review_business_deadline(p_sla_days,p_timezone);
 UPDATE public.review_assignments SET reviewer_id=chosen,status='pending',assigned_at=now(),due_by=deadline,version=version+1
 WHERE id=r.id RETURNING * INTO r;
 INSERT INTO public.review_audit(review_id,action,detail) VALUES(r.id,'assigned',jsonb_build_object('reviewerId',chosen,'version',r.version));
 event_id := gen_random_uuid();
 INSERT INTO public.review_outbox(id,review_id,event_type,assignment_version,payload)
 VALUES(event_id,r.id,'lte.review_assigned',r.version,jsonb_build_object('schemaVersion',1,'eventId',event_id,'occurredAt',now(),
  'reviewId',r.id,'submissionId',r.submission_id,'assignmentVersion',r.version,'learnerId',r.learner_id,
  'reviewerId',chosen,'scopeId',r.scope_id,'scopeType',r.scope_type,'dueBy',r.due_by));
 RETURN r;
END $$;

CREATE FUNCTION public.start_artifact_review(p_review_id uuid,p_actor_id uuid,p_version integer)
RETURNS public.review_assignments LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE r public.review_assignments;
BEGIN
 SELECT * INTO r FROM public.review_assignments WHERE id=p_review_id AND reviewer_id=p_actor_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'REVIEW_NOT_FOUND'; END IF;
 IF r.status='in_progress' AND r.version=p_version+1 THEN RETURN r; END IF;
 IF r.status<>'pending' OR r.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'REVIEW_CONFLICT'; END IF;
 UPDATE public.review_assignments SET status='in_progress',started_at=now(),version=version+1 WHERE id=r.id RETURNING * INTO r;
 INSERT INTO public.review_audit(review_id,actor_id,action) VALUES(r.id,p_actor_id,'started');
 RETURN r;
END $$;

CREATE FUNCTION public.complete_artifact_review(p_review_id uuid,p_actor_id uuid,p_key text,p_hash text,p_command jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE r public.review_assignments; s public.artifact_submissions; saved public.review_commands;
 artifact_kind text; decision text; row jsonb; rows jsonb; total integer := 0; final_score integer;
 event_name text; xp integer; xp_key text; result jsonb; event_id uuid; kind text;
BEGIN
 IF p_key IS NULL OR length(p_key) NOT BETWEEN 1 AND 128 OR p_hash IS NULL OR length(p_hash)=0 THEN RAISE EXCEPTION 'INVALID_REVIEW_COMMAND'; END IF;
 SELECT * INTO r FROM public.review_assignments WHERE id=p_review_id AND reviewer_id=p_actor_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'REVIEW_NOT_FOUND'; END IF;
 SELECT * INTO s FROM public.artifact_submissions WHERE id=r.submission_id;
 PERFORM pg_advisory_xact_lock(hashtextextended(s.user_id::text || ':' || s.artifact_id::text,0));
 SELECT * INTO r FROM public.review_assignments WHERE id=p_review_id AND reviewer_id=p_actor_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'REVIEW_NOT_FOUND'; END IF;
 SELECT * INTO saved FROM public.review_commands WHERE review_id=r.id AND actor_id=p_actor_id AND idempotency_key=p_key;
 IF FOUND THEN
  IF saved.request_hash<>p_hash THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
  RETURN saved.result;
 END IF;
 SELECT * INTO s FROM public.artifact_submissions WHERE id=r.submission_id FOR UPDATE;
 IF NOT s.is_latest OR s.status<>'human_review' OR r.status<>'in_progress' OR r.version IS DISTINCT FROM (p_command->>'expectedVersion')::integer THEN
  RAISE EXCEPTION 'REVIEW_CONFLICT';
 END IF;
 decision := p_command->>'decision'; rows := p_command->'criteria';
 IF decision IS NULL OR decision NOT IN ('pass','revise_and_resubmit') OR jsonb_typeof(rows) IS DISTINCT FROM 'array'
 OR jsonb_array_length(rows)<>5 OR length(trim(coalesce(p_command->>'feedback',''))) NOT BETWEEN 1 AND 10000
 OR length(trim(coalesce(p_command->>'rationale',''))) NOT BETWEEN 1 AND 4000
 OR jsonb_typeof(p_command->'hasCriticalFailure') IS DISTINCT FROM 'boolean'
 OR jsonb_typeof(p_command->'actionItems') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INVALID_REVIEW_COMMAND'; END IF;
 IF jsonb_array_length(p_command->'actionItems')>20 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_command->'actionItems') a WHERE jsonb_typeof(a)<>'string' OR length(trim(a#>>'{}')) NOT BETWEEN 1 AND 1000) THEN RAISE EXCEPTION 'INVALID_REVIEW_COMMAND'; END IF;
 IF (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(rows))<>5 THEN RAISE EXCEPTION 'INVALID_REVIEW_CRITERIA'; END IF;
 FOR row IN SELECT value FROM jsonb_array_elements(rows) LOOP
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r.rubric_snapshot->'criteria') c WHERE c->>'id'=row->>'id')
  OR jsonb_typeof(row->'score') IS DISTINCT FROM 'number' OR (row->>'score')::numeric NOT BETWEEN 0 AND 3
  OR jsonb_typeof(row->'evidence') IS DISTINCT FROM 'string' OR length(row->>'evidence')>4000
  OR trunc((row->>'score')::numeric)<>(row->>'score')::numeric THEN RAISE EXCEPTION 'INVALID_REVIEW_CRITERIA'; END IF;
  IF decision='pass' AND ((row->>'score')::integer<2 OR length(trim(coalesce(row->>'evidence','')))=0) THEN RAISE EXCEPTION 'INVALID_REVIEW_PASS'; END IF;
  total := total+(row->>'score')::integer;
 END LOOP;
 IF decision='pass' AND (p_command->>'hasCriticalFailure')::boolean THEN RAISE EXCEPTION 'INVALID_REVIEW_PASS'; END IF;
 IF decision='revise_and_resubmit' AND jsonb_array_length(p_command->'actionItems')=0 THEN RAISE EXCEPTION 'REVISION_ACTION_REQUIRED'; END IF;
 final_score := round(total::numeric/15*100);
 SELECT artifact_type INTO artifact_kind FROM public.module_artifacts WHERE id=s.artifact_id;
 xp := CASE WHEN decision<>'pass' THEN 1 WHEN artifact_kind='practice' THEN 2 WHEN s.attempt_no=1 THEN 20 WHEN s.attempt_no=2 THEN 15 ELSE 10 END;
 event_name := CASE WHEN artifact_kind='practice' THEN CASE WHEN decision='pass' THEN 'practice_artifact_accepted' ELSE 'practice_artifact_failed' END
 ELSE CASE WHEN decision='pass' THEN 'final_artifact_accepted_'||least(3,s.attempt_no) ELSE 'final_artifact_failed' END END;
 xp_key := CASE WHEN artifact_kind='practice' THEN CASE WHEN decision='pass' THEN 'practice:' ELSE 'practice_fail:' END
 ELSE CASE WHEN decision='pass' THEN 'final:' ELSE 'final_fail:' END END || s.user_id || ':' || s.id;
 UPDATE public.artifact_evaluation_flows SET is_current_stage=false,updated_at=now() WHERE submission_id=s.id AND is_current_stage;
 INSERT INTO public.artifact_evaluation_flows(submission_id,stage,stage_order,status,evaluated_by,score,feedback,improvements,decision,
 completed_at,overall_status,is_current_stage,progression_triggered,metadata)
 VALUES(s.id,'staff_review',2,'completed',p_actor_id,final_score,p_command->>'feedback',
 (SELECT string_agg(value,E'\n') FROM jsonb_array_elements_text(p_command->'actionItems')),decision,now(),
 CASE WHEN decision='pass' THEN 'accepted' ELSE 'resubmission_required' END,true,decision='pass',
 jsonb_build_object('rubric_rows',rows,'rubric_snapshot',r.rubric_snapshot,'action_items',p_command->'actionItems',
 'rationale',p_command->>'rationale','has_critical_failure',p_command->'hasCriticalFailure','review_id',r.id,'calculated_xp',xp,'event_type',event_name));
 UPDATE public.artifact_submissions SET status=CASE WHEN decision='pass' THEN 'accepted' ELSE 'resubmission_required' END,
 sealed_at=CASE WHEN decision='pass' THEN now() ELSE NULL END,updated_at=now() WHERE id=s.id;
 UPDATE public.user_module_progress SET artifact_approval_status=CASE WHEN decision='pass' THEN 'approved' ELSE 'resubmission_required' END,
 artifact_submitted=CASE WHEN decision='pass' THEN true ELSE artifact_submitted END,
 module_status=CASE WHEN decision='pass' AND artifact_kind<>'practice' THEN 'mastered' ELSE module_status END,updated_at=now()
 WHERE id=s.user_module_progress_id;
 -- enum cast is derived from the existing column type, not a duplicated enum name.
 INSERT INTO public.xp_events(user_id,event_type,xp_category,xp_amount,source_type,source_id,idempotency_key,metadata)
 SELECT s.user_id,e.event_type,e.xp_category,xp,'artifact_submissions',s.id,xp_key,jsonb_build_object('review_id',r.id,'score',final_score)
 FROM jsonb_populate_record(NULL::public.xp_events,jsonb_build_object('event_type',event_name,'xp_category','evidence')) e
 ON CONFLICT(idempotency_key) DO NOTHING;
 UPDATE public.review_assignments SET status=CASE WHEN decision='pass' THEN 'completed' ELSE 'returned' END,completed_at=now(),version=version+1
 WHERE id=r.id RETURNING * INTO r;
 result := jsonb_build_object('review',to_jsonb(r),'score',final_score,'decision',decision,'calculatedXp',xp);
 INSERT INTO public.review_commands(review_id,actor_id,idempotency_key,request_hash,result) VALUES(r.id,p_actor_id,p_key,p_hash,result);
 INSERT INTO public.review_audit(review_id,actor_id,action,detail) VALUES(r.id,p_actor_id,'completed',jsonb_build_object('decision',decision,'version',r.version));
 FOREACH kind IN ARRAY CASE WHEN decision='pass' THEN ARRAY['lte.review_completed','lte.artifact_reviewed_pass'] ELSE ARRAY['lte.review_completed'] END LOOP
  event_id := gen_random_uuid();
  INSERT INTO public.review_outbox(id,review_id,event_type,assignment_version,payload) VALUES(event_id,r.id,kind,r.version,
   jsonb_build_object('schemaVersion',1,'eventId',event_id,'occurredAt',now(),'reviewId',r.id,'submissionId',s.id,'assignmentVersion',r.version,
   'learnerId',s.user_id,'reviewerId',p_actor_id,'scopeId',r.scope_id,'scopeType',r.scope_type,'decision',decision,'score',final_score));
 END LOOP;
 RETURN result;
END $$;

CREATE FUNCTION public.claim_review_outbox(p_limit integer DEFAULT 25) RETURNS SETOF public.review_outbox
LANGUAGE sql SET search_path = public, pg_temp AS $$
 UPDATE public.review_outbox SET lease_until=now()+interval '2 minutes',lease_token=gen_random_uuid(),attempts=attempts+1
 WHERE id IN (SELECT id FROM public.review_outbox WHERE delivered_at IS NULL AND next_attempt_at<=now()
 AND (lease_until IS NULL OR lease_until<now()) ORDER BY next_attempt_at,id LIMIT least(greatest(p_limit,1),100) FOR UPDATE SKIP LOCKED)
 RETURNING *;
$$;
CREATE FUNCTION public.finish_review_outbox(p_id uuid,p_lease uuid,p_success boolean) RETURNS void
LANGUAGE sql SET search_path = public, pg_temp AS $$
 UPDATE public.review_outbox SET delivered_at=CASE WHEN p_success THEN now() ELSE NULL END,
 next_attempt_at=now()+make_interval(secs=>least(3600,power(2,least(attempts,11))::integer)),lease_until=NULL,lease_token=NULL
 WHERE id=p_id AND lease_token=p_lease AND delivered_at IS NULL;
$$;
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN ('review_business_deadline','guard_active_artifact_review','ensure_artifact_review',
 'assign_artifact_review','start_artifact_review','complete_artifact_review','claim_review_outbox','finish_review_outbox') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',f.signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
 END LOOP;
END $$;

CREATE FUNCTION public.guard_review_attempt_demotion() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF OLD.is_latest AND NOT NEW.is_latest THEN
  IF OLD.status IN ('accepted','human_review') OR OLD.sealed_at IS NOT NULL OR EXISTS(
   SELECT 1 FROM public.review_assignments WHERE submission_id=OLD.id AND status IN ('unassigned','pending','in_progress')
  ) THEN RAISE EXCEPTION 'REVIEW_PENDING'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_review_attempt_demotion() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guard_review_attempt_demotion() TO service_role;
CREATE TRIGGER guard_review_attempt_demotion BEFORE UPDATE OF is_latest ON public.artifact_submissions
FOR EACH ROW EXECUTE FUNCTION public.guard_review_attempt_demotion();
