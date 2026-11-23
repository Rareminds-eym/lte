-- PREPARED ONLY. Requires explicit approval for the exact LTE database target.
-- Additive schema; no existing learner is activated, migrated or deleted here.
BEGIN;

CREATE TABLE public.subscription_track_activations (
  operation_id uuid PRIMARY KEY,
  actor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  track_id uuid NOT NULL REFERENCES public.learning_tracks(id) ON DELETE RESTRICT,
  subscription_id uuid NOT NULL,
  product_id uuid NOT NULL,
  feature_key text NOT NULL CHECK (length(feature_key)>0),
  "authorization" jsonb NOT NULL CHECK (jsonb_typeof("authorization")='object'),
  counted boolean NOT NULL,
  activated_at_ms bigint NOT NULL,
  valid_until_ms bigint NOT NULL,
  receipt jsonb NOT NULL
);
CREATE INDEX subscription_track_activations_usage_idx ON public.subscription_track_activations
  (actor_id,subscription_id,product_id,feature_key,activated_at_ms) WHERE counted;
REVOKE ALL ON TABLE public.subscription_track_activations FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE public.subscription_track_activations TO service_role;

CREATE FUNCTION public.guard_subscription_track_activation_evidence() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  RAISE EXCEPTION 'Subscription activation evidence is immutable';
END;
$$;
CREATE TRIGGER subscription_track_activations_immutable BEFORE UPDATE OR DELETE ON public.subscription_track_activations
  FOR EACH ROW EXECUTE FUNCTION public.guard_subscription_track_activation_evidence();
CREATE TRIGGER subscription_track_activations_no_truncate BEFORE TRUNCATE ON public.subscription_track_activations
  FOR EACH STATEMENT EXECUTE FUNCTION public.guard_subscription_track_activation_evidence();

CREATE FUNCTION public.check_subscription_track_activation_deadline() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF floor(extract(epoch FROM clock_timestamp())*1000)>=NEW.valid_until_ms THEN
    RAISE EXCEPTION 'Subscription activation authority expired';
  END IF;
  RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER subscription_track_activation_deadline AFTER INSERT ON public.subscription_track_activations
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_subscription_track_activation_deadline();

