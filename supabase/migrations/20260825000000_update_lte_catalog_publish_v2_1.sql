-- Migration: LTE Catalog Uploads v2.1 Architecture Update
-- Adds dedicated reviewed and final snapshot fields, asset lifecycle status,
-- publish lease/heartbeat timestamps, and updated status values.

-- 1. Add v2.1 columns to lte_catalog_uploads
ALTER TABLE public.lte_catalog_uploads
  ADD COLUMN IF NOT EXISTS reviewed_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS reviewed_snapshot_hash TEXT,
  ADD COLUMN IF NOT EXISTS final_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS final_snapshot_hash TEXT,
  ADD COLUMN IF NOT EXISTS asset_manifest JSONB,
  ADD COLUMN IF NOT EXISTS asset_status TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS publish_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS publish_heartbeat_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS publish_lease_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS asset_activation_attempt_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_asset_activation_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_asset_activation_error JSONB,
  ADD COLUMN IF NOT EXISTS next_asset_activation_at TIMESTAMPTZ;

-- 2. Drop legacy status check constraint if it exists and add v2.1 status check
DO $$
BEGIN
  ALTER TABLE public.lte_catalog_uploads DROP CONSTRAINT IF EXISTS lte_catalog_uploads_status_check;
  ALTER TABLE public.lte_catalog_uploads ADD CONSTRAINT lte_catalog_uploads_status_check
    CHECK (status IN (
      'uploaded',
      'validating',
      'validated',
      'validation_failed',
      'publishing',
      'published',
      'publish_failed'
    ));
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END;
$$;

-- 3. Add asset_status check constraint
DO $$
BEGIN
  ALTER TABLE public.lte_catalog_uploads DROP CONSTRAINT IF EXISTS lte_catalog_uploads_asset_status_check;
  ALTER TABLE public.lte_catalog_uploads ADD CONSTRAINT lte_catalog_uploads_asset_status_check
    CHECK (asset_status IN (
      'none',
      'staged',
      'active',
      'activation_pending',
      'cleanup_pending'
    ));
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END;
$$;

-- 4. Integrity, lease, and worker query indexes
CREATE INDEX IF NOT EXISTS idx_lte_catalog_uploads_reviewed_hash ON public.lte_catalog_uploads(reviewed_snapshot_hash);
CREATE INDEX IF NOT EXISTS idx_lte_catalog_uploads_publishing_lease
  ON public.lte_catalog_uploads(publish_lease_expires_at)
  WHERE status = 'publishing';

CREATE INDEX IF NOT EXISTS idx_lte_catalog_uploads_asset_retry
  ON public.lte_catalog_uploads(next_asset_activation_at)
  WHERE status = 'published' AND asset_status = 'activation_pending';

CREATE INDEX IF NOT EXISTS idx_lte_catalog_uploads_asset_cleanup
  ON public.lte_catalog_uploads(last_publish_attempt_at)
  WHERE asset_status = 'cleanup_pending';

-- 5. Backfill existing records if needed
UPDATE public.lte_catalog_uploads
SET 
  reviewed_snapshot = COALESCE(reviewed_snapshot, normalized_snapshot),
  reviewed_snapshot_hash = COALESCE(reviewed_snapshot_hash, snapshot_hash),
  asset_status = COALESCE(asset_status, CASE WHEN status = 'published' THEN 'active' ELSE 'none' END)
WHERE reviewed_snapshot IS NULL OR reviewed_snapshot_hash IS NULL OR asset_status IS NULL;

-- Produce the same recursively key-sorted, whitespace-free JSON representation
-- as canonicalizeJSON() in the application. Whitespace inside string values is
-- preserved because scalar JSON values are never modified.
CREATE OR REPLACE FUNCTION public.lte_canonical_jsonb_text(p_value JSONB)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
STRICT
SET search_path = public, pg_catalog
AS $canonical$
  SELECT CASE jsonb_typeof(p_value)
    WHEN 'object' THEN COALESCE((
      SELECT '{' || string_agg(
        to_jsonb(entry.key)::TEXT || ':' || public.lte_canonical_jsonb_text(entry.value),
        ',' ORDER BY entry.key COLLATE "C"
      ) || '}'
      FROM jsonb_each(p_value) AS entry
    ), '{}')
    WHEN 'array' THEN COALESCE((
      SELECT '[' || string_agg(
        public.lte_canonical_jsonb_text(element.value),
        ',' ORDER BY element.ordinality
      ) || ']'
      FROM jsonb_array_elements(p_value) WITH ORDINALITY AS element(value, ordinality)
    ), '[]')
    ELSE p_value::TEXT
  END
$canonical$;

