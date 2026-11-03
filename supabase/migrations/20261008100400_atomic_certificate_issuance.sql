-- Issue/finalize certificate snapshots and their XP event in one transaction.
BEGIN;

CREATE FUNCTION public.issue_certificate_atomic(
  p_user_id uuid,
  p_credential_id text,
  p_certificate_type public.certificate_type,
  p_status public.certificate_status,
  p_level_id uuid,
  p_role_id uuid,
  p_learning_path_id uuid,
  p_level_progress_id uuid,
  p_learner_name text,
  p_title text,
  p_subtitle text,
  p_level_label text,
  p_badge text,
  p_completion_date timestamptz,
  p_metadata jsonb,
  p_issued_at timestamptz,
  p_xp_amount integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  saved public.certificates;
  was_created boolean := false;
BEGIN
  IF p_xp_amount IS NULL OR p_xp_amount < 0 THEN
    RAISE EXCEPTION 'INVALID_CERTIFICATE_XP' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      p_user_id::text || ':' || p_certificate_type::text || ':' || coalesce(p_level_id, p_role_id)::text,
      0
    )
  );

  SELECT * INTO saved
  FROM public.certificates
  WHERE user_id = p_user_id
    AND (
      (p_certificate_type = 'course_completion' AND level_id = p_level_id)
      OR (p_certificate_type = 'role_readiness' AND role_id = p_role_id)
    )
  ORDER BY status ASC, created_at DESC, id DESC
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.certificates(
      credential_id, user_id, certificate_type, status, level_id, role_id,
      learning_path_id, level_progress_id, learner_name, title, subtitle,
      level_label, badge, completion_date, metadata, issued_at
    ) VALUES (
      p_credential_id, p_user_id, p_certificate_type, p_status, p_level_id, p_role_id,
      p_learning_path_id, p_level_progress_id, p_learner_name, p_title, p_subtitle,
      p_level_label, p_badge, p_completion_date, coalesce(p_metadata, '{}'::jsonb), p_issued_at
    ) RETURNING * INTO saved;
    was_created := true;
  END IF;

  IF saved.status = 'issued' AND saved.supersedes_id IS NULL THEN
    INSERT INTO public.xp_events(
      user_id, event_type, xp_category, xp_amount, source_type, source_id,
      idempotency_key, metadata
    ) VALUES (
      saved.user_id, 'certificate_earned', 'engagement', p_xp_amount,
      'certificates', saved.id, 'cert:' || saved.user_id || ':' || saved.id,
      jsonb_build_object(
        'credential_id', saved.credential_id,
        'certificate_type', saved.certificate_type
      )
    ) ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN jsonb_build_object('certificate', to_jsonb(saved), 'created', was_created);
END;
$$;

CREATE FUNCTION public.finalize_certificate_name_atomic(
  p_user_id uuid,
  p_certificate_id uuid,
  p_learner_name text,
  p_issued_at timestamptz,
  p_xp_amount integer
) RETURNS public.certificates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  saved public.certificates;
BEGIN
  IF p_xp_amount IS NULL OR p_xp_amount < 0 THEN
    RAISE EXCEPTION 'INVALID_CERTIFICATE_XP' USING ERRCODE = '22023';
  END IF;
  UPDATE public.certificates
  SET learner_name = p_learner_name, status = 'issued', issued_at = p_issued_at
  WHERE id = p_certificate_id AND user_id = p_user_id AND status = 'pending_name'
  RETURNING * INTO saved;

  IF NOT FOUND THEN RETURN NULL; END IF;

  INSERT INTO public.xp_events(
    user_id, event_type, xp_category, xp_amount, source_type, source_id,
    idempotency_key, metadata
  ) VALUES (
    saved.user_id, 'certificate_earned', 'engagement', p_xp_amount,
    'certificates', saved.id, 'cert:' || saved.user_id || ':' || saved.id,
    jsonb_build_object(
      'credential_id', saved.credential_id,
      'certificate_type', saved.certificate_type
    )
  ) ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN saved;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_certificate_atomic(uuid,text,public.certificate_type,public.certificate_status,uuid,uuid,uuid,uuid,text,text,text,text,text,timestamptz,jsonb,timestamptz,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_certificate_name_atomic(uuid,uuid,text,timestamptz,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_certificate_atomic(uuid,text,public.certificate_type,public.certificate_status,uuid,uuid,uuid,uuid,text,text,text,text,text,timestamptz,jsonb,timestamptz,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_certificate_name_atomic(uuid,uuid,text,timestamptz,integer) TO service_role;

-- Repair historical partial writes once, not on every profile/read request.
-- 50 is the certificate_earned reward in functions/shared/xp-rewards.json.
INSERT INTO public.xp_events(user_id,event_type,xp_category,xp_amount,source_type,source_id,idempotency_key,metadata)
SELECT user_id,'certificate_earned','engagement',50,'certificates',id,
  'cert:' || user_id || ':' || id,
  jsonb_build_object('credential_id',credential_id,'certificate_type',certificate_type)
FROM public.certificates WHERE status IN ('issued','revoked') AND supersedes_id IS NULL
ON CONFLICT(idempotency_key) DO NOTHING;

COMMIT;
