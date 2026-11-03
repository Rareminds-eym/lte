-- Normalize the live rubric/score model. Existing assignment and outcome JSON
-- remains historical evidence; incompatible history aborts this migration.
ALTER TABLE public.artifact_submissions ADD CONSTRAINT artifact_submissions_id_owner_key UNIQUE(id,user_id);
ALTER TABLE public.review_assignments ADD CONSTRAINT review_assignment_submission_owner_fk
 FOREIGN KEY(submission_id,learner_id) REFERENCES public.artifact_submissions(id,user_id) ON DELETE CASCADE;
ALTER TABLE public.review_assignments DROP CONSTRAINT review_assignments_submission_id_fkey;

CREATE TABLE public.review_rubric_criteria (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 rubric_id uuid NOT NULL REFERENCES public.review_rubric_templates(id),
 criterion_key text NOT NULL CHECK(length(trim(criterion_key))>0),
 label text NOT NULL CHECK(length(trim(label))>0),
 position smallint NOT NULL CHECK(position BETWEEN 1 AND 5),
 max_score smallint NOT NULL CHECK(max_score=3),
 pass_score smallint NOT NULL DEFAULT 2 CHECK(pass_score=2),
 UNIQUE(rubric_id,criterion_key), UNIQUE(rubric_id,position)
);
INSERT INTO public.review_rubric_criteria(rubric_id,criterion_key,label,position,max_score)
 SELECT t.id,c.value->>'id',c.value->>'label',c.ordinality,(c.value->>'maxScore')::smallint
 FROM public.review_rubric_templates t CROSS JOIN LATERAL jsonb_array_elements(t.criteria) WITH ORDINALITY c;

CREATE TABLE public.review_criterion_scores (
 review_id uuid NOT NULL REFERENCES public.review_assignments(id) ON DELETE CASCADE,
 rubric_criterion_id uuid NOT NULL REFERENCES public.review_rubric_criteria(id),
 score smallint NOT NULL CHECK(score BETWEEN 0 AND 3),
 evidence text NOT NULL CHECK(length(evidence)<=4000),
 PRIMARY KEY(review_id,rubric_criterion_id)
);
CREATE INDEX review_scores_criterion_idx ON public.review_criterion_scores(rubric_criterion_id,review_id);

CREATE FUNCTION public.review_rubric_snapshot(p_rubric_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('version',t.version,'criteria',jsonb_agg(
 jsonb_build_object('id',c.criterion_key,'label',c.label,'maxScore',c.max_score) ORDER BY c.position))
 FROM public.review_rubric_templates t JOIN public.review_rubric_criteria c ON c.rubric_id=t.id
 WHERE t.id=p_rubric_id GROUP BY t.id HAVING count(*)=5;
$$;

DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.review_rubric_templates t WHERE public.review_rubric_snapshot(t.id) IS NULL OR t.criteria IS DISTINCT FROM public.review_rubric_snapshot(t.id)->'criteria') OR
 EXISTS(SELECT 1 FROM public.review_assignments r WHERE r.rubric_snapshot IS DISTINCT FROM public.review_rubric_snapshot(r.rubric_id)) THEN
  RAISE EXCEPTION 'REVIEW_RUBRIC_HISTORY_MISMATCH';
 END IF;
 IF EXISTS(SELECT 1 FROM public.artifact_evaluation_flows f WHERE f.stage='staff_review' AND NOT EXISTS(
  SELECT 1 FROM public.review_assignments r WHERE r.submission_id=f.submission_id AND r.status IN ('completed','returned'))) THEN
  RAISE EXCEPTION 'REVIEW_OUTCOME_HISTORY_MISMATCH';
 END IF;
END $$;

INSERT INTO public.review_criterion_scores(review_id,rubric_criterion_id,score,evidence)
 SELECT r.id,c.id,(v.value->>'score')::smallint,v.value->>'evidence'
 FROM public.review_assignments r JOIN public.artifact_evaluation_flows f ON f.submission_id=r.submission_id AND f.stage='staff_review'
 CROSS JOIN LATERAL jsonb_array_elements(f.metadata->'rubric_rows') v
 JOIN public.review_rubric_criteria c ON c.rubric_id=r.rubric_id AND c.criterion_key=v.value->>'id';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.review_assignments r LEFT JOIN public.artifact_evaluation_flows f ON f.submission_id=r.submission_id AND f.stage='staff_review'
 WHERE r.status IN ('completed','returned') AND (
 f.id IS NULL OR jsonb_array_length(f.metadata->'rubric_rows') IS DISTINCT FROM 5 OR
 (SELECT count(*) FROM public.review_criterion_scores s WHERE s.review_id=r.id)<>5 OR
 f.score IS DISTINCT FROM (SELECT round(sum(s.score)::numeric/15*100) FROM public.review_criterion_scores s WHERE s.review_id=r.id))) THEN
  RAISE EXCEPTION 'REVIEW_SCORE_HISTORY_MISMATCH';
 END IF;