CREATE FUNCTION public.activate_subscription_learning_track(p_actor uuid,p_track uuid,p_operation uuid,p_authorization jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE
  old public.subscription_track_activations%ROWTYPE; target public.learning_tracks%ROWTYPE;
  now_ms bigint:=floor(extract(epoch FROM clock_timestamp())*1000);
  quota jsonb:=p_authorization->'quota'; subscription uuid; product uuid; feature text;
  starts_at numeric; ends_at numeric; capacity numeric; used bigint; should_count boolean; result jsonb;
BEGIN
  IF p_actor IS NULL OR p_track IS NULL OR p_operation IS NULL OR jsonb_typeof(p_authorization) IS DISTINCT FROM 'object'
    OR (SELECT count(*) FROM jsonb_object_keys(p_authorization))<>12
    OR NOT p_authorization ?& ARRAY['schemaVersion','actorId','subject','subscriptionId','productId','revisionId','version',
      'actionKey','featureKey','mode','validUntil','quota']
    OR p_authorization->'schemaVersion' IS DISTINCT FROM '1'::jsonb
    OR p_authorization->>'actorId' IS DISTINCT FROM p_actor::text
    OR p_authorization->'subject' IS DISTINCT FROM jsonb_build_object('kind','user','id',p_actor)
    OR p_authorization->>'actionKey' IS DISTINCT FROM 'lte.track.activate'
    OR p_authorization->>'mode' IS DISTINCT FROM 'write'
    OR jsonb_typeof(p_authorization->'validUntil') IS DISTINCT FROM 'number'
    OR (p_authorization->>'validUntil')::numeric NOT BETWEEN 1 AND 9007199254740991
    OR (p_authorization->>'validUntil')::numeric<>trunc((p_authorization->>'validUntil')::numeric)
    OR (p_authorization->>'validUntil')::numeric<=now_ms
    OR jsonb_typeof(p_authorization->'version') IS DISTINCT FROM 'number'
    OR (p_authorization->>'version')::numeric NOT BETWEEN 1 AND 9007199254740991
    OR (p_authorization->>'version')::numeric<>trunc((p_authorization->>'version')::numeric)
    OR jsonb_typeof(p_authorization->'featureKey') IS DISTINCT FROM 'string' OR length(p_authorization->>'featureKey')=0 THEN
    RAISE EXCEPTION 'Complete subscription activation authority required';
  END IF;
  subscription:=(p_authorization->>'subscriptionId')::uuid; product:=(p_authorization->>'productId')::uuid;
  IF subscription IS NULL OR product IS NULL OR (p_authorization->>'revisionId')::uuid IS NULL THEN
    RAISE EXCEPTION 'Complete subscription activation identity required';
  END IF;
  feature:=p_authorization->>'featureKey';
  -- Serialize all activation operations for the actual learner, including switches.
  PERFORM 1 FROM public.users WHERE id=p_actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Activation learner unavailable'; END IF;
  now_ms:=floor(extract(epoch FROM clock_timestamp())*1000);
  IF (p_authorization->>'validUntil')::numeric<=now_ms THEN RAISE EXCEPTION 'Subscription activation authority expired'; END IF;
  SELECT * INTO old FROM public.subscription_track_activations WHERE operation_id=p_operation;
  IF FOUND THEN
    IF old.actor_id<>p_actor OR old.track_id<>p_track OR old.subscription_id<>subscription OR old.product_id<>product THEN
      RAISE EXCEPTION 'Activation replay conflicts';
    END IF;
    RETURN old.receipt;
  END IF;
  SELECT * INTO target FROM public.learning_tracks WHERE id=p_track AND user_id=p_actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Owned learning track unavailable'; END IF;
  should_count:=NOT target.is_active;
  IF quota IS DISTINCT FROM 'null'::jsonb THEN
    IF jsonb_typeof(quota) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(quota))<>5
      OR NOT quota ?& ARRAY['period','countingEvent','periodStartsAt','periodEndsAt','limit']
      OR quota->>'period' IS NULL OR quota->>'period' NOT IN ('subscription','billing_period','concurrent')
      OR quota->>'countingEvent' IS DISTINCT FROM 'track_activated'
      OR EXISTS(SELECT 1 FROM jsonb_each(quota) item WHERE item.key IN ('periodStartsAt','periodEndsAt')
        AND (jsonb_typeof(item.value) IS DISTINCT FROM 'number' OR (item.value#>>'{}')::numeric NOT BETWEEN 0 AND 9007199254740991
          OR (item.value#>>'{}')::numeric<>trunc((item.value#>>'{}')::numeric))) THEN
      RAISE EXCEPTION 'Configured activation quota required';
    END IF;
    starts_at:=(quota->>'periodStartsAt')::numeric; ends_at:=(quota->>'periodEndsAt')::numeric;
    IF starts_at>=ends_at OR now_ms<starts_at OR now_ms>=ends_at OR (p_authorization->>'validUntil')::numeric>ends_at THEN
      RAISE EXCEPTION 'Activation quota period differs';
    END IF;
    IF quota->'limit' IS DISTINCT FROM 'null'::jsonb THEN
      IF jsonb_typeof(quota->'limit') IS DISTINCT FROM 'number' OR (quota->>'limit')::numeric NOT BETWEEN 1 AND 9007199254740991
        OR (quota->>'limit')::numeric<>trunc((quota->>'limit')::numeric) THEN RAISE EXCEPTION 'Invalid activation capacity'; END IF;
      capacity:=(quota->>'limit')::numeric;
      IF quota->>'period'='concurrent' THEN
        -- The existing owner constraint permits one active track for a learner.
        used:=1;
      ELSE
        SELECT count(*)+CASE WHEN should_count THEN 1 ELSE 0 END INTO used FROM public.subscription_track_activations
          WHERE actor_id=p_actor AND subscription_id=subscription AND product_id=product AND feature_key=feature
            AND subscription_track_activations.counted AND activated_at_ms>=starts_at AND activated_at_ms<ends_at;
      END IF;
      IF used>capacity THEN RAISE EXCEPTION 'Subscription activation quota exhausted'; END IF;
    END IF;
  END IF;
  IF EXISTS(SELECT 1 FROM public.learning_paths path JOIN public.role_capability_sequence seq ON seq.role_id=path.role_id
    WHERE path.learning_track_id=p_track AND path.user_id=p_actor AND (seq.required_level IS NULL OR seq.required_level::text!~'^L[1-5]$')) THEN
    RAISE EXCEPTION 'Role capability required level unavailable';
  END IF;
  UPDATE public.learning_tracks SET is_active=false WHERE user_id=p_actor AND is_active AND id<>p_track;
  UPDATE public.learning_tracks SET is_active=true WHERE id=p_track AND user_id=p_actor;
  INSERT INTO public.user_capabilities(user_id,learning_path_id,role_sequence_id,current_level,required_level,gap,has_gap,gap_score)
    SELECT p_actor,path.id,seq.id,0,right(seq.required_level::text,1)::integer,right(seq.required_level::text,1)::integer,true,0
    FROM public.learning_paths path JOIN public.role_capability_sequence seq ON seq.role_id=path.role_id
    WHERE path.learning_track_id=p_track AND path.user_id=p_actor
    ON CONFLICT(user_id,role_sequence_id) DO UPDATE SET learning_path_id=EXCLUDED.learning_path_id,
      required_level=EXCLUDED.required_level,gap=greatest(0,EXCLUDED.required_level-public.user_capabilities.current_level),
      has_gap=EXCLUDED.required_level>public.user_capabilities.current_level,
      gap_score=round(public.user_capabilities.current_level::numeric/EXCLUDED.required_level*100),updated_at=now();
  result:=jsonb_build_object('operationId',p_operation,'trackId',p_track,'actorId',p_actor);
  INSERT INTO public.subscription_track_activations(operation_id,actor_id,track_id,subscription_id,product_id,feature_key,
    "authorization",counted,activated_at_ms,valid_until_ms,receipt)
    VALUES(p_operation,p_actor,p_track,subscription,product,feature,p_authorization,should_count,now_ms,(p_authorization->>'validUntil')::bigint,result);
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_subscription_track_activation_evidence(),public.check_subscription_track_activation_deadline(),
  public.activate_subscription_learning_track(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.activate_subscription_learning_track(uuid,uuid,uuid,jsonb) TO service_role;

COMMIT;
