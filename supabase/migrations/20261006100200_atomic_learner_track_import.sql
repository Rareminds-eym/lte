-- Imports only learner tracks/progress and missing shadow roles, not catalog course data.
CREATE FUNCTION public.import_learner_tracks(p_user_id uuid,p_tracks jsonb,p_primary_track text)
RETURNS void LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE item jsonb; track_id uuid; path_id uuid; v_role_id uuid; track_ids jsonb:='{}';
BEGIN
 IF p_user_id IS NULL OR jsonb_typeof(p_tracks) IS DISTINCT FROM 'array' OR jsonb_array_length(p_tracks) NOT BETWEEN 1 AND 100
 OR p_primary_track IS NULL OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_tracks) t WHERE t->>'trackName'=p_primary_track) THEN
  RAISE EXCEPTION 'INVALID_LEARNING_TRACK_IMPORT';
 END IF;
 -- Lock the learner before changing their unique active track or capability ownership.
 PERFORM 1 FROM public.users WHERE id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'LEARNER_NOT_FOUND'; END IF;
 UPDATE public.learning_tracks SET is_active=false WHERE user_id=p_user_id AND is_active;
 -- Selected paths are processed last so shared role progress belongs to the selected track.
 FOR item IN SELECT value FROM jsonb_array_elements(p_tracks) WITH ORDINALITY t(value,n)
 ORDER BY (value->>'trackName'=p_primary_track),n LOOP
  v_role_id:=(item->>'roleId')::uuid;
  INSERT INTO public.roles(id,role_name,role_family_name,domain_name)
  VALUES(v_role_id,left(item->>'roleName',255),left(item->>'trackName',255),left(coalesce(nullif(item->>'industry',''),'General'),500))
  ON CONFLICT(id) DO NOTHING;
  track_id:=(track_ids->>(item->>'trackName'))::uuid;
  IF track_id IS NULL THEN
   INSERT INTO public.learning_tracks(user_id,assessment_id,fit,track,match_score,why_it_fits,duration,is_active)
   VALUES(p_user_id,(item->>'attemptId')::uuid,item->>'fit',item->>'trackName',(item->>'matchScore')::integer,item->>'whyItFits','6 months',item->>'trackName'=p_primary_track)
   ON CONFLICT(user_id,assessment_id,track) DO UPDATE SET fit=EXCLUDED.fit,match_score=EXCLUDED.match_score,
    why_it_fits=EXCLUDED.why_it_fits,is_active=EXCLUDED.is_active
   RETURNING id INTO track_id;
   track_ids:=track_ids||jsonb_build_object(item->>'trackName',track_id);
  END IF;
  INSERT INTO public.learning_paths(user_id,learning_track_id,role_id,level,metadata)
  VALUES(p_user_id,track_id,v_role_id,1,CASE WHEN item->>'industry' IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('industry',item->>'industry') END)
  ON CONFLICT(user_id,learning_track_id,role_id) DO UPDATE SET metadata=EXCLUDED.metadata
  RETURNING id INTO path_id;
  INSERT INTO public.user_capabilities(user_id,learning_path_id,role_sequence_id,current_level,required_level,gap,has_gap,gap_score)
  SELECT p_user_id,path_id,seq.id,0,
    CASE WHEN seq.required_level::text ~ '^L[1-5]$' THEN right(seq.required_level::text,1)::integer ELSE 1 END,
    CASE WHEN seq.required_level::text ~ '^L[1-5]$' THEN right(seq.required_level::text,1)::integer ELSE 1 END,true,0
  FROM public.role_capability_sequence seq WHERE seq.role_id=v_role_id
  ON CONFLICT(user_id,role_sequence_id) DO UPDATE SET learning_path_id=EXCLUDED.learning_path_id,
    required_level=EXCLUDED.required_level,gap=greatest(0,EXCLUDED.required_level-public.user_capabilities.current_level),
    has_gap=EXCLUDED.required_level>public.user_capabilities.current_level,
    gap_score=round(public.user_capabilities.current_level::numeric/EXCLUDED.required_level*100),updated_at=now();
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.import_learner_tracks(uuid,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.import_learner_tracks(uuid,jsonb,text) TO service_role;
