-- Schema only. Applying requires approval for the exact LTE database target.
BEGIN;
CREATE TABLE public.subscription_reserved_track_outcomes (
  operation_id uuid PRIMARY KEY REFERENCES public.subscription_track_activations(operation_id),
  actor_id uuid NOT NULL REFERENCES public.users(id),
  track_id uuid NOT NULL REFERENCES public.learning_tracks(id),
  reservation jsonb NOT NULL,
  outcome jsonb NOT NULL,
  committed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
REVOKE ALL ON public.subscription_reserved_track_outcomes FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.subscription_reserved_track_outcomes TO service_role;
CREATE TRIGGER subscription_reserved_outcomes_immutable BEFORE UPDATE OR DELETE OR TRUNCATE
  ON public.subscription_reserved_track_outcomes FOR EACH STATEMENT EXECUTE FUNCTION public.guard_subscription_track_activation_evidence();

-- Only the new central-reservation entrypoint can invoke the installed local
-- resource owner. Its former local entitlement counter is deliberately disabled
-- by an explicit internal adapter; SkillPassport now owns that single counter.
REVOKE ALL ON FUNCTION public.activate_subscription_learning_track(uuid,uuid,uuid,jsonb) FROM service_role;
CREATE FUNCTION public.activate_reserved_subscription_learning_track(p_actor uuid,p_track uuid,p_operation uuid,p_reservation jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE saved public.subscription_reserved_track_outcomes%ROWTYPE; local_receipt public.subscription_track_activations%ROWTYPE;
  authority jsonb; command jsonb; adapter jsonb; result jsonb; deadline bigint; target public.learning_tracks%ROWTYPE; committed bigint;
BEGIN
  IF p_actor IS NULL OR p_track IS NULL OR p_operation IS NULL
    OR jsonb_typeof(p_reservation) IS DISTINCT FROM 'object'
    OR (SELECT count(*) FROM jsonb_object_keys(p_reservation))<>8
    OR p_reservation->'schemaVersion' IS DISTINCT FROM '1'::jsonb
    OR (p_reservation->>'actorId')::uuid IS DISTINCT FROM p_actor
    OR (p_reservation->>'operationId')::uuid IS DISTINCT FROM p_operation
    OR (p_reservation->>'trackId')::uuid IS DISTINCT FROM p_track THEN
    RAISE EXCEPTION 'Exact central subscription reservation required' USING ERRCODE='42501';
  END IF;
  authority:=p_reservation->'authorization'; command:=p_reservation#>'{quotaReceipt,command}';
  IF jsonb_typeof(authority) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(authority))<>12
    OR authority->'schemaVersion' IS DISTINCT FROM '1'::jsonb
    OR (authority->>'actorId')::uuid IS DISTINCT FROM p_actor
    OR authority->'subject' IS DISTINCT FROM jsonb_build_object('kind','user','id',p_actor)
    OR authority->>'actionKey' IS DISTINCT FROM 'learning_path.activate' OR authority->>'mode' IS DISTINCT FROM 'write'
    OR authority#>>'{quota,period}' IS DISTINCT FROM 'billing_period'
    OR authority#>>'{quota,countingEvent}' IS DISTINCT FROM 'course_lte_assignment'
    OR command->>'actionKey' IS DISTINCT FROM authority->>'actionKey'
    OR command->>'countingEvent' IS DISTINCT FROM authority#>>'{quota,countingEvent}'
    OR (command->>'operationId')::uuid IS DISTINCT FROM p_operation
    OR (command->>'resourceId')::uuid IS DISTINCT FROM p_operation
    OR (command->>'actorId')::uuid IS DISTINCT FROM p_actor OR command->'subject' IS DISTINCT FROM authority->'subject'
    OR command->>'subscriptionId' IS DISTINCT FROM authority->>'subscriptionId'
    OR command->>'productId' IS DISTINCT FROM authority->>'productId'
    OR command->>'revisionId' IS DISTINCT FROM authority->>'revisionId'
    OR command->'version' IS DISTINCT FROM authority->'version'
    OR command->'periodStartsAt' IS DISTINCT FROM authority#>'{quota,periodStartsAt}'
    OR command->'periodEndsAt' IS DISTINCT FROM authority#>'{quota,periodEndsAt}'
    OR command->'limit' IS DISTINCT FROM authority#>'{quota,limit}'
    OR (p_reservation#>>'{quotaReceipt,used}')::bigint IS NULL
    OR (p_reservation#>>'{quotaReceipt,used}')::bigint<1
    OR (command->>'limit')::bigint<(p_reservation#>>'{quotaReceipt,used}')::bigint THEN
    RAISE EXCEPTION 'Central resource reservation scope differs' USING ERRCODE='42501';
  END IF;
  PERFORM 1 FROM public.users WHERE id=p_actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Activation learner unavailable' USING ERRCODE='42501'; END IF;
  SELECT * INTO saved FROM public.subscription_reserved_track_outcomes WHERE operation_id=p_operation;
  IF FOUND THEN
    IF saved.actor_id<>p_actor OR saved.track_id<>p_track
      OR saved.reservation->'authorization' IS DISTINCT FROM authority
      OR saved.reservation->'quotaReceipt' IS DISTINCT FROM p_reservation->'quotaReceipt'
      OR (p_reservation->>'status'='confirmed' AND saved.outcome IS DISTINCT FROM p_reservation->'outcome') THEN
      RAISE EXCEPTION 'Reserved activation replay differs' USING ERRCODE='22023';
    END IF;
    RETURN saved.outcome;
  END IF;
  deadline:=(authority->>'validUntil')::bigint;
  IF p_reservation->>'status' IS DISTINCT FROM 'pending' OR p_reservation->'outcome' IS DISTINCT FROM 'null'::jsonb
    OR deadline IS NULL OR floor(extract(epoch FROM clock_timestamp())*1000)>=deadline THEN
    RAISE EXCEPTION 'Pending current activation reservation required' USING ERRCODE='42501';
  END IF;
  -- Canonical published action -> installed local resource-owner protocol.
  -- This is a fixed adapter, not an alternate authorization or quota source.
  adapter:=jsonb_set(jsonb_set(authority,'{actionKey}','"lte.track.activate"'::jsonb),'{quota}','null'::jsonb);
  SELECT * INTO target FROM public.learning_tracks WHERE id=p_track AND user_id=p_actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Owned learning track unavailable' USING ERRCODE='42501'; END IF;
  IF target.is_active THEN
    -- An authoritative race discovered after a hold is still a resource no-op.
    -- Persist its exact immutable evidence, without reactivation/capability writes.
    committed:=floor(extract(epoch FROM clock_timestamp())*1000)::bigint;
    INSERT INTO public.subscription_track_activations(operation_id,actor_id,track_id,subscription_id,product_id,feature_key,
      "authorization",counted,activated_at_ms,valid_until_ms,receipt)
      VALUES(p_operation,p_actor,p_track,(authority->>'subscriptionId')::uuid,(authority->>'productId')::uuid,
        authority->>'featureKey',adapter,false,committed,deadline,
        jsonb_build_object('operationId',p_operation,'trackId',p_track,'actorId',p_actor));
  ELSE
    PERFORM public.activate_subscription_learning_track(p_actor,p_track,p_operation,adapter);
  END IF;
  SELECT * INTO STRICT local_receipt FROM public.subscription_track_activations WHERE operation_id=p_operation;
  IF local_receipt.actor_id<>p_actor OR local_receipt.track_id<>p_track
    OR local_receipt.authorization IS DISTINCT FROM adapter THEN
    RAISE EXCEPTION 'Local activation outcome differs' USING ERRCODE='22023';
  END IF;
  result:=jsonb_build_object('schemaVersion',1,'operationId',p_operation,'reservationId',p_operation,
    'actorId',p_actor,'trackId',p_track,'subscriptionId',authority->'subscriptionId','productId',authority->'productId',
    'revisionId',authority->'revisionId','version',authority->'version','created',local_receipt.counted,
    'completedAt',floor(extract(epoch FROM clock_timestamp())*1000)::bigint);
  INSERT INTO public.subscription_reserved_track_outcomes(operation_id,actor_id,track_id,reservation,outcome)
    VALUES(p_operation,p_actor,p_track,p_reservation,result);
  -- The installed owner's deferred trigger enforces the original validUntil at
  -- actual local commit. A later authenticated ack uses this retained timestamp.
  RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.activate_reserved_subscription_learning_track(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.activate_reserved_subscription_learning_track(uuid,uuid,uuid,jsonb) TO service_role;
-- Explicit owning no-op decision, before reserving any shared capacity. The
-- installed immutable operation table records no new resource or consumption.
CREATE FUNCTION public.classify_subscription_track_activation(p_actor uuid,p_track uuid,p_operation uuid,p_authorization jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE target public.learning_tracks%ROWTYPE; saved public.subscription_track_activations%ROWTYPE;
  result jsonb; committed bigint; deadline bigint;
BEGIN
  IF p_actor IS NULL OR p_track IS NULL OR p_operation IS NULL
    OR jsonb_typeof(p_authorization) IS DISTINCT FROM 'object'
    OR (SELECT count(*) FROM jsonb_object_keys(p_authorization))<>12
    OR NOT p_authorization ?& ARRAY['schemaVersion','actorId','subject','subscriptionId','productId','revisionId','version','actionKey','featureKey','mode','validUntil','quota']
    OR p_authorization->'schemaVersion' IS DISTINCT FROM '1'::jsonb
    OR (p_authorization->>'actorId')::uuid IS DISTINCT FROM p_actor
    OR p_authorization->'subject' IS DISTINCT FROM jsonb_build_object('kind','user','id',p_actor)
    OR p_authorization->>'actionKey' IS DISTINCT FROM 'learning_path.activate'
    OR p_authorization->>'mode' IS DISTINCT FROM 'write'
    OR p_authorization#>>'{quota,period}' IS DISTINCT FROM 'billing_period'
    OR p_authorization#>>'{quota,countingEvent}' IS DISTINCT FROM 'course_lte_assignment'
    OR (p_authorization->>'subscriptionId')::uuid IS NULL OR (p_authorization->>'productId')::uuid IS NULL
    OR (p_authorization->>'revisionId')::uuid IS NULL
    OR length(p_authorization->>'featureKey')=0
    OR EXISTS(SELECT 1 FROM jsonb_each(p_authorization) item WHERE item.key IN ('version','validUntil')
      AND (jsonb_typeof(item.value) IS DISTINCT FROM 'number' OR (item.value#>>'{}')::numeric NOT BETWEEN 1 AND 9007199254740991
        OR (item.value#>>'{}')::numeric<>trunc((item.value#>>'{}')::numeric))) THEN
    RAISE EXCEPTION 'Exact current learner authority required' USING ERRCODE='42501';
  END IF;
  PERFORM 1 FROM public.users WHERE id=p_actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Activation learner unavailable' USING ERRCODE='42501'; END IF;
  SELECT * INTO saved FROM public.subscription_track_activations WHERE operation_id=p_operation;
  IF FOUND THEN
    IF saved.actor_id<>p_actor OR saved.track_id<>p_track OR saved.counted
      OR saved.receipt->>'kind' IS DISTINCT FROM 'unchanged'
      OR saved.authorization-'validUntil' IS DISTINCT FROM p_authorization-'validUntil'
      OR (saved.authorization->>'validUntil')::bigint>(p_authorization->>'validUntil')::bigint THEN
      RAISE EXCEPTION 'Unchanged operation replay differs' USING ERRCODE='22023';
    END IF;
    RETURN saved.receipt;
  END IF;
  committed:=floor(extract(epoch FROM clock_timestamp())*1000)::bigint;
  deadline:=(p_authorization->>'validUntil')::bigint;
  IF deadline IS NULL OR committed>=deadline OR committed<(p_authorization#>>'{quota,periodStartsAt}')::bigint
    OR deadline>(p_authorization#>>'{quota,periodEndsAt}')::bigint THEN
    RAISE EXCEPTION 'Current unchanged authority required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO target FROM public.learning_tracks WHERE id=p_track AND user_id=p_actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Owned learning track unavailable' USING ERRCODE='42501'; END IF;
  IF target.is_active IS DISTINCT FROM true THEN RETURN jsonb_build_object('kind','reservation_required'); END IF;
  result:=jsonb_build_object('kind','unchanged','operationId',p_operation,'actorId',p_actor,'trackId',p_track,
    'authorization',p_authorization,'completedAt',committed);
  INSERT INTO public.subscription_track_activations(operation_id,actor_id,track_id,subscription_id,product_id,feature_key,
    "authorization",counted,activated_at_ms,valid_until_ms,receipt)
    VALUES(p_operation,p_actor,p_track,(p_authorization->>'subscriptionId')::uuid,(p_authorization->>'productId')::uuid,
      p_authorization->>'featureKey',p_authorization,false,committed,deadline,result);
  RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.classify_subscription_track_activation(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.classify_subscription_track_activation(uuid,uuid,uuid,jsonb) TO service_role;

CREATE FUNCTION public.read_reserved_subscription_learning_track(p_actor uuid,p_track uuid,p_operation uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE saved public.subscription_reserved_track_outcomes%ROWTYPE; unchanged public.subscription_track_activations%ROWTYPE;
BEGIN
  IF p_actor IS NULL OR p_track IS NULL OR p_operation IS NULL THEN
    RAISE EXCEPTION 'Complete recorded activation identity required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO saved FROM public.subscription_reserved_track_outcomes
    WHERE operation_id=p_operation AND actor_id=p_actor;
  IF NOT FOUND THEN
    SELECT * INTO unchanged FROM public.subscription_track_activations
      WHERE operation_id=p_operation AND actor_id=p_actor AND NOT counted AND receipt->>'kind'='unchanged';
    IF NOT FOUND THEN RETURN NULL; END IF;
    IF unchanged.track_id<>p_track THEN RAISE EXCEPTION 'Recorded unchanged target differs' USING ERRCODE='22023'; END IF;
    RETURN unchanged.receipt;
  END IF;
  IF saved.track_id<>p_track THEN RAISE EXCEPTION 'Recorded activation target differs' USING ERRCODE='22023'; END IF;
  RETURN jsonb_build_object('reservation',saved.reservation,'outcome',saved.outcome);
END; $$;
REVOKE ALL ON FUNCTION public.read_reserved_subscription_learning_track(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.read_reserved_subscription_learning_track(uuid,uuid,uuid) TO service_role;
COMMIT;
