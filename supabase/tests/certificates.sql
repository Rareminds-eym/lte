-- Run only against an isolated migrated database; every fixture is rolled back.
BEGIN;
DO $$
DECLARE
 learner uuid := gen_random_uuid(); actor uuid := gen_random_uuid();
 capability uuid := gen_random_uuid(); scale uuid; level_ref uuid := gen_random_uuid();
 track uuid := gen_random_uuid(); track2 uuid := gen_random_uuid(); role_ref uuid := gen_random_uuid(); path uuid := gen_random_uuid(); path2 uuid := gen_random_uuid(); lp uuid := gen_random_uuid();
 cert uuid; pending uuid; command text; column_name text; replacement public.certificates; replay public.certificates;
BEGIN
 INSERT INTO public.users(id,email) VALUES(learner,'certificate-'||learner||'@example.test'),(actor,'actor-'||actor||'@example.test');
 INSERT INTO public.capabilities(id,code,name,description) VALUES(capability,'cert-'||left(capability::text,8),'Certificate fixture','Test');
 INSERT INTO public.level_scale(level_no,level_label,generic_definition) VALUES(1,'Test','Test') ON CONFLICT(level_no) DO NOTHING;
 SELECT id INTO scale FROM public.level_scale WHERE level_no=1;
 INSERT INTO public.levels(id,level_code,capability_id,level_id,title,description,duration_minutes,difficulty_level) VALUES(level_ref,'cert-'||left(level_ref::text,8),capability,scale,'Test','Test',1,'beginner');
 INSERT INTO public.learning_tracks(id,user_id,assessment_id,fit,track,match_score,duration,why_it_fits) VALUES(track,learner,gen_random_uuid(),'High','Test',80,'1','Test');
 INSERT INTO public.learning_tracks(id,user_id,assessment_id,fit,track,match_score,duration,why_it_fits) VALUES(track2,learner,gen_random_uuid(),'High','Test 2',80,'1','Test');
 INSERT INTO public.roles(id,role_name,role_family_name,domain_name) VALUES(role_ref,'Test-'||role_ref,'Test','Test');
 INSERT INTO public.learning_paths(id,learning_track_id,user_id,role_id,level,version_no,is_latest) VALUES(path,track,learner,role_ref,1,1,false),(path2,track2,learner,role_ref,1,2,true);
 INSERT INTO public.user_capability_level_progress(id,user_id,learning_path_id,level_id,sequence_no,from_level,to_level,current_score,current_level,required_level,gap,gap_score)
 VALUES(lp,learner,path,level_ref,1,0,1,0,0,1,1,1);
 INSERT INTO public.certificates(credential_id,user_id,certificate_type,status,level_id,learning_path_id,level_progress_id,learner_name,title,completion_date,issued_at)
 VALUES('LTE-0000000000000001',learner,'course_completion','issued',level_ref,path,lp,'Learner','Course',now(),now()) RETURNING id INTO cert;
 INSERT INTO public.certificates(credential_id,user_id,certificate_type,role_id,title,completion_date)
 VALUES('LTE-0000000000000002',learner,'role_readiness',role_ref,'Role',now()) RETURNING id INTO pending;
 BEGIN
  INSERT INTO public.certificates(credential_id,user_id,certificate_type,level_id,learning_path_id,title,completion_date)
  VALUES('LTE-0000000000000003',learner,'course_completion',level_ref,path2,'Duplicate',now());
  RAISE EXCEPTION 'natural-key duplicate accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN
  INSERT INTO public.certificates(credential_id,user_id,certificate_type,role_id,title,completion_date)
  VALUES('LTE-0000000000000003',learner,'role_readiness',role_ref,'Duplicate',now());
  RAISE EXCEPTION 'role duplicate accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 FOREACH command IN ARRAY ARRAY[
  'learner_name=''Changed''','title=''Changed''','subtitle=''Changed''','level_label=''Level 5''','badge=''mastery''',
  'completion_date=now()+interval ''1 day''','metadata=''{}''::jsonb || ''{"changed":true}''::jsonb','issued_at=now()+interval ''1 day''',
  'id=gen_random_uuid()','credential_id=''LTE-0000000000000004''','user_id='''||actor||'''','certificate_type=''role_readiness''',
  'level_id=NULL','role_id='''||role_ref||'''','created_at=now()+interval ''1 day''','status=''pending_name''',
  'learning_path_id='''||path2||'''','revoked_reason=''premature'''
 ] LOOP
  BEGIN EXECUTE 'UPDATE public.certificates SET '||command||' WHERE id='||quote_literal(cert); RAISE EXCEPTION 'illegal mutation accepted: %',command;
  EXCEPTION WHEN check_violation THEN NULL; END;
 END LOOP;
 -- Pending identity and subject constraints remain enforced.
 FOREACH command IN ARRAY ARRAY['credential_id=''bad''','level_id='''||level_ref||'''','role_id=NULL','certificate_type=''course_completion''','status=''issued''','status=''revoked''','pdf_object_key=''bad'''] LOOP
  BEGIN EXECUTE 'UPDATE public.certificates SET '||command||' WHERE id='||quote_literal(pending); RAISE EXCEPTION 'invalid pending mutation accepted: %',command;
  EXCEPTION WHEN check_violation THEN NULL; END;
 END LOOP;
 BEGIN
  INSERT INTO public.certificates(credential_id,user_id,certificate_type,level_id,title,completion_date) VALUES('bad',actor,'course_completion',level_ref,'Bad',now());
  RAISE EXCEPTION 'malformed ID accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
  UPDATE public.certificates SET learner_name=' ',issued_at=now(),status='issued' WHERE id=pending;
  RAISE EXCEPTION 'blank learner accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 UPDATE public.certificates SET learner_name='Learner',issued_at=now(),status='issued' WHERE id=pending;
 UPDATE public.certificates SET pdf_object_key='certificates/test',pdf_template_version=1,pdf_generated_at=now() WHERE id=cert;
 BEGIN UPDATE public.certificates SET status='revoked' WHERE id=cert; RAISE EXCEPTION 'missing revocation date accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN UPDATE public.certificates SET status='revoked',revoked_at=now(),pdf_object_key='changed' WHERE id=cert; RAISE EXCEPTION 'PDF changed during revocation';
 EXCEPTION WHEN check_violation THEN NULL; END;
 UPDATE public.certificates SET status='revoked',revoked_at=now(),revoked_reason='Test',revoked_by=actor WHERE id=cert;
 FOREACH command IN ARRAY ARRAY['status=''issued''','revoked_at=now()+interval ''1 day''','revoked_reason=''Changed''','revoked_by='''||learner||'''','pdf_object_key=''changed''','pdf_template_version=2','pdf_generated_at=now()+interval ''1 day''','title=''changed'''] LOOP
  BEGIN EXECUTE 'UPDATE public.certificates SET '||command||' WHERE id='||quote_literal(cert); RAISE EXCEPTION 'revoked mutation accepted: %',command;
  EXCEPTION WHEN check_violation THEN NULL; END;
 END LOOP;
 -- Replacement is explicit, atomic, idempotent and retains revoked history.
 BEGIN
  PERFORM public.replace_certificate(pending,actor,'collision','LTE-0000000000000001','{}');
  RAISE EXCEPTION 'credential collision accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 ASSERT (SELECT status='issued' FROM public.certificates WHERE id=pending), 'failed replacement left original revoked';
 BEGIN
  PERFORM public.replace_certificate(pending,actor,'bad patch','LTE-0000000000000005','{"user_id":null}');
  RAISE EXCEPTION 'identity patch accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 SELECT * INTO replacement FROM public.replace_certificate(cert,actor,'correct name','LTE-0000000000000005','{"learner_name":"Corrected Learner"}');
 ASSERT replacement.supersedes_id=cert AND replacement.status='issued' AND replacement.learner_name='Corrected Learner', 'replacement snapshot wrong';
 ASSERT replacement.pdf_object_key IS NULL, 'replacement reused old PDF';
 ASSERT (SELECT status='revoked' AND learner_name='Learner' FROM public.certificates WHERE id=cert), 'old record changed';
 SELECT * INTO replay FROM public.replace_certificate(cert,actor,'repeat','LTE-0000000000000006','{"learner_name":"Different"}');
 ASSERT replay.id=replacement.id AND replay.learner_name='Corrected Learner', 'replacement was not idempotent';
 BEGIN
  UPDATE public.certificates SET supersedes_id=NULL WHERE id=replacement.id;
  RAISE EXCEPTION 'replacement lineage changed';
 EXCEPTION WHEN check_violation THEN NULL; END;
 SELECT * INTO replay FROM public.replace_certificate(pending,actor,'correct title','LTE-0000000000000006','{"title":"Corrected Role"}');
 ASSERT (SELECT status='revoked' FROM public.certificates WHERE id=pending), 'issued original not revoked atomically';
 ASSERT replay.status='issued' AND replay.title='Corrected Role', 'role replacement failed';
 ASSERT NOT has_function_privilege('anon','public.replace_certificate(uuid,uuid,text,text,jsonb)','EXECUTE'), 'anon replacement';
 ASSERT NOT has_function_privilege('authenticated','public.replace_certificate(uuid,uuid,text,text,jsonb)','EXECUTE'), 'learner replacement';
 ASSERT has_function_privilege('service_role','public.replace_certificate(uuid,uuid,text,text,jsonb)','EXECUTE'), 'service replacement missing';
 DELETE FROM public.learning_paths WHERE id=path;
 ASSERT (SELECT learning_path_id IS NULL AND level_progress_id IS NULL FROM public.certificates WHERE id=cert), 'certificate provenance prevented reimport';
 DELETE FROM public.users WHERE id=actor;
 ASSERT (SELECT revoked_by IS NULL FROM public.certificates WHERE id=cert), 'actor erasure blocked';
 ASSERT NOT has_table_privilege('anon','public.certificates','SELECT,INSERT,UPDATE,DELETE'), 'anon access';
 ASSERT NOT has_table_privilege('authenticated','public.certificates','SELECT,INSERT,UPDATE,DELETE'), 'authenticated access';
 ASSERT has_table_privilege('service_role','public.certificates','SELECT,INSERT,UPDATE'), 'service role missing grants';
 ASSERT NOT has_table_privilege('service_role','public.certificates','DELETE'), 'service deletion allowed';
 INSERT INTO public.xp_events(user_id,event_type,xp_category,xp_amount,source_type,source_id,idempotency_key) VALUES(learner,'certificate_earned','engagement',50,'certificates',cert,'cert:'||learner||':'||cert);
 DELETE FROM public.users WHERE id=learner;
 ASSERT NOT EXISTS(SELECT 1 FROM public.certificates WHERE user_id=learner),'erasure did not cascade';
END $$;
ROLLBACK;
