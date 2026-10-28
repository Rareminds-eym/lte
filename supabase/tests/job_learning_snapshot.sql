-- Local synthetic acceptance test. All writes are rolled back.
BEGIN;
DO $$
DECLARE subject uuid:=gen_random_uuid(); reviewer uuid:=gen_random_uuid(); track uuid; path uuid; progress uuid; module_progress uuid;
 target uuid:=gen_random_uuid(); role uuid:=gen_random_uuid(); capability uuid:=gen_random_uuid(); scale uuid;
 module_ref uuid:=gen_random_uuid(); content_ref uuid:=gen_random_uuid(); artifact_ref uuid:=gen_random_uuid();
 rubric uuid; artifact record; submission uuid; review uuid; result jsonb; item jsonb; original_fingerprint text; command jsonb;
BEGIN
 INSERT INTO public.users(id,email) VALUES(subject,subject||'@learning-test.invalid'),(reviewer,reviewer||'@learning-test.invalid');
 -- Own the catalog fixture so this suite also runs against unpublished or empty catalogs.
 INSERT INTO public.capabilities(id,code,name,description,is_active) VALUES(capability,'learning-'||left(capability::text,8),'Learning fixture','Test',true);
 INSERT INTO public.level_scale(level_no,level_label,generic_definition) VALUES(1,'Test','Test') ON CONFLICT(level_no) DO NOTHING;
 SELECT id INTO STRICT scale FROM public.level_scale WHERE level_no=1;
 INSERT INTO public.levels(id,level_code,capability_id,level_id,title,description,duration_minutes,difficulty_level,status,is_active)
 VALUES(target,'learning-'||left(target::text,8),capability,scale,'Learning fixture','Test',1,'beginner','published',true);
 INSERT INTO public.modules(id,level_id,module_no,title,description,is_active,is_published) VALUES(module_ref,target,1,'Learning fixture','Test',true,true);
 INSERT INTO public.modules_content(id,module_id,stage_name,stage_order,is_active) VALUES(content_ref,module_ref,'express',4,true);
 INSERT INTO public.module_artifacts(id,modules_content_id,artifact_type,total_score,is_active) VALUES(artifact_ref,content_ref,'final',100,true);
 INSERT INTO public.roles(id,role_name,role_family_name,domain_name) VALUES(role,'Learning fixture '||role,'Test','Test');
 SELECT id INTO rubric FROM public.review_rubric_templates LIMIT 1;
 IF rubric IS NULL THEN INSERT INTO public.review_rubric_templates(version,name) VALUES(1,'Learning fixture rubric') RETURNING id INTO rubric; END IF;
 INSERT INTO public.learning_tracks(user_id,assessment_id,fit,track,match_score,duration,why_it_fits) VALUES(subject,gen_random_uuid(),'High','Learning fixture',90,'1 week','Fixture') RETURNING id INTO track;
 INSERT INTO public.learning_paths(learning_track_id,user_id,role_id,level) VALUES(track,subject,role,1) RETURNING id INTO path;
 INSERT INTO public.user_capability_level_progress(user_id,learning_path_id,level_id,sequence_no,from_level,to_level,current_score,current_level,required_level,gap,gap_score,status,completion_percentage)
 VALUES(subject,path,target,1,0,1,100,1,1,0,0,'completed',100) RETURNING id INTO progress;
 result:=public.job_learning_snapshot(subject,ARRAY[target]);item:=result->'levels'->0;
 IF jsonb_array_length(result->'levels') IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'FAIL: published fixture missing from qualification snapshot'; END IF;
 IF (item->>'approved')::boolean THEN RAISE EXCEPTION 'FAIL: content completion alone qualified'; END IF;
 original_fingerprint:=item->>'fingerprint';
 FOR artifact IN SELECT a.id artifact_id,m.id module_id FROM public.modules m JOIN public.modules_content mc ON mc.module_id=m.id JOIN public.module_artifacts a ON a.modules_content_id=mc.id
 WHERE m.level_id=target AND m.is_active AND m.is_published AND mc.is_active AND a.is_active AND a.artifact_type::text='final' LOOP
  SELECT id INTO module_progress FROM public.user_module_progress WHERE user_id=subject AND module_id=artifact.module_id;
  IF module_progress IS NULL THEN INSERT INTO public.user_module_progress(user_id,user_capability_level_progress_id,module_id,module_status,completion_percentage)
   VALUES(subject,progress,artifact.module_id,'completed',100) RETURNING id INTO module_progress; END IF;
  INSERT INTO public.artifact_submissions(artifact_id,user_id,user_module_progress_id,version_label,status,is_latest)
   VALUES(artifact.artifact_id,subject,module_progress,'fixture','accepted',true) RETURNING id INTO submission;
  INSERT INTO public.artifact_evaluation_flows(submission_id,stage,status,decision,is_current_stage,evaluated_by,completed_at)
   VALUES(submission,'ai','completed','pass',true,reviewer,now());
  result:=public.job_learning_snapshot(subject,ARRAY[target]);
  IF (result->'levels'->0->>'approved')::boolean THEN RAISE EXCEPTION 'FAIL: AI-only approval qualified'; END IF;
  UPDATE public.artifact_submissions SET status='human_review' WHERE id=submission;
  INSERT INTO public.review_assignments(submission_id,learner_id,reviewer_id,scope_id,scope_type,status,rubric_id,rubric_snapshot,reason,due_by,completed_at)
   VALUES(submission,subject,reviewer,gen_random_uuid(),'college_program','pending',rubric,public.review_rubric_snapshot(rubric),'fixture',now()+interval '1 day',NULL) RETURNING id INTO review;
  PERFORM public.start_artifact_review(review,reviewer,1);
  command:=jsonb_build_object('expectedVersion',2,'decision','pass','criteria',(SELECT jsonb_agg(jsonb_build_object('id',criterion_key,'score',3,'evidence','Synthetic acceptance fixture')) FROM public.review_rubric_criteria WHERE rubric_id=rubric),
   'feedback','Approved fixture evidence','rationale','Demonstrates the level','actionItems','[]'::jsonb,'hasCriticalFailure',false,
   'xpRewards',jsonb_build_object('final_artifact_accepted_1',20,'final_artifact_accepted_2',15,'final_artifact_accepted_3',10));
  PERFORM public.complete_artifact_review(review,reviewer,'fixture-'||review,'fixture-hash',command);
 END LOOP;
 result:=public.job_learning_snapshot(subject,ARRAY[target]);
 IF NOT (result->'levels'->0->>'approved')::boolean THEN RAISE EXCEPTION 'FAIL: accepted human-reviewed finals did not qualify'; END IF;
 IF result->'levels'->0->>'fingerprint'<>original_fingerprint THEN RAISE EXCEPTION 'FAIL: progress changed catalog fingerprint'; END IF;
 -- The last final is AI accepted; all other finals retain stronger human approval.
 UPDATE public.artifact_evaluation_flows SET is_current_stage=false WHERE submission_id=submission;
 UPDATE public.artifact_evaluation_flows SET is_current_stage=true,overall_status='accepted',
 metadata=jsonb_build_object('provider','openrouter','evaluation_source','ai','requires_manual_review',false,'confidence',90,
 'stage1_submission_check',jsonb_build_object('isAssessable',true),'stage2_critical_failures',jsonb_build_object('hasFailure',false),
 'rubric_rows',(SELECT jsonb_agg(jsonb_build_object('score',3,'evidenceValid',true)) FROM generate_series(1,5)))
 WHERE submission_id=submission AND stage::text='ai';
 result:=public.job_learning_snapshot(subject,ARRAY[target],'ai');
 IF NOT (result->'levels'->0->>'approved')::boolean THEN RAISE EXCEPTION 'FAIL: validated AI final did not qualify independent policy'; END IF;
 result:=public.job_learning_snapshot(subject,ARRAY[target],'human');
 IF (result->'levels'->0->>'approved')::boolean THEN RAISE EXCEPTION 'FAIL: AI final bypassed institutional human policy'; END IF;
 UPDATE public.artifact_evaluation_flows SET metadata=jsonb_set(metadata,'{rubric_rows,0,score}','null') WHERE submission_id=submission AND stage::text='ai';
 result:=public.job_learning_snapshot(subject,ARRAY[target],'ai');
 IF (result->'levels'->0->>'approved')::boolean THEN RAISE EXCEPTION 'FAIL: null AI rubric score qualified'; END IF;
 UPDATE public.artifact_evaluation_flows SET metadata=jsonb_set(jsonb_set(metadata,'{rubric_rows,0,score}','3'),'{provider}','"fallback"') WHERE submission_id=submission AND stage::text='ai';
 result:=public.job_learning_snapshot(subject,ARRAY[target],'ai');
 IF (result->'levels'->0->>'approved')::boolean THEN RAISE EXCEPTION 'FAIL: fallback AI qualified'; END IF;
 UPDATE public.artifact_evaluation_flows SET decision='revise_and_resubmit' WHERE submission_id=submission AND is_current_stage;
 result:=public.job_learning_snapshot(subject,ARRAY[target]);
 IF (result->'levels'->0->>'approved')::boolean THEN RAISE EXCEPTION 'FAIL: withdrawn human acceptance still qualified'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.learning_progress_revisions WHERE user_id=subject AND revision>0)
 OR NOT EXISTS(SELECT 1 FROM public.learning_progress_delivery WHERE user_id=subject) THEN RAISE EXCEPTION 'FAIL: progress revision/outbox missing'; END IF;
 UPDATE public.learning_progress_delivery SET attempts=8,quarantined_at=now(),next_attempt_at=now()+interval '1 day' WHERE user_id=subject AND level_id=target;
 UPDATE public.user_capability_level_progress SET completion_percentage=100 WHERE id=progress;
 IF (SELECT quarantined_at IS NOT NULL OR attempts<>0 OR next_attempt_at>now() FROM public.learning_progress_delivery WHERE user_id=subject AND level_id=target) THEN RAISE EXCEPTION 'FAIL: fresh progress did not reactivate quarantined delivery'; END IF;
 IF has_function_privilege('anon','public.job_learning_snapshot(uuid,uuid[])','EXECUTE') THEN RAISE EXCEPTION 'FAIL: qualification RPC exposed'; END IF;
 RAISE NOTICE 'PASS: content-only and AI-only denied, human and independent AI policies enforced, malformed/fallback AI denied, revocation denied, stable content fingerprint, durable progress, private grants';
END $$;
ROLLBACK;
