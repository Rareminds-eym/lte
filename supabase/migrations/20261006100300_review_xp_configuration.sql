-- Keep completion atomic while using the same XP configuration as automated evaluation.
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
 event_name := CASE WHEN artifact_kind='practice' THEN CASE WHEN decision='pass' THEN 'practice_artifact_accepted' ELSE 'practice_artifact_failed' END
 ELSE CASE WHEN decision='pass' THEN 'final_artifact_accepted_'||least(3,s.attempt_no) ELSE 'final_artifact_failed' END END;
 -- The service supplies the canonical backend XP configuration, never browser input.
 xp := (p_command->'xpRewards'->>event_name)::integer;
 IF xp IS NULL OR xp < 0 THEN RAISE EXCEPTION 'INVALID_XP_CONFIGURATION'; END IF;
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
REVOKE ALL ON FUNCTION public.complete_artifact_review(uuid,uuid,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_artifact_review(uuid,uuid,text,text,jsonb) TO service_role;
