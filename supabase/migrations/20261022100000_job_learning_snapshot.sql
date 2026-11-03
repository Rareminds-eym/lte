-- Qualification uses authoritative content and policy-specific evaluation, never XP or
-- the SkillPassport progress-card projection. One statement gives a consistent
-- snapshot. The content fingerprint pins jobs to what the reviewer assessed.
BEGIN;
CREATE OR REPLACE FUNCTION public.job_learning_snapshot(p_user uuid, p_levels uuid[], p_policy text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
WITH catalog AS (
 SELECT l.id, l.capability_id, l.title, c.name capability_name, l.level_code,
        s.level_no, l.version_no,
        md5(jsonb_build_object('level',to_jsonb(l),'capability',to_jsonb(c),'scale',to_jsonb(s),
          'modules',coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.id) FROM public.modules m WHERE m.level_id=l.id),'[]'),
          'content',coalesce((SELECT jsonb_agg(to_jsonb(mc) ORDER BY mc.id) FROM public.modules_content mc JOIN public.modules m ON m.id=mc.module_id WHERE m.level_id=l.id),'[]'),
          'eContent',coalesce((SELECT jsonb_agg(to_jsonb(ec) ORDER BY ec.id) FROM public.e_content ec JOIN public.modules_content mc ON mc.id=ec.modules_content_id JOIN public.modules m ON m.id=mc.module_id WHERE m.level_id=l.id),'[]'),
          'artifacts',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM public.module_artifacts a JOIN public.modules_content mc ON mc.id=a.modules_content_id JOIN public.modules m ON m.id=mc.module_id WHERE m.level_id=l.id),'[]'),
          'questions',coalesce((SELECT jsonb_agg(to_jsonb(q) ORDER BY q.id) FROM public.artifact_questions q JOIN public.module_artifacts a ON a.id=q.artifact_id JOIN public.modules_content mc ON mc.id=a.modules_content_id JOIN public.modules m ON m.id=mc.module_id WHERE m.level_id=l.id),'[]'),
          'templates',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) FROM public.artifact_templates t JOIN public.module_artifacts a ON a.id=t.artifact_id JOIN public.modules_content mc ON mc.id=a.modules_content_id JOIN public.modules m ON m.id=mc.module_id WHERE m.level_id=l.id),'[]')
        )::text) fingerprint,
        greatest(l.updated_at,c.updated_at,
          (SELECT max(m.updated_at) FROM public.modules m WHERE m.level_id=l.id),
          (SELECT max(mc.updated_at) FROM public.modules_content mc JOIN public.modules m ON m.id=mc.module_id WHERE m.level_id=l.id),
          (SELECT max(ec.updated_at) FROM public.e_content ec JOIN public.modules_content mc ON mc.id=ec.modules_content_id JOIN public.modules m ON m.id=mc.module_id WHERE m.level_id=l.id),
          (SELECT max(a.updated_at) FROM public.module_artifacts a JOIN public.modules_content mc ON mc.id=a.modules_content_id JOIN public.modules m ON m.id=mc.module_id WHERE m.level_id=l.id),
          (SELECT max(q.updated_at) FROM public.artifact_questions q JOIN public.module_artifacts a ON a.id=q.artifact_id JOIN public.modules_content mc ON mc.id=a.modules_content_id JOIN public.modules m ON m.id=mc.module_id WHERE m.level_id=l.id),
          (SELECT max(t.updated_at) FROM public.artifact_templates t JOIN public.module_artifacts a ON a.id=t.artifact_id JOIN public.modules_content mc ON mc.id=a.modules_content_id JOIN public.modules m ON m.id=mc.module_id WHERE m.level_id=l.id)
        ) changed_at
 FROM public.levels l JOIN public.capabilities c ON c.id=l.capability_id
 JOIN public.level_scale s ON s.id=l.level_id
 WHERE l.is_active AND l.status::text='published' AND c.is_active
 AND (p_levels IS NULL OR l.id=ANY(p_levels))
), required AS (
 SELECT c.id level_id, a.id artifact_id FROM catalog c
 JOIN public.modules m ON m.level_id=c.id AND m.is_active AND m.is_published
 JOIN public.modules_content mc ON mc.module_id=m.id AND mc.is_active
 JOIN public.module_artifacts a ON a.modules_content_id=mc.id AND a.is_active AND a.artifact_type::text='final'
), passes AS (
 SELECT DISTINCT r.level_id,r.artifact_id,s.id submission_id,ra.id review_id,ra.version,ef.id evaluation_id,ef.stage::text evaluation_type,ef.completed_at
 FROM required r JOIN catalog c ON c.id=r.level_id
 JOIN public.artifact_submissions s ON s.artifact_id=r.artifact_id AND s.user_id=p_user AND s.is_latest AND s.status='accepted'
 JOIN public.artifact_evaluation_flows ef ON ef.submission_id=s.id
 AND ef.is_current_stage AND ef.status='completed' AND ef.decision='pass'
 LEFT JOIN public.review_assignments ra ON ra.submission_id=s.id AND ra.learner_id=p_user AND ra.status='completed'
 WHERE ((ef.stage::text='staff_review' AND ef.evaluated_by=ra.reviewer_id AND ra.reviewer_id<>p_user)
 OR (p_policy='ai' AND ef.stage::text='ai' AND ef.overall_status='accepted'
  AND ef.metadata->>'provider'='openrouter' AND ef.metadata->>'evaluation_source'='ai'
  AND ef.metadata->>'requires_manual_review'='false'
  AND CASE WHEN jsonb_typeof(ef.metadata->'confidence')='number' THEN (ef.metadata->>'confidence')::numeric BETWEEN 60 AND 100 ELSE false END
  AND ef.metadata->'stage1_submission_check'->>'isAssessable'='true'
  AND ef.metadata->'stage2_critical_failures'->>'hasFailure'='false'
  AND CASE WHEN jsonb_typeof(ef.metadata->'rubric_rows')='array' THEN
   jsonb_array_length(ef.metadata->'rubric_rows')=5
   AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(ef.metadata->'rubric_rows') rr
    WHERE NOT CASE WHEN jsonb_typeof(rr->'score')='number' THEN (rr->>'score')::numeric BETWEEN 2 AND 3 ELSE false END
    OR rr->>'evidenceValid' IS DISTINCT FROM 'true') ELSE false END))
 -- Old approvals cannot silently certify subsequently changed content.
 AND ef.completed_at>=c.changed_at
), result AS (
 SELECT c.*,
  EXISTS(SELECT 1 FROM public.user_capability_level_progress p WHERE p.user_id=p_user AND p.level_id=c.id AND p.status='completed')
  AND EXISTS(SELECT 1 FROM required r WHERE r.level_id=c.id)
  AND NOT EXISTS(SELECT 1 FROM required r WHERE r.level_id=c.id AND NOT EXISTS(SELECT 1 FROM passes p WHERE p.level_id=r.level_id AND p.artifact_id=r.artifact_id)) earned,
  coalesce((SELECT jsonb_agg(jsonb_build_object('submissionId',p.submission_id,'reviewId',p.review_id,'reviewVersion',p.version,'evaluationId',p.evaluation_id,'evaluationType',p.evaluation_type,'reviewedAt',p.completed_at) ORDER BY p.artifact_id) FROM passes p WHERE p.level_id=c.id),'[]') evidence
 FROM catalog c
)
SELECT jsonb_build_object('schemaVersion',1,'evaluationPolicy',p_policy,
 'revision',md5(coalesce(jsonb_agg(jsonb_build_object('id',id,'fingerprint',fingerprint,'earned',earned,'evidence',evidence) ORDER BY id),'[]')::text),
 'levels',coalesce(jsonb_agg(jsonb_build_object('levelId',id,'capabilityId',capability_id,'capabilityName',capability_name,
 'title',title,'code',level_code,'levelNumber',level_no,'version',version_no,'fingerprint',fingerprint,
 'approved',earned,'evidence',evidence) ORDER BY capability_name,level_no,id),'[]')) FROM result;
$$;
CREATE OR REPLACE FUNCTION public.job_learning_snapshot(p_user uuid,p_levels uuid[] DEFAULT NULL)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$ SELECT public.job_learning_snapshot(p_user,p_levels,'human'); $$;
REVOKE ALL ON FUNCTION public.job_learning_snapshot(uuid,uuid[]),public.job_learning_snapshot(uuid,uuid[],text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.job_learning_snapshot(uuid,uuid[]),public.job_learning_snapshot(uuid,uuid[],text) TO service_role;
COMMIT;