END $$;

-- Preserve the original review owner and rubric across reassignment/scope moves.
CREATE FUNCTION public.guard_review_identity() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF (NEW.submission_id,NEW.learner_id,NEW.rubric_id,NEW.rubric_snapshot,NEW.stage) IS DISTINCT FROM
     (OLD.submission_id,OLD.learner_id,OLD.rubric_id,OLD.rubric_snapshot,OLD.stage) THEN
   RAISE EXCEPTION 'REVIEW_IDENTITY_IMMUTABLE';
  END IF;
 ELSE
  IF NEW.rubric_snapshot IS DISTINCT FROM public.review_rubric_snapshot(NEW.rubric_id) OR NEW.rubric_snapshot IS NULL THEN
   RAISE EXCEPTION 'INVALID_REVIEW_RUBRIC';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_review_identity BEFORE INSERT OR UPDATE ON public.review_assignments
 FOR EACH ROW EXECUTE FUNCTION public.guard_review_identity();

-- Two foreign keys establish row existence; this guard binds the criterion to
-- the assignment's rubric without duplicating rubric_id in every score row.
CREATE FUNCTION public.guard_review_criterion_score() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE r public.review_assignments; c public.review_rubric_criteria;
BEGIN
 SELECT * INTO r FROM public.review_assignments WHERE id=NEW.review_id FOR UPDATE;
 SELECT * INTO c FROM public.review_rubric_criteria WHERE id=NEW.rubric_criterion_id;
 IF r.id IS NULL OR c.id IS NULL OR r.rubric_id IS DISTINCT FROM c.rubric_id OR r.status<>'in_progress' THEN
  RAISE EXCEPTION 'INVALID_REVIEW_CRITERION_RELATION';
 END IF;
 IF NEW.score NOT BETWEEN 0 AND c.max_score THEN RAISE EXCEPTION 'INVALID_REVIEW_CRITERIA'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_review_criterion_score BEFORE INSERT ON public.review_criterion_scores
 FOR EACH ROW EXECUTE FUNCTION public.guard_review_criterion_score();

ALTER TABLE public.review_rubric_criteria DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_criterion_scores DISABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.review_rubric_criteria,public.review_criterion_scores FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.review_rubric_criteria,public.review_criterion_scores TO service_role;
REVOKE ALL ON FUNCTION public.review_rubric_snapshot(uuid),public.guard_review_identity(),public.guard_review_criterion_score() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_rubric_snapshot(uuid),public.guard_review_identity(),public.guard_review_criterion_score() TO service_role;

CREATE OR REPLACE FUNCTION public.ensure_artifact_review(p_submission_id uuid,p_learner_id uuid,p_reason text)
RETURNS public.review_assignments LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE s public.artifact_submissions; r public.review_assignments; rubric public.review_rubric_templates;
BEGIN
 SELECT * INTO s FROM public.artifact_submissions WHERE id=p_submission_id AND user_id=p_learner_id;
 IF NOT FOUND OR s.status <> 'human_review' OR NOT s.is_latest THEN RAISE EXCEPTION 'REVIEW_NOT_REQUIRED'; END IF;
 SELECT * INTO rubric FROM public.review_rubric_templates WHERE id='61000000-0000-4000-8000-000000000001';
 INSERT INTO public.review_assignments(submission_id,learner_id,rubric_id,rubric_snapshot,reason)
 VALUES(s.id,s.user_id,rubric.id,public.review_rubric_snapshot(rubric.id),p_reason)
 ON CONFLICT(submission_id,stage) DO NOTHING;
 SELECT * INTO r FROM public.review_assignments WHERE submission_id=s.id AND stage='staff_review';
 RETURN r;
END $$;