-- 6. Update publish_lte_catalog_snapshot RPC to support v2.1 publishing state and hash checks
CREATE OR REPLACE FUNCTION public.publish_lte_catalog_snapshot(
  p_upload_id UUID,
  p_published_by UUID,
  p_expected_snapshot_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
SET statement_timeout = '60s'
SET lock_timeout = '10s'
AS $$
DECLARE
  v_upload_record RECORD;
  v_snapshot JSONB;
  v_table_name TEXT;
  v_table_data JSONB;
  v_columns TEXT[];
  v_column_indexes INTEGER[];
  v_row JSONB;
  v_insert_sql TEXT;
  v_column_sql TEXT;
  v_value_sql TEXT;
  v_affected INTEGER;
  v_total_inserted INTEGER := 0;
  v_total_skipped INTEGER := 0;
  v_table_inserted INTEGER;
  v_table_skipped INTEGER;
  v_table_summary JSONB := '{}'::JSONB;
  v_table_order TEXT[] := ARRAY[
    'roles',
    'capabilities',
    'level_scale',
    'role_capability_sequence',
    'skills',
    'levels',
    'level_skills',
    'modules',
    'modules_content',
    'e_content',
    'module_artifacts',
    'artifact_questions',
    'artifact_templates'
  ];
  v_computed_final_snapshot_hash TEXT;
  v_start_time TIMESTAMPTZ := clock_timestamp();
  v_duration_seconds NUMERIC;
BEGIN
  SELECT * INTO v_upload_record
  FROM public.lte_catalog_uploads
  WHERE id = p_upload_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Upload not found', 'errorCode', 'UPLOAD_NOT_FOUND');
  END IF;

  IF v_upload_record.status <> 'publishing' THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = format('Upload status is %s, expected publishing', v_upload_record.status),
      DETAIL = 'INVALID_STATUS';
  END IF;

  IF v_upload_record.final_snapshot IS NULL OR v_upload_record.final_snapshot_hash IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'Final snapshot and hash must be persisted before publishing',
      DETAIL = 'FINAL_SNAPSHOT_MISSING';
  END IF;

  v_computed_final_snapshot_hash := encode(
    extensions.digest(
      convert_to(public.lte_canonical_jsonb_text(v_upload_record.final_snapshot), 'UTF8'),
      'sha256'
    ),
    'hex'
  );

  IF lower(v_upload_record.final_snapshot_hash) <> lower(p_expected_snapshot_hash)
     OR lower(v_computed_final_snapshot_hash) <> lower(p_expected_snapshot_hash) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'Final snapshot hash mismatch - data may have been tampered with',
      DETAIL = format(
        'HASH_MISMATCH expected=%s stored=%s computed=%s',
        p_expected_snapshot_hash,
        v_upload_record.final_snapshot_hash,
        v_computed_final_snapshot_hash
      );
  END IF;

  v_snapshot := v_upload_record.final_snapshot;

  FOREACH v_table_name IN ARRAY v_table_order
  LOOP
    v_table_inserted := 0;
    v_table_skipped := 0;
    v_table_data := v_snapshot -> 'tables' -> v_table_name;

    IF v_table_data IS NULL THEN
      CONTINUE;
    END IF;

    v_columns := ARRAY(SELECT jsonb_array_elements_text(v_table_data -> 'columns'));

    IF array_length(v_columns, 1) IS NULL THEN
      CONTINUE;
    END IF;

    SELECT
      array_agg(idx ORDER BY idx),
      string_agg(quote_ident(v_columns[idx]), ', ' ORDER BY idx)
    INTO v_column_indexes, v_column_sql
    FROM generate_subscripts(v_columns, 1) AS idx
    WHERE EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = v_table_name
        AND column_name = v_columns[idx]
    );

    IF array_length(v_column_indexes, 1) IS NULL THEN
      CONTINUE;
    END IF;

    SELECT string_agg(quote_ident(v_columns[idx]), ', ' ORDER BY idx)
    INTO v_column_sql
    FROM unnest(v_column_indexes) AS idx;

    FOR v_row IN SELECT * FROM jsonb_array_elements(v_table_data -> 'rows')
    LOOP
      SELECT string_agg(public.lte_jsonb_value_sql(v_table_name, v_columns[idx], jsonb_array_element(v_row, idx - 1)), ', ' ORDER BY idx)
      INTO v_value_sql
      FROM unnest(v_column_indexes) AS idx;

      v_insert_sql := format(
        'INSERT INTO public.%I (%s) VALUES (%s) ON CONFLICT DO NOTHING',
        v_table_name, v_column_sql, v_value_sql
      );
      EXECUTE v_insert_sql;
      GET DIAGNOSTICS v_affected = ROW_COUNT;
      v_table_inserted := v_table_inserted + v_affected;
      v_table_skipped := v_table_skipped + (1 - v_affected);
      v_total_inserted := v_total_inserted + v_affected;
      v_total_skipped := v_total_skipped + (1 - v_affected);
    END LOOP;

    v_table_summary := v_table_summary || jsonb_build_object(
      v_table_name,
      jsonb_build_object('inserted', v_table_inserted, 'skipped', v_table_skipped)
    );
  END LOOP;

  v_duration_seconds := EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time));

  UPDATE public.lte_catalog_uploads
  SET
    status = 'published',
    asset_status = COALESCE(v_upload_record.asset_status, 'active'),
    published_at = NOW(),
    published_by = p_published_by,
    publish_summary = jsonb_build_object(
      'publishedAt', NOW(),
      'publishedBy', p_published_by,
      'inserted', v_total_inserted,
      'skipped', v_total_skipped,
      'durationSeconds', v_duration_seconds,
      'tableSummary', v_table_summary
    ),
    publish_attempt_count = publish_attempt_count + 1,
    last_publish_attempt_at = NOW(),
    last_publish_error = NULL
  WHERE id = p_upload_id;

  RETURN jsonb_build_object(
    'status', 'published',
    'message', 'Successfully published LTE catalog snapshot',
    'inserted', v_total_inserted,
    'skipped', v_total_skipped,
    'durationSeconds', v_duration_seconds,
    'tableSummary', v_table_summary
  );
END;
$$;
