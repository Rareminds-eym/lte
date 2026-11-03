-- Service-only keyset pagination: deadlines and UUIDs form a stable total order.
CREATE FUNCTION public.list_artifact_review_queue(p_actor_id uuid,p_after_due timestamptz,p_after_id uuid,p_limit integer DEFAULT 26)
RETURNS SETOF public.review_assignments LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
 SELECT * FROM public.review_assignments WHERE reviewer_id=p_actor_id AND status IN ('pending','in_progress')
 AND (p_after_due IS NULL OR (due_by,id)>(p_after_due,p_after_id))
 ORDER BY due_by,id LIMIT least(greatest(p_limit,1),100);
$$;
REVOKE ALL ON FUNCTION public.list_artifact_review_queue(uuid,timestamptz,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.list_artifact_review_queue(uuid,timestamptz,uuid,integer) TO service_role;