CREATE OR REPLACE FUNCTION public.claim_review_reconciliation(p_limit integer DEFAULT 25) RETURNS SETOF public.review_assignments
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 INSERT INTO public.review_assignments(submission_id,learner_id,rubric_id,rubric_snapshot,reason)
 SELECT s.id,s.user_id,t.id,public.review_rubric_snapshot(t.id),'reconciliation'
 FROM public.artifact_submissions s CROSS JOIN public.review_rubric_templates t
 WHERE s.status='human_review' AND s.is_latest AND t.id='61000000-0000-4000-8000-000000000001'
 ON CONFLICT(submission_id,stage) DO NOTHING;
 RETURN QUERY UPDATE public.review_assignments SET next_check_at=now()+interval '15 minutes'
 WHERE id IN (SELECT id FROM public.review_assignments WHERE status='unassigned' AND next_check_at<=now()
 ORDER BY next_check_at,id LIMIT least(greatest(p_limit,1),100) FOR UPDATE SKIP LOCKED) RETURNING *;
END $$;
REVOKE ALL ON FUNCTION public.claim_review_reconciliation(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_review_reconciliation(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.complete_artifact_review(p_review_id uuid,p_actor_id uuid,p_key text,p_hash text,p_command jsonb)
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
  IF NOT EXISTS(SELECT 1 FROM public.review_rubric_criteria c WHERE c.rubric_id=r.rubric_id AND c.criterion_key=row->>'id')
  OR jsonb_typeof(row->'score') IS DISTINCT FROM 'number' OR (row->>'score')::numeric NOT BETWEEN 0 AND 3
  OR jsonb_typeof(row->'evidence') IS DISTINCT FROM 'string' OR length(row->>'evidence')>4000
  OR trunc((row->>'score')::numeric)<>(row->>'score')::numeric THEN RAISE EXCEPTION 'INVALID_REVIEW_CRITERIA'; END IF;
  IF decision='pass' AND ((row->>'score')::integer<2 OR length(trim(coalesce(row->>'evidence','')))=0) THEN RAISE EXCEPTION 'INVALID_REVIEW_PASS'; END IF;
  total := total+(row->>'score')::integer;
 END LOOP;
 IF decision='pass' AND (p_command->>'hasCriticalFailure')::boolean THEN RAISE EXCEPTION 'INVALID_REVIEW_PASS'; END IF;
 IF decision='revise_and_resubmit' AND jsonb_array_length(p_command->'actionItems')=0 THEN RAISE EXCEPTION 'REVISION_ACTION_REQUIRED'; END IF;
 IF (SELECT count(*) FROM public.review_rubric_criteria WHERE rubric_id=r.rubric_id)<>5 THEN RAISE EXCEPTION 'INVALID_REVIEW_RUBRIC'; END IF;
 final_score := round(total::numeric/(SELECT sum(max_score) FROM public.review_rubric_criteria WHERE rubric_id=r.rubric_id)*100);
 INSERT INTO public.review_criterion_scores(review_id,rubric_criterion_id,score,evidence)
 SELECT r.id,c.id,(v.value->>'score')::smallint,v.value->>'evidence'
 FROM jsonb_array_elements(rows) v JOIN public.review_rubric_criteria c ON c.rubric_id=r.rubric_id AND c.criterion_key=v.value->>'id';
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


-- Criteria now have one live source; assignment snapshots remain unchanged.
ALTER TABLE public.review_rubric_templates DROP COLUMN criteria;

-- DTO projection for authorized learner reads; JSON here is transport, not storage.
CREATE FUNCTION public.read_review_criterion_scores(p_submission_id uuid,p_learner_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',c.criterion_key,'label',c.label,'maxScore',c.max_score,
 'score',s.score,'evidence',s.evidence,'feedback',s.evidence,
 'tone',CASE WHEN s.score>=c.pass_score THEN 'success' WHEN s.score=0 THEN 'error' ELSE 'warning' END)
 ORDER BY c.position),'[]'::jsonb)
 FROM public.review_assignments r JOIN public.review_criterion_scores s ON s.review_id=r.id
 JOIN public.review_rubric_criteria c ON c.id=s.rubric_criterion_id
 WHERE r.submission_id=p_submission_id AND r.learner_id=p_learner_id AND r.status IN ('completed','returned');
$$;
REVOKE ALL ON FUNCTION public.read_review_criterion_scores(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.read_review_criterion_scores(uuid,uuid) TO service_role;

CREATE FUNCTION public.guard_review_score_completeness() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.status IN ('completed','returned') AND
 (SELECT count(*) FROM public.review_criterion_scores WHERE review_id=NEW.id)<>5 THEN
  RAISE EXCEPTION 'REVIEW_SCORES_INCOMPLETE';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_review_score_completeness BEFORE INSERT OR UPDATE OF status ON public.review_assignments
 FOR EACH ROW EXECUTE FUNCTION public.guard_review_score_completeness();
REVOKE ALL ON FUNCTION public.guard_review_score_completeness() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guard_review_score_completeness() TO service_role;
