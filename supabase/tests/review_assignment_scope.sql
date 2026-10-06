-- Execute against an isolated migrated LTE database. All fixtures roll back.
BEGIN;
DO $$
DECLARE
 learner uuid := gen_random_uuid(); reviewer uuid := gen_random_uuid(); other_user uuid := gen_random_uuid();
 capability uuid := gen_random_uuid(); scale uuid := gen_random_uuid(); level_ref uuid := gen_random_uuid();
 module_ref uuid := gen_random_uuid(); content_ref uuid := gen_random_uuid(); artifact uuid := gen_random_uuid();
 track uuid := gen_random_uuid(); role_ref uuid := gen_random_uuid(); path uuid := gen_random_uuid(); lp uuid := gen_random_uuid();
 progress uuid := gen_random_uuid(); submission uuid := gen_random_uuid(); r public.review_assignments;
 rubric_alt uuid:=gen_random_uuid(); score_ref uuid;
 result jsonb; replay jsonb; command jsonb; scope_ref uuid:=gen_random_uuid(); next_submission uuid; leased public.review_outbox;
BEGIN
 INSERT INTO public.users(id,email) VALUES(learner,'review-learner-'||learner||'@example.test'),(reviewer,'reviewer-'||reviewer||'@example.test'),(other_user,'other-'||other_user||'@example.test');
 INSERT INTO public.capabilities(id,code,name,description) VALUES(capability,'test-'||left(capability::text,8),'Review fixture','Test');
 INSERT INTO public.level_scale(id,level_no,level_label,generic_definition) VALUES(scale,1,'Test','Test') ON CONFLICT(level_no) DO NOTHING;
 SELECT id INTO scale FROM public.level_scale WHERE level_no=1;
 INSERT INTO public.levels(id,level_code,capability_id,level_id,title,description,duration_minutes,difficulty_level) VALUES(level_ref,'test-'||left(level_ref::text,8),capability,scale,'Test','Test',1,'beginner');
 INSERT INTO public.modules(id,level_id,module_no,title,description) VALUES(module_ref,level_ref,1,'Test','Test');
 INSERT INTO public.modules_content(id,module_id,stage_name,stage_order) VALUES(content_ref,module_ref,'express',4);
 INSERT INTO public.module_artifacts(id,modules_content_id,artifact_type,total_score) VALUES(artifact,content_ref,'final',100);
 INSERT INTO public.learning_tracks(id,user_id,assessment_id,fit,track,match_score,duration,why_it_fits) VALUES(track,learner,gen_random_uuid(),'High','Test',80,'1','Test');
 INSERT INTO public.roles(id,role_name,role_family_name,domain_name) VALUES(role_ref,'Test-'||role_ref,'Test','Test');
 INSERT INTO public.learning_paths(id,learning_track_id,user_id,role_id,level) VALUES(path,track,learner,role_ref,1);
 INSERT INTO public.user_capability_level_progress(id,user_id,learning_path_id,level_id,sequence_no,from_level,to_level,current_score,current_level,required_level,gap,gap_score)
 VALUES(lp,learner,path,level_ref,1,0,1,0,0,1,1,1);
 INSERT INTO public.user_module_progress(id,user_id,user_capability_level_progress_id,module_id) VALUES(progress,learner,lp,module_ref);
 INSERT INTO public.artifact_submissions(id,artifact_id,user_id,user_module_progress_id,version_label,status) VALUES(submission,artifact,learner,progress,'v1','human_review');
 INSERT INTO public.artifact_evaluation_flows(submission_id,stage,status,decision,is_current_stage) VALUES(submission,'ai','completed','human_review',true);

 r:=public.ensure_artifact_review(submission,learner,'scope-test');
 r:=public.assign_review_in_scope(r.id,other_user,reviewer,r.version,'No program',NULL,NULL,NULL,NULL,10,3,'Asia/Kolkata');
 ASSERT r.status='pending' AND r.scope_id IS NULL AND r.scope_type IS NULL, 'null-scope assignment failed';
 r:=public.assign_review_in_scope(r.id,other_user,other_user,r.version,'Moved to program',NULL,NULL,scope_ref,'college_program',10,3,'Asia/Kolkata');
 ASSERT r.scope_id=scope_ref AND r.reviewer_id=other_user, 'destination scope not assigned';
 BEGIN
  PERFORM public.assign_review_in_scope(r.id,other_user,reviewer,r.version,'Invalid SLA',scope_ref,'college_program',gen_random_uuid(),'school_class',10,31,'Asia/Kolkata');
  RAISE EXCEPTION 'expected invalid SLA';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 ASSERT (SELECT scope_id=scope_ref AND reviewer_id=other_user AND version=r.version FROM public.review_assignments WHERE id=r.id),'scope move partially committed';
 BEGIN
  PERFORM public.assign_review_in_scope(r.id,other_user,reviewer,r.version-1,'Stale',scope_ref,'college_program',NULL,NULL,10,3,'Asia/Kolkata');
  RAISE EXCEPTION 'expected conflict';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'REVIEW_CONFLICT' THEN RAISE; END IF; END;
 r:=public.assign_review_in_scope(r.id,other_user,reviewer,r.version,'Left program',scope_ref,'college_program',NULL,NULL,10,3,'Asia/Kolkata');
 ASSERT r.scope_id IS NULL AND r.status='pending','removing academic scope failed';
 r:=public.start_artifact_review(r.id,reviewer,r.version);
 command:=jsonb_build_object('xpRewards','{"final_artifact_accepted_1":20,"final_artifact_accepted_2":15,"final_artifact_accepted_3":10,"final_artifact_failed":1,"practice_artifact_accepted":2,"practice_artifact_failed":1}'::jsonb,'expectedVersion',r.version,'decision','pass','feedback','Verified','rationale','Verified',
 'hasCriticalFailure',false,'actionItems','[]'::jsonb,'criteria',
 (SELECT jsonb_agg(c||jsonb_build_object('score',2,'evidence','Observed')) FROM jsonb_array_elements(r.rubric_snapshot->'criteria') c));
 result:=public.complete_artifact_review(r.id,reviewer,'no-scope','no-scope-hash',command);
 ASSERT result->>'decision'='pass','null-scope completion failed';
 ASSERT EXISTS(SELECT 1 FROM public.review_outbox WHERE review_id=r.id AND event_type='lte.artifact_reviewed_pass' AND payload->'scopeId'='null'::jsonb),'null-scope event missing';
END $$;
ROLLBACK;
