-- Execute against an isolated migrated LTE database. All fixtures roll back.
BEGIN;
DO $$
DECLARE
 org_a uuid[]; org_b uuid[]; learner_a1 uuid := gen_random_uuid(); learner_a2 uuid := gen_random_uuid(); learner_a3 uuid := gen_random_uuid();
 learner_b uuid := gen_random_uuid(); educator uuid := gen_random_uuid(); other_edu uuid := gen_random_uuid();
 capability uuid := gen_random_uuid(); scale uuid; level_ref uuid := gen_random_uuid(); module_ref uuid := gen_random_uuid();
 content_ref uuid := gen_random_uuid(); artifact uuid := gen_random_uuid(); track uuid := gen_random_uuid(); role_ref uuid := gen_random_uuid();
 path uuid := gen_random_uuid(); lp uuid := gen_random_uuid(); progress uuid := gen_random_uuid();
 s1 uuid := gen_random_uuid(); s2 uuid := gen_random_uuid(); s3 uuid := gen_random_uuid(); s4 uuid := gen_random_uuid();
 r1 uuid; r2 uuid; r3 uuid; r4 uuid; stats jsonb; page jsonb; one jsonb; load jsonb; u uuid;
BEGIN
 -- Fixture: one artifact, four learners (three in "our" organisation, one in another).
 FOREACH u IN ARRAY ARRAY[learner_a1,learner_a2,learner_a3,learner_b,educator,other_edu] LOOP
  INSERT INTO public.users(id,email) VALUES(u,'ov-'||u||'@example.test');
 END LOOP;
 INSERT INTO public.capabilities(id,code,name,description) VALUES(capability,'ov-'||left(capability::text,8),'Overview fixture','Test');
 INSERT INTO public.level_scale(id,level_no,level_label,generic_definition) VALUES(gen_random_uuid(),1,'Test','Test') ON CONFLICT(level_no) DO NOTHING;
 SELECT id INTO scale FROM public.level_scale WHERE level_no=1;
 INSERT INTO public.levels(id,level_code,capability_id,level_id,title,description,duration_minutes,difficulty_level) VALUES(level_ref,'ov-'||left(level_ref::text,8),capability,scale,'Overview level','Test',1,'beginner');
 INSERT INTO public.modules(id,level_id,module_no,title,description) VALUES(module_ref,level_ref,1,'Borrower intake','Test');
 INSERT INTO public.modules_content(id,module_id,stage_name,stage_order) VALUES(content_ref,module_ref,'express',4);
 INSERT INTO public.module_artifacts(id,modules_content_id,artifact_type,total_score) VALUES(artifact,content_ref,'final',100);
 INSERT INTO public.roles(id,role_name,role_family_name,domain_name) VALUES(role_ref,'Ov-'||role_ref,'Test','Test');
 -- One shared progress chain per learner is not needed for the read functions; submissions need a progress row, so create one per learner.
 FOREACH u IN ARRAY ARRAY[learner_a1,learner_a2,learner_a3,learner_b] LOOP
  track := gen_random_uuid(); path := gen_random_uuid(); lp := gen_random_uuid(); progress := gen_random_uuid();
  INSERT INTO public.learning_tracks(id,user_id,assessment_id,fit,track,match_score,duration,why_it_fits) VALUES(track,u,gen_random_uuid(),'High','Test',80,'1','Test');
  INSERT INTO public.learning_paths(id,learning_track_id,user_id,role_id,level) VALUES(path,track,u,role_ref,1);
  INSERT INTO public.user_capability_level_progress(id,user_id,learning_path_id,level_id,sequence_no,from_level,to_level,current_score,current_level,required_level,gap,gap_score)
   VALUES(lp,u,path,level_ref,1,0,1,0,0,1,1,1);
  INSERT INTO public.user_module_progress(id,user_id,user_capability_level_progress_id,module_id) VALUES(progress,u,lp,module_ref);
  IF u = learner_a1 THEN s1 := gen_random_uuid(); INSERT INTO public.artifact_submissions(id,artifact_id,user_id,user_module_progress_id,version_label,status) VALUES(s1,artifact,u,progress,'v1','human_review'); END IF;
  IF u = learner_a2 THEN s2 := gen_random_uuid(); INSERT INTO public.artifact_submissions(id,artifact_id,user_id,user_module_progress_id,version_label,status) VALUES(s2,artifact,u,progress,'v1','human_review'); END IF;
  IF u = learner_a3 THEN s3 := gen_random_uuid(); INSERT INTO public.artifact_submissions(id,artifact_id,user_id,user_module_progress_id,version_label,status) VALUES(s3,artifact,u,progress,'v1','human_review'); END IF;
  IF u = learner_b  THEN s4 := gen_random_uuid(); INSERT INTO public.artifact_submissions(id,artifact_id,user_id,user_module_progress_id,version_label,status) VALUES(s4,artifact,u,progress,'v1','human_review'); END IF;
 END LOOP;
 r1 := (public.ensure_artifact_review(s1,learner_a1,'human_only_scope')).id;   -- stays unassigned, no scope
 r2 := (public.ensure_artifact_review(s2,learner_a2,'low_confidence')).id;
 r3 := (public.ensure_artifact_review(s3,learner_a3,'low_confidence')).id;
 r4 := (public.ensure_artifact_review(s4,learner_b,'low_confidence')).id;
 -- r2: assigned and overdue; r3: assigned and on time; r4 belongs to ANOTHER organisation.
 PERFORM public.assign_artifact_review(r2,gen_random_uuid(),'college_program',ARRAY[educator],3,'Asia/Kolkata',10);
 PERFORM public.assign_artifact_review(r3,gen_random_uuid(),'college_program',ARRAY[educator],3,'Asia/Kolkata',10);
 PERFORM public.assign_artifact_review(r4,gen_random_uuid(),'college_program',ARRAY[other_edu],3,'Asia/Kolkata',10);
 UPDATE public.review_assignments SET due_by = now() - interval '2 days' WHERE id = r2;

 org_a := ARRAY[learner_a1,learner_a2,learner_a3];
 org_b := ARRAY[learner_b];

 -- Stats are limited to the learners passed in (organisation isolation).
 stats := public.admin_review_stats(org_a);
 ASSERT (stats->>'total')::int = 3, 'org A total';
 ASSERT (stats->>'unassigned')::int = 1, 'org A unassigned';
 ASSERT (stats->>'overdue')::int = 1, 'org A overdue';
 ASSERT (stats->>'active')::int = 2, 'org A active (pending)';
 ASSERT (stats->>'completed')::int = 0 AND (stats->>'returned')::int = 0, 'org A finished';
 ASSERT (public.admin_review_stats(org_b)->>'total')::int = 1, 'org B sees only its own';
 ASSERT (public.admin_review_stats(ARRAY[]::uuid[])->>'total')::int = 0, 'empty set yields nothing';
 ASSERT (public.admin_review_stats(NULL)->>'total')::int = 0, 'null set yields nothing';

 -- Listing: priority order = unassigned, overdue, then on-time active.
 page := public.admin_list_reviews(org_a,'all',25,0);
 ASSERT (page->>'total')::int = 3, 'list total';
 ASSERT (page->'items'->0->>'id')::uuid = r1, 'unassigned first';
 ASSERT (page->'items'->1->>'id')::uuid = r2, 'overdue second';
 ASSERT (page->'items'->2->>'id')::uuid = r3, 'on-time third';
 ASSERT (page->'items'->1->>'overdue')::boolean, 'overdue flag';
 ASSERT NOT (page->'items'->2->>'overdue')::boolean, 'on-time not overdue';
 ASSERT page->'items'->0->>'moduleTitle' = 'Borrower intake' AND page->'items'->0->>'levelTitle' = 'Overview level', 'artifact context joined';
 ASSERT (page->'items'->0->>'attemptNo')::int = 1, 'attempt number';
 ASSERT (page->'items'->0) ? 'reason' AND page->'items'->0->>'reason' = 'human_only_scope', 'reason exposed';
 -- Other organisation's review never leaks into org A's list.
 ASSERT NOT EXISTS (SELECT 1 FROM jsonb_array_elements(page->'items') i WHERE (i->>'id')::uuid = r4), 'no cross-organisation leak';

 -- Views filter correctly.
 ASSERT (public.admin_list_reviews(org_a,'unassigned',25,0)->>'total')::int = 1, 'unassigned view';
 ASSERT (public.admin_list_reviews(org_a,'overdue',25,0)->>'total')::int = 1, 'overdue view';
 ASSERT (public.admin_list_reviews(org_a,'active',25,0)->>'total')::int = 2, 'active view';
 ASSERT (public.admin_list_reviews(org_a,'completed',25,0)->>'total')::int = 0, 'completed view empty';

 -- Paging.
 ASSERT jsonb_array_length(public.admin_list_reviews(org_a,'all',2,0)->'items') = 2, 'page size';
 ASSERT jsonb_array_length(public.admin_list_reviews(org_a,'all',2,2)->'items') = 1, 'second page';
 ASSERT (public.admin_list_reviews(org_a,'all',2,2)->>'total')::int = 3, 'total ignores paging';

 -- Single review lookup, still bounded by the learner set.
 one := public.admin_list_reviews(org_a,'all',1,0,r3);
 ASSERT (one->>'total')::int = 1 AND (one->'items'->0->>'id')::uuid = r3, 'single lookup';
 ASSERT (public.admin_list_reviews(org_a,'all',1,0,r4)->>'total')::int = 0, 'single lookup cannot reach another organisation';

 -- An in-progress review counts as active work for its educator.
 PERFORM public.start_artifact_review(r3,educator,(SELECT version FROM public.review_assignments WHERE id=r3));
 ASSERT (public.admin_list_reviews(org_a,'active',25,0)->>'total')::int = 2, 'in-progress stays in the active view';

 -- Workload per educator.
 load := public.admin_reviewer_load(ARRAY[educator,other_edu,gen_random_uuid()]);
 ASSERT (load->>educator::text)::int = 2, 'educator has two open reviews';
 ASSERT (load->>other_edu::text)::int = 1, 'other educator has one';
 ASSERT jsonb_typeof(public.admin_reviewer_load(NULL)) = 'object', 'null-safe workload';

 -- Argument validation.
 BEGIN PERFORM public.admin_list_reviews(org_a,'bogus',25,0); RAISE EXCEPTION 'expected bad view rejection';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'INVALID_REVIEW_COMMAND' THEN RAISE; END IF; END;
 BEGIN PERFORM public.admin_list_reviews(org_a,'all',1000,0); RAISE EXCEPTION 'expected page size rejection';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'INVALID_REVIEW_COMMAND' THEN RAISE; END IF; END;
 BEGIN PERFORM public.admin_list_reviews(org_a,'all',25,-1); RAISE EXCEPTION 'expected offset rejection';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'INVALID_REVIEW_COMMAND' THEN RAISE; END IF; END;

 -- Service-only.
 ASSERT NOT has_function_privilege('authenticated','public.admin_list_reviews(uuid[],text,integer,integer,uuid)','EXECUTE'), 'browser can list';
 ASSERT NOT has_function_privilege('anon','public.admin_review_stats(uuid[])','EXECUTE'), 'anon can read stats';
 ASSERT NOT has_function_privilege('authenticated','public.admin_reviewer_load(uuid[])','EXECUTE'), 'browser can read load';
 ASSERT has_function_privilege('service_role','public.admin_list_reviews(uuid[],text,integer,integer,uuid)','EXECUTE'), 'backend cannot list';
END $$;
ROLLBACK;
