-- Organisation-wide review management for institution administrators.
--
-- The caller (the LTE service) resolves WHICH learners belong to the
-- administrator's organisation through the SkillPassport authority and passes
-- only those learner IDs here; these functions never widen that set. They are
-- service-only and read-only.

-- Counts over all reviews of the given learners (independent of any filter).
CREATE FUNCTION public.admin_review_stats(p_learner_ids uuid[])
RETURNS jsonb LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object(
  'total', count(*),
  'unassigned', count(*) FILTER (WHERE status='unassigned'),
  'overdue', count(*) FILTER (WHERE status IN ('pending','in_progress') AND due_by < now()),
  'active', count(*) FILTER (WHERE status IN ('pending','in_progress')),
  'completed', count(*) FILTER (WHERE status='completed'),
  'returned', count(*) FILTER (WHERE status='returned'),
  'oldestUnassignedAt', min(required_at) FILTER (WHERE status='unassigned')
 )
 FROM public.review_assignments
 WHERE learner_id = ANY(coalesce(p_learner_ids,ARRAY[]::uuid[]));
$$;

-- One page of reviews. Order: work that needs action first (unassigned, then
-- overdue, then in review, by urgency), then finished work, newest first.
CREATE FUNCTION public.admin_list_reviews(p_learner_ids uuid[],p_view text,p_limit integer,p_offset integer,p_review_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=public,pg_temp AS $$
DECLARE result jsonb;
BEGIN
 IF p_view IS NULL OR p_view NOT IN ('all','unassigned','overdue','active','completed','returned')
  OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR p_offset IS NULL OR p_offset < 0
  OR cardinality(coalesce(p_learner_ids,ARRAY[]::uuid[])) > 20000 THEN
  RAISE EXCEPTION 'INVALID_REVIEW_COMMAND';
 END IF;
 WITH base AS (
  SELECT ra.*,
   (ra.status IN ('pending','in_progress') AND ra.due_by < now()) AS is_overdue,
   CASE WHEN ra.status='unassigned' THEN 0
        WHEN ra.status IN ('pending','in_progress') AND ra.due_by < now() THEN 1
        WHEN ra.status IN ('pending','in_progress') THEN 2
        ELSE 3 END AS priority
  FROM public.review_assignments ra
  WHERE ra.learner_id = ANY(coalesce(p_learner_ids,ARRAY[]::uuid[]))
   AND (p_review_id IS NULL OR ra.id = p_review_id)
   AND CASE p_view
        WHEN 'all' THEN true
        WHEN 'unassigned' THEN ra.status='unassigned'
        WHEN 'overdue' THEN ra.status IN ('pending','in_progress') AND ra.due_by < now()
        WHEN 'active' THEN ra.status IN ('pending','in_progress')
        WHEN 'completed' THEN ra.status='completed'
        WHEN 'returned' THEN ra.status='returned'
       END
 ), ranked AS (
  SELECT b.*, row_number() OVER (
    ORDER BY b.priority,
      CASE WHEN b.priority < 3 THEN extract(epoch FROM coalesce(b.due_by,b.required_at)) END ASC NULLS LAST,
      b.completed_at DESC NULLS LAST, b.id) AS rn
  FROM base b
 ), page AS (
  SELECT * FROM ranked WHERE rn > p_offset AND rn <= p_offset + p_limit
 )
 SELECT jsonb_build_object(
  'total', (SELECT count(*) FROM base),
  'items', coalesce((SELECT jsonb_agg(jsonb_build_object(
    'id', p.id, 'submissionId', p.submission_id, 'learnerId', p.learner_id,
    'reviewerId', p.reviewer_id, 'status', p.status, 'version', p.version,
    'reason', p.reason, 'scopeId', p.scope_id, 'scopeType', p.scope_type,
    'requiredAt', p.required_at, 'assignedAt', p.assigned_at, 'startedAt', p.started_at,
    'completedAt', p.completed_at, 'dueBy', p.due_by, 'overdue', p.is_overdue,
    'attemptNo', s.attempt_no, 'submittedAt', s.submitted_at,
    'artifactType', a.artifact_type, 'moduleTitle', m.title, 'levelTitle', l.title,
    'outcomeDecision', o.decision, 'outcomeScore', o.score
   ) ORDER BY p.rn)
   FROM page p
   JOIN public.artifact_submissions s ON s.id = p.submission_id
   LEFT JOIN public.module_artifacts a ON a.id = s.artifact_id
   LEFT JOIN public.modules_content mc ON mc.id = a.modules_content_id
   LEFT JOIN public.modules m ON m.id = mc.module_id
   LEFT JOIN public.levels l ON l.id = m.level_id
   LEFT JOIN LATERAL (
     SELECT f.decision, f.score FROM public.artifact_evaluation_flows f
     WHERE f.submission_id = p.submission_id AND f.stage = 'staff_review'
     ORDER BY f.completed_at DESC NULLS LAST LIMIT 1
   ) o ON true
  ), '[]'::jsonb)) INTO result;
 RETURN result;
END $$;

-- Open (pending / in progress) reviews per educator, so an administrator can see
-- who has capacity when assigning. Returns { "<reviewerId>": count }.
CREATE FUNCTION public.admin_reviewer_load(p_reviewer_ids uuid[])
RETURNS jsonb LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
 SELECT coalesce(jsonb_object_agg(reviewer_id::text, n), '{}'::jsonb)
 FROM (
  SELECT reviewer_id, count(*) AS n FROM public.review_assignments
  WHERE reviewer_id = ANY(coalesce(p_reviewer_ids,ARRAY[]::uuid[])) AND status IN ('pending','in_progress')
  GROUP BY reviewer_id
 ) t;
$$;

REVOKE ALL ON FUNCTION public.admin_review_stats(uuid[]) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.admin_list_reviews(uuid[],text,integer,integer,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.admin_reviewer_load(uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_stats(uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_reviews(uuid[],text,integer,integer,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_reviewer_load(uuid[]) TO service_role;
