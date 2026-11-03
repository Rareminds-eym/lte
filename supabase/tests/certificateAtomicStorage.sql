BEGIN;
DO $$
DECLARE
  learner uuid := gen_random_uuid(); role_ref uuid := gen_random_uuid();
  result jsonb; saved public.certificates; again public.certificates;
  upload_key text; token uuid := gen_random_uuid(); job public.certificate_storage_cleanup;
BEGIN
  INSERT INTO public.users(id,email) VALUES(learner,'atomic-'||learner||'@example.test');
  INSERT INTO public.roles(id,role_name,role_family_name,domain_name) VALUES(role_ref,'Atomic-'||role_ref,'Test','Test');
  result := public.issue_certificate_atomic(learner,'LTE-0000000000000010','role_readiness','pending_name',
    NULL,role_ref,NULL,NULL,NULL,'Role',NULL,NULL,NULL,now(),'{}',NULL,50);
  SELECT * INTO saved FROM public.certificates WHERE id=(result->'certificate'->>'id')::uuid;
  ASSERT (result->>'created')::boolean AND saved.status='pending_name', 'pending creation failed';
  ASSERT NOT EXISTS(SELECT 1 FROM public.xp_events WHERE user_id=learner), 'pending awarded XP';
  BEGIN
    PERFORM public.finalize_certificate_name_atomic(learner,saved.id,'Learner',now(),NULL);
    RAISE EXCEPTION 'invalid XP accepted';
  EXCEPTION WHEN not_null_violation OR invalid_parameter_value THEN NULL; END;
  ASSERT (SELECT status='pending_name' FROM public.certificates WHERE id=saved.id), 'XP failure did not roll back issuance';
  SELECT * INTO saved FROM public.finalize_certificate_name_atomic(learner,saved.id,'Learner',now(),50);
  ASSERT saved.status='issued', 'finalization failed';
  ASSERT (SELECT count(*)=1 FROM public.xp_events WHERE user_id=learner AND event_type='certificate_earned'), 'XP missing';
  SELECT * INTO again FROM public.finalize_certificate_name_atomic(learner,saved.id,'Different',now(),50);
  ASSERT again.id IS NULL, 'finalization replay changed snapshot';
  result := public.issue_certificate_atomic(learner,'LTE-0000000000000011','role_readiness','issued',
    NULL,role_ref,NULL,NULL,'Different','Different',NULL,NULL,NULL,now(),'{}',now(),50);
  ASSERT NOT (result->>'created')::boolean AND (result->'certificate'->>'id')::uuid=saved.id, 'issue replay was not idempotent';
  ASSERT (SELECT count(*)=1 FROM public.xp_events WHERE user_id=learner AND event_type='certificate_earned'), 'duplicate XP';

  upload_key := 'certificates/users/'||learner||'/'||saved.credential_id||'/'||repeat('a',32)||'-certificate.pdf';
  PERFORM public.register_certificate_pdf_upload(saved.id,upload_key);
  ASSERT EXISTS(SELECT 1 FROM public.certificate_storage_cleanup WHERE object_key=upload_key), 'upload intent missing';
  BEGIN
    PERFORM public.register_certificate_pdf_upload(saved.id,'certificates/users/'||gen_random_uuid()||'/bad');
    RAISE EXCEPTION 'outside owner key accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  UPDATE public.certificates SET pdf_object_key=upload_key,pdf_template_version=2,pdf_generated_at=now() WHERE id=saved.id;
  UPDATE public.certificates SET pdf_object_key=replace(upload_key,repeat('a',32),repeat('b',32)) WHERE id=saved.id;
  ASSERT (SELECT count(*)=2 FROM public.certificate_storage_cleanup WHERE object_key=upload_key), 'superseded cache cleanup missing';

  UPDATE public.certificate_storage_cleanup SET available_at=now()-interval '1 second' WHERE user_id=learner;
  SELECT * INTO job FROM public.claim_certificate_storage_cleanup(token,1);
  ASSERT job.lease_token=token AND job.attempts=1, 'lease claim failed';
  PERFORM public.finish_certificate_storage_cleanup(job.id,gen_random_uuid(),true);
  ASSERT EXISTS(SELECT 1 FROM public.certificate_storage_cleanup WHERE id=job.id), 'wrong lease acknowledged';
  PERFORM public.finish_certificate_storage_cleanup(job.id,token,false);
  ASSERT (SELECT lease_token IS NULL AND available_at>now() FROM public.certificate_storage_cleanup WHERE id=job.id), 'failure lost durable retry';
  DELETE FROM public.users WHERE id=learner;
  ASSERT NOT EXISTS(SELECT 1 FROM public.certificates WHERE user_id=learner), 'certificate erasure did not cascade';
  ASSERT EXISTS(SELECT 1 FROM public.certificate_storage_cleanup WHERE user_id=learner AND prefix='certificates/users/'||learner||'/'), 'learner erasure prefix missing';
  ASSERT NOT has_table_privilege('anon','public.certificate_storage_cleanup','SELECT,INSERT,UPDATE,DELETE'), 'public cleanup access';
  ASSERT NOT has_function_privilege('authenticated','public.register_certificate_pdf_upload(uuid,text)','EXECUTE'), 'learner upload registration';
  ASSERT NOT has_function_privilege('anon','public.claim_certificate_storage_cleanup(uuid,integer)','EXECUTE'), 'public cleanup claim';
  ASSERT has_function_privilege('service_role','public.claim_certificate_storage_cleanup(uuid,integer)','EXECUTE'), 'service cleanup claim missing';
END $$;
ROLLBACK;
