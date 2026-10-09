BEGIN;
INSERT INTO public.users(id,email,first_name,last_name) VALUES('{{user}}','certificate-demo-{{user}}@example.test','Sample','Learner'),('{{other}}','certificate-other-{{other}}@example.test',NULL,NULL);
INSERT INTO public.capabilities(id,code,name,description) VALUES('{{capability}}','test-{{capabilityShort}}','Engineering foundations','Local certificate test');
INSERT INTO public.levels(id,level_code,capability_id,level_id,title,description,duration_minutes,difficulty_level)
SELECT '{{level}}','test-{{levelShort}}','{{capability}}',id,'Applied Problem Solving','Local certificate test',60,'beginner' FROM public.level_scale WHERE level_no=1;
INSERT INTO public.modules(id,level_id,module_no,title,description) VALUES('{{module}}','{{level}}',1,'Local certificate module','Local test');
INSERT INTO public.learning_tracks(id,user_id,assessment_id,fit,track,match_score,duration,why_it_fits) VALUES('{{track}}','{{user}}',gen_random_uuid(),'High','Engineering',80,'1','Local certificate test');
INSERT INTO public.roles(id,role_name,role_family_name,domain_name) VALUES('{{role}}','Local Test Engineer {{roleShort}}','Test','Test');
INSERT INTO public.learning_paths(id,learning_track_id,user_id,role_id,level,status,started_at) VALUES('{{path}}','{{track}}','{{user}}','{{role}}',1,'in_progress',now());
INSERT INTO public.user_capability_level_progress(id,user_id,learning_path_id,level_id,sequence_no,from_level,to_level,current_score,current_level,required_level,gap,gap_score,status,started_at)
VALUES('{{progress}}','{{user}}','{{path}}','{{level}}',1,0,1,0,0,1,1,1,'in_progress',now());
INSERT INTO public.user_module_progress(id,user_id,user_capability_level_progress_id,module_id,module_status,completion_percentage)
VALUES('{{moduleProgress}}','{{user}}','{{progress}}','{{module}}','completed',100);
COMMIT;
