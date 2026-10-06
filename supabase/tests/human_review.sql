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
 -- CONCURRENCY_FIXTURE_END
 BEGIN
  INSERT INTO public.review_assignments(submission_id,learner_id,rubric_id,rubric_snapshot,reason)
  VALUES(submission,other_user,'61000000-0000-4000-8000-000000000001',public.review_rubric_snapshot('61000000-0000-4000-8000-000000000001'),'wrong owner');
  RAISE EXCEPTION 'expected owner mismatch rejection';
 EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 r := public.ensure_artifact_review(submission,learner,'low_confidence');
 PERFORM public.ensure_artifact_review(submission,learner,'low_confidence');
 ASSERT (SELECT count(*) FROM public.review_assignments WHERE submission_id=submission)=1,'duplicate assignment';
 r := public.assign_artifact_review(r.id,gen_random_uuid(),'school_class',ARRAY[learner],3,'Asia/Kolkata',10);
 ASSERT r.status='unassigned','self review assigned';
 r := public.assign_artifact_review(r.id,gen_random_uuid(),'school_class',ARRAY[reviewer],3,'Asia/Kolkata',10);
 ASSERT r.status='pending' AND r.reviewer_id=reviewer,'assignment failed';
 BEGIN
  PERFORM public.start_artifact_review(r.id,other_user,r.version);
  RAISE EXCEPTION 'expected authorization rejection';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'REVIEW_NOT_FOUND' THEN RAISE; END IF; END;
 r := public.start_artifact_review(r.id,reviewer,r.version);
 INSERT INTO public.review_rubric_templates(id,version,name) VALUES(rubric_alt,1,'Foreign rubric '||rubric_alt);
 INSERT INTO public.review_rubric_criteria(rubric_id,criterion_key,label,position,max_score)
 SELECT rubric_alt,criterion_key,label,position,max_score FROM public.review_rubric_criteria WHERE rubric_id=r.rubric_id;
 SELECT id INTO score_ref FROM public.review_rubric_criteria WHERE rubric_id=rubric_alt ORDER BY position LIMIT 1;
 BEGIN
  INSERT INTO public.review_criterion_scores(review_id,rubric_criterion_id,score,evidence) VALUES(r.id,score_ref,2,'Wrong rubric');
  RAISE EXCEPTION 'expected foreign rubric rejection';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'INVALID_REVIEW_CRITERION_RELATION' THEN RAISE; END IF; END;
 BEGIN
  UPDATE public.review_assignments SET rubric_snapshot='{}'::jsonb WHERE id=r.id;
  RAISE EXCEPTION 'expected immutable rubric rejection';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'REVIEW_IDENTITY_IMMUTABLE' THEN RAISE; END IF; END;
 BEGIN
  UPDATE public.review_assignments SET status='completed' WHERE id=r.id;
  RAISE EXCEPTION 'expected incomplete score rejection';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'REVIEW_SCORES_INCOMPLETE' THEN RAISE; END IF; END;

 command := jsonb_build_object('xpRewards','{"final_artifact_accepted_1":20,"final_artifact_accepted_2":15,"final_artifact_accepted_3":10,"final_artifact_failed":1,"practice_artifact_accepted":2,"practice_artifact_failed":1}'::jsonb,'expectedVersion',r.version,'decision','pass','feedback','Meets standard','rationale','Evidence verified',
 'hasCriticalFailure',false,'actionItems','[]'::jsonb,'criteria',
 (SELECT jsonb_agg(c || jsonb_build_object('score',2,'evidence','Observed','tone','success')) FROM jsonb_array_elements(r.rubric_snapshot->'criteria') c));
 BEGIN
  INSERT INTO public.artifact_submissions(artifact_id,user_id,user_module_progress_id,version_label,attempt_no) VALUES(artifact,learner,progress,'v2',2);
  RAISE EXCEPTION 'expected active review rejection';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'REVIEW_PENDING' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.complete_artifact_review(r.id,reviewer,'unknown-criterion','unknown',jsonb_set(command,'{criteria,0,id}','"foreign-criterion"'::jsonb));
  RAISE EXCEPTION 'expected unknown criterion rejection';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'INVALID_REVIEW_CRITERIA' THEN RAISE; END IF; END;
 ASSERT NOT EXISTS(SELECT 1 FROM public.review_criterion_scores WHERE review_id=r.id),'invalid completion left partial scores';
 result := public.complete_artifact_review(r.id,reviewer,'test-key','test-hash',command);
 replay := public.complete_artifact_review(r.id,reviewer,'test-key','test-hash',command);
 ASSERT result=replay,'replay changed result';
 ASSERT (SELECT count(*) FROM public.review_criterion_scores WHERE review_id=r.id)=5,'missing or duplicate normalized scores';
 ASSERT (SELECT sum(score) FROM public.review_criterion_scores WHERE review_id=r.id)=10,'normalized score total incorrect';
 ASSERT jsonb_array_length(public.read_review_criterion_scores(submission,learner))=5,'normalized read failed';
 ASSERT public.read_review_criterion_scores(submission,other_user)='[]'::jsonb,'foreign learner scores exposed';
 ASSERT (public.read_review_criterion_scores(submission,learner)->0->>'feedback')='Observed','normalized evidence lost';
 ASSERT NOT has_table_privilege('service_role','public.review_criterion_scores','UPDATE,DELETE'),'application can edit recorded scores';
 ASSERT NOT has_table_privilege('service_role','public.review_rubric_criteria','UPDATE,DELETE'),'application can edit published criteria';

 ASSERT (SELECT count(*) FROM public.xp_events WHERE source_id=submission)=1,'duplicate XP';
 ASSERT (SELECT xp_amount FROM public.xp_events WHERE source_id=submission)=20,'incorrect XP';
 ASSERT (SELECT status='accepted' AND sealed_at IS NOT NULL FROM public.artifact_submissions WHERE id=submission),'submission not sealed';
 ASSERT (SELECT module_status='mastered' AND artifact_approval_status='approved' AND artifact_submitted FROM public.user_module_progress WHERE id=progress),'progress not updated';
 ASSERT (SELECT count(*) FROM public.artifact_evaluation_flows WHERE submission_id=submission AND is_current_stage)=1,'current stage invariant';
 ASSERT (SELECT count(*) FROM public.review_outbox WHERE review_id=r.id)=3,'missing or duplicate events';
 BEGIN
  PERFORM public.complete_artifact_review(r.id,reviewer,'test-key','conflicting-hash',command);
  RAISE EXCEPTION 'expected conflicting key rejection';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'IDEMPOTENCY_CONFLICT' THEN RAISE; END IF; END;

 -- Revision, reassignment and follow-up continuity on a separate practice artifact.
 artifact:=gen_random_uuid(); submission:=gen_random_uuid();
 INSERT INTO public.module_artifacts(id,modules_content_id,artifact_type,total_score) VALUES(artifact,content_ref,'practice',100);
 INSERT INTO public.artifact_submissions(id,artifact_id,user_id,user_module_progress_id,version_label,status) VALUES(submission,artifact,learner,progress,'v1','human_review');
 r:=public.ensure_artifact_review(submission,learner,'unassessable_evidence');
 r:=public.assign_artifact_review(r.id,scope_ref,'college_program',ARRAY[reviewer],3,'Asia/Kolkata',10);
 r:=public.start_artifact_review(r.id,reviewer,r.version);
 BEGIN
  UPDATE public.artifact_submissions SET is_latest=false WHERE id=submission;
  RAISE EXCEPTION 'expected demotion rejection';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'REVIEW_PENDING' THEN RAISE; END IF; END;
 ASSERT (SELECT is_latest FROM public.artifact_submissions WHERE id=submission),'failed demotion altered latest';
 BEGIN
  PERFORM public.reassign_artifact_review(r.id,other_user,other_user,r.version,'Cover unavailable reviewer',gen_random_uuid(),'college_program',10,3,'Asia/Kolkata');
  RAISE EXCEPTION 'expected scope rejection';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'REVIEW_NOT_FOUND' THEN RAISE; END IF; END;
 r:=public.reassign_artifact_review(r.id,other_user,other_user,r.version,'Cover unavailable reviewer',scope_ref,'college_program',10,3,'Asia/Kolkata');
 BEGIN
  PERFORM public.complete_artifact_review(r.id,reviewer,'stale','stale',command);
  RAISE EXCEPTION 'expected stale reviewer rejection';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'REVIEW_NOT_FOUND' THEN RAISE; END IF; END;
 r:=public.start_artifact_review(r.id,other_user,r.version);
 command:=command||jsonb_build_object('expectedVersion',r.version,'decision','revise_and_resubmit','actionItems',jsonb_build_array('Add the missing evidence'));
 BEGIN
  PERFORM public.complete_artifact_review(r.id,other_user,'invalid-version','invalid',command-'expectedVersion');
  RAISE EXCEPTION 'expected missing version rejection';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'REVIEW_CONFLICT' THEN RAISE; END IF; END;
 result:=public.complete_artifact_review(r.id,other_user,'revision','revision-hash',command);
 ASSERT result->>'decision'='revise_and_resubmit','revision decision lost';
 ASSERT (SELECT status='resubmission_required' AND sealed_at IS NULL FROM public.artifact_submissions WHERE id=submission),'revision sealed';
 ASSERT (SELECT xp_amount FROM public.xp_events WHERE source_id=submission)=1,'incorrect revision XP';
 ASSERT (SELECT module_status='mastered' FROM public.user_module_progress WHERE id=progress),'revision undid unrelated mastery';
 UPDATE public.artifact_submissions SET is_latest=false WHERE id=submission;
 next_submission:=gen_random_uuid();
 INSERT INTO public.artifact_submissions(id,artifact_id,user_id,user_module_progress_id,version_label,status,attempt_no,previous_submission_id)
 VALUES(next_submission,artifact,learner,progress,'v2','human_review',2,submission);
 r:=public.ensure_artifact_review(next_submission,learner,'human_revision_followup');
 r:=public.assign_artifact_review(r.id,scope_ref,'college_program',ARRAY[reviewer,other_user],3,'Asia/Kolkata',10);
 ASSERT r.reviewer_id=other_user,'follow-up lost eligible previous reviewer';
 UPDATE public.review_assignments SET due_by=now()-interval '1 hour' WHERE id=r.id;
 PERFORM public.schedule_review_deadlines(100);
 PERFORM public.schedule_review_deadlines(100);
 ASSERT (SELECT count(*) FROM public.review_outbox WHERE review_id=r.id AND event_type='lte.review_overdue')=1,'duplicate overdue escalation';
 SELECT * INTO leased FROM public.claim_review_outbox(1);
 ASSERT leased.lease_token IS NOT NULL,'outbox not leased';
 PERFORM public.finish_review_outbox(leased.id,gen_random_uuid(),true);
 ASSERT (SELECT delivered_at IS NULL FROM public.review_outbox WHERE id=leased.id),'foreign lease acknowledged';
 PERFORM public.finish_review_outbox(leased.id,leased.lease_token,true);
 ASSERT (SELECT delivered_at IS NOT NULL FROM public.review_outbox WHERE id=leased.id),'outbox delivery not acknowledged';
 -- Scope transfer revokes the old reviewer, preserves work and permits destination recovery.
 BEGIN
  PERFORM public.reconcile_artifact_review_scope(r.id,other_user,r.version,gen_random_uuid(),'school_class');
  RAISE EXCEPTION 'expected foreign learner rejection';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'REVIEW_NOT_FOUND' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.reconcile_artifact_review_scope(r.id,learner,r.version-1,gen_random_uuid(),'school_class');
  RAISE EXCEPTION 'expected scope version rejection';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'REVIEW_CONFLICT' THEN RAISE; END IF; END;
 scope_ref:=gen_random_uuid();
 r:=public.reconcile_artifact_review_scope(r.id,learner,r.version,scope_ref,'school_class');
 ASSERT r.status='unassigned' AND r.reviewer_id IS NULL AND r.started_at IS NULL AND r.due_by IS NULL,'old assignment survived scope transfer';
 ASSERT r.scope_id=scope_ref AND r.scope_type='school_class','destination scope not persisted';
 ASSERT EXISTS(SELECT 1 FROM public.review_audit WHERE review_id=r.id AND action='scope_reconciled' AND detail->>'previousReviewerId'=other_user::text),'scope transfer audit missing';
 ASSERT NOT EXISTS(SELECT 1 FROM public.review_outbox WHERE review_id=r.id AND delivered_at IS NULL AND cancelled_at IS NULL),'old scope delivery not cancelled';
 ASSERT (SELECT status='human_review' AND is_latest FROM public.artifact_submissions WHERE id=next_submission),'scope transfer changed learner evidence';
 BEGIN
  PERFORM public.start_artifact_review(r.id,other_user,r.version);
  RAISE EXCEPTION 'expected old reviewer rejection';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'REVIEW_NOT_FOUND' THEN RAISE; END IF; END;
 r:=public.reassign_artifact_review(r.id,other_user,reviewer,r.version,'Recover transferred learner review',scope_ref,'school_class',10,3,'Asia/Kolkata');
 r:=public.start_artifact_review(r.id,reviewer,r.version);
 command:=command||jsonb_build_object('expectedVersion',r.version,'decision','pass');
 result:=public.complete_artifact_review(r.id,reviewer,'transfer-pass','transfer-pass',command);
 ASSERT (SELECT status='accepted' FROM public.artifact_submissions WHERE id=next_submission),'transferred review could not complete';
 SELECT * INTO r FROM public.review_assignments WHERE id=r.id;
 BEGIN
  PERFORM public.reconcile_artifact_review_scope(r.id,learner,r.version,gen_random_uuid(),'school_class');
  RAISE EXCEPTION 'expected completed transfer rejection';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'REVIEW_CONFLICT' THEN RAISE; END IF; END;
 ASSERT NOT has_function_privilege('authenticated','public.reconcile_artifact_review_scope(uuid,uuid,integer,uuid,text)','EXECUTE'),'client scope transfer RPC';
 ASSERT NOT has_table_privilege('anon','public.review_assignments','SELECT'),'anon access';
 ASSERT NOT has_table_privilege('authenticated','public.review_assignments','INSERT'),'client assignment insertion';
 ASSERT NOT has_function_privilege('authenticated','public.complete_artifact_review(uuid,uuid,text,text,jsonb)','EXECUTE'),'client grading RPC';
 ASSERT public.review_business_deadline(1,'Asia/Kolkata','2026-10-02 04:30:00+00')='2026-10-05 04:30:00+00'::timestamptz,'business-day deadline';
END $$;
-- Access restrictions must work through grants with RLS disabled.
DO $$ DECLARE t text; BEGIN
 FOR t IN SELECT unnest(ARRAY['review_rubric_templates','review_assignments','review_commands','review_audit','review_outbox','review_rubric_criteria','review_criterion_scores']) LOOP
  ASSERT NOT (SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.'||t)), 'RLS enabled: '||t;
  ASSERT NOT has_table_privilege('anon','public.'||t,'SELECT,INSERT,UPDATE,DELETE'), 'anon access: '||t;
  ASSERT NOT has_table_privilege('authenticated','public.'||t,'SELECT,INSERT,UPDATE,DELETE'), 'browser access: '||t;
  ASSERT has_table_privilege('service_role','public.'||t,'SELECT'), 'missing backend read: '||t;
 END LOOP;
END $$;

ROLLBACK;
