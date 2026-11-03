BEGIN;
DO $$ DECLARE learner uuid:=gen_random_uuid(); role_ref uuid:=gen_random_uuid(); assessment uuid:=gen_random_uuid();
 tracks jsonb; active_id uuid; capability uuid:=gen_random_uuid(); sequence_id uuid:=gen_random_uuid(); BEGIN
 INSERT INTO public.users(id,email) VALUES(learner,'import-'||learner||'@example.test');
 tracks:=jsonb_build_array(jsonb_build_object('attemptId',assessment,'roleId',role_ref,'roleName','Role '||role_ref,'trackName','Engineering','fit','High','matchScore',80,'whyItFits','Fit'));
 PERFORM public.import_learner_tracks(learner,tracks,'Engineering');
 SELECT id INTO active_id FROM public.learning_tracks WHERE user_id=learner AND is_active;
 ASSERT active_id IS NOT NULL,'missing active track';
 INSERT INTO public.capabilities(id,code,name,description) VALUES(capability,'import-'||capability,'Import fixture','Test');
 INSERT INTO public.role_capability_sequence(id,role_id,capability_id,sequence_step,required_level) VALUES(sequence_id,role_ref,capability,1,'L3');
 PERFORM public.import_learner_tracks(learner,tracks,'Engineering');
 ASSERT (SELECT count(*) FROM public.learning_tracks WHERE user_id=learner)=1,'repeated import duplicated track';
 ASSERT (SELECT count(*) FROM public.learning_paths WHERE user_id=learner)=1,'repeated import duplicated path';
 ASSERT (SELECT required_level=3 AND current_level=0 AND gap=3 AND has_gap FROM public.user_capabilities WHERE user_id=learner AND role_sequence_id=sequence_id),'missing initial capability progress';
 UPDATE public.user_capabilities SET current_level=2,badge='bronze' WHERE user_id=learner AND role_sequence_id=sequence_id;
 PERFORM public.import_learner_tracks(learner,tracks,'Engineering');
 ASSERT (SELECT current_level=2 AND badge='bronze' AND gap=1 AND gap_score=67 FROM public.user_capabilities WHERE user_id=learner AND role_sequence_id=sequence_id),'refresh reset earned progress';
 BEGIN
  PERFORM public.import_learner_tracks(learner,tracks||jsonb_build_array(jsonb_build_object('attemptId',assessment,'roleId',gen_random_uuid(),'roleName','Bad','trackName','Invalid','fit','Invalid fit','matchScore',80,'whyItFits','Bad')),'Engineering');
  RAISE EXCEPTION 'expected invalid fit';
 EXCEPTION WHEN check_violation THEN NULL; END;
 ASSERT (SELECT is_active FROM public.learning_tracks WHERE id=active_id),'failed import lost active track';
 ASSERT (SELECT count(*) FROM public.learning_tracks WHERE user_id=learner)=1,'partial track committed';
 ASSERT NOT EXISTS(SELECT 1 FROM public.roles WHERE role_name='Bad' AND role_family_name='Invalid'),'partial shadow role committed';
END $$;
ROLLBACK;
