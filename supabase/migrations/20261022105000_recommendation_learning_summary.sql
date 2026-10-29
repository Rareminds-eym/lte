BEGIN;
CREATE FUNCTION public.job_learning_recommendation_summary(p_user uuid,p_policy text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
WITH completed AS (
  SELECT level_id,max(updated_at) changed_at FROM public.user_capability_level_progress
  WHERE user_id=p_user AND status='completed' GROUP BY level_id
), selected AS (
  SELECT level_id FROM completed ORDER BY changed_at DESC,level_id LIMIT 50
), snapshot AS (
  SELECT public.job_learning_snapshot(p_user,coalesce((SELECT array_agg(level_id) FROM selected),'{}'::uuid[]),p_policy) value
), approved AS (
  SELECT level FROM snapshot, jsonb_array_elements(value->'levels') level WHERE level->>'approved'='true'
), summary AS (
  SELECT coalesce(jsonb_agg(jsonb_build_object('levelId',level->'levelId','capabilityName',level->'capabilityName',
    'title',level->'title','levelNumber',level->'levelNumber','fingerprint',level->'fingerprint') ORDER BY level->>'levelId'),'[]'::jsonb) levels FROM approved
)
SELECT jsonb_build_object('schemaVersion',1,'evaluationPolicy',p_policy,'revision',
  md5(jsonb_build_object('policy',p_policy,'snapshot',(SELECT value->'revision' FROM snapshot),'total',(SELECT count(*) FROM completed))::text),
  'levels',levels,'truncated',(SELECT count(*)>50 FROM completed)) FROM summary;
$$;
REVOKE ALL ON FUNCTION public.job_learning_recommendation_summary(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.job_learning_recommendation_summary(uuid,text) TO service_role;
COMMIT;
