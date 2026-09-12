-- Fix LTE publish RPC:
-- - Uses the actual 13 LTE catalog tables.
-- - Converts workbook business IDs to deterministic UUIDs consistently.
-- - Converts FK business IDs using the referenced table namespace.
-- - Casts jsonb, enum, timestamp, and text[] values correctly.
-- - Counts INSERT ... ON CONFLICT DO NOTHING truthfully via ROW_COUNT.

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.lte_uuid_v5(namespace UUID, name TEXT)
RETURNS UUID
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  hash_hex TEXT;
BEGIN
  hash_hex := encode(extensions.digest(decode(replace(namespace::TEXT, '-', ''), 'hex') || convert_to(name, 'UTF8'), 'sha1'), 'hex');

  RETURN (
    substring(hash_hex from 1 for 8) || '-' ||
    substring(hash_hex from 9 for 4) || '-' ||
    '5' || substring(hash_hex from 14 for 3) || '-' ||
    (CASE substring(hash_hex from 17 for 1)
      WHEN '0' THEN '8' WHEN '1' THEN '9' WHEN '2' THEN 'a' WHEN '3' THEN 'b'
      WHEN '4' THEN '8' WHEN '5' THEN '9' WHEN '6' THEN 'a' WHEN '7' THEN 'b'
      WHEN '8' THEN '8' WHEN '9' THEN '9' WHEN 'a' THEN 'a' WHEN 'b' THEN 'b'
      WHEN 'c' THEN '8' WHEN 'd' THEN '9' WHEN 'e' THEN 'a' WHEN 'f' THEN 'b'
      ELSE '8'
    END) || substring(hash_hex from 18 for 3) || '-' ||
    substring(hash_hex from 21 for 12)
  )::UUID;
END;
$$;

CREATE OR REPLACE FUNCTION public.lte_fk_owner_table(p_table_name TEXT, p_column_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_table_name || '|' || p_column_name
    WHEN 'levels|capability_id' THEN 'capabilities'
    WHEN 'levels|level_id' THEN 'level_scale'
    WHEN 'role_capability_sequence|role_id' THEN 'roles'
    WHEN 'role_capability_sequence|capability_id' THEN 'capabilities'
    WHEN 'level_skills|level_id' THEN 'levels'
    WHEN 'level_skills|skill_id' THEN 'skills'
    WHEN 'modules|level_id' THEN 'levels'
    WHEN 'modules_content|module_id' THEN 'modules'
    WHEN 'e_content|modules_content_id' THEN 'modules_content'
    WHEN 'module_artifacts|modules_content_id' THEN 'modules_content'
    WHEN 'artifact_questions|artifact_id' THEN 'module_artifacts'
    WHEN 'artifact_templates|artifact_id' THEN 'module_artifacts'
    WHEN 'artifact_templates|question_id' THEN 'artifact_questions'
    ELSE p_table_name
  END;
$$;

CREATE OR REPLACE FUNCTION public.lte_uuid_sql_literal(p_owner_table TEXT, p_value TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_uuid_namespace UUID := '11f25d55-f94d-4dbd-8ad2-f09fb2de5d5f'::UUID;
BEGIN
  IF p_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN quote_literal(p_value) || '::uuid';
  END IF;

  RETURN quote_literal(public.lte_uuid_v5(v_uuid_namespace, p_owner_table || ':' || p_value)::TEXT) || '::uuid';
END;
$$;

CREATE OR REPLACE FUNCTION public.lte_jsonb_value_sql(p_table_name TEXT, p_column_name TEXT, p_value JSONB)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_data_type TEXT;
  v_udt_name TEXT;
  v_is_nullable TEXT;
  v_column_default TEXT;
  v_text TEXT;
  v_owner_table TEXT;
BEGIN
  SELECT
    CASE
      WHEN t.typname = 'uuid' THEN 'uuid'
      WHEN t.typname = 'jsonb' THEN 'jsonb'
      WHEN t.typname = '_text' THEN 'ARRAY'
      WHEN t.typname = 'timestamptz' THEN 'timestamp with time zone'
      WHEN t.typtype = 'e' THEN 'USER-DEFINED'
      ELSE format_type(a.atttypid, a.atttypmod)
    END,
    t.typname,
    CASE WHEN a.attnotnull THEN 'NO' ELSE 'YES' END,
    pg_get_expr(ad.adbin, ad.adrelid)
  INTO v_data_type, v_udt_name, v_is_nullable, v_column_default
  FROM pg_catalog.pg_attribute a
  JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_catalog.pg_type t ON t.oid = a.atttypid
  LEFT JOIN pg_catalog.pg_attrdef ad
    ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
  WHERE n.nspname = 'public'
    AND c.relname = p_table_name
    AND a.attname = p_column_name
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF v_data_type IS NULL THEN
    RAISE EXCEPTION 'Unknown LTE column %.%', p_table_name, p_column_name;
  END IF;

  IF p_value = 'null'::jsonb THEN
    IF v_column_default IS NOT NULL THEN
      RETURN 'DEFAULT';
    END IF;

    IF v_is_nullable = 'NO' THEN
      RAISE EXCEPTION 'LTE column %.% is required but the snapshot value is null',
        p_table_name, p_column_name;
    END IF;

    RETURN 'NULL';
  END IF;

  v_text := p_value #>> '{}';

  IF v_data_type = 'uuid' THEN
    v_owner_table := public.lte_fk_owner_table(p_table_name, p_column_name);
    RETURN public.lte_uuid_sql_literal(v_owner_table, v_text);
  END IF;

  IF v_data_type = 'jsonb' THEN
    RETURN quote_literal(p_value::TEXT) || '::jsonb';
  END IF;

  IF v_data_type = 'ARRAY' AND v_udt_name = '_text' THEN
    IF jsonb_typeof(p_value) = 'array' THEN
      RETURN COALESCE(
        (
          SELECT 'ARRAY[' || string_agg(quote_literal(item), ', ') || ']::text[]'
          FROM jsonb_array_elements_text(p_value) AS item
        ),
        'ARRAY[]::text[]'
      );
    END IF;

    RETURN 'ARRAY[' || quote_literal(v_text) || ']::text[]';
  END IF;

  IF v_data_type = 'timestamp with time zone' THEN
    RETURN quote_literal(v_text) || '::timestamptz';
  END IF;

  IF v_data_type = 'USER-DEFINED' THEN
    RETURN quote_literal(v_text) || '::' || quote_ident(v_udt_name);
  END IF;

  IF jsonb_typeof(p_value) IN ('number', 'boolean') THEN
    RETURN v_text;
  END IF;

  RETURN quote_literal(v_text);
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_lte_catalog_snapshot(
  p_upload_id UUID,
  p_published_by UUID,
  p_expected_snapshot_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
SET statement_timeout = '300000'
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
BEGIN
  SELECT * INTO v_upload_record
  FROM public.lte_catalog_uploads
  WHERE id = p_upload_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Upload not found', 'errorCode', 'UPLOAD_NOT_FOUND');
  END IF;

  IF v_upload_record.status != 'validated' THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', format('Upload status is %s, expected validated', v_upload_record.status),
      'errorCode', 'INVALID_STATUS'
    );
  END IF;

  IF v_upload_record.snapshot_hash != p_expected_snapshot_hash THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'Snapshot hash mismatch - data may have been tampered with',
      'errorCode', 'HASH_MISMATCH',
      'expected', p_expected_snapshot_hash,
      'actual', v_upload_record.snapshot_hash
    );
  END IF;

  v_snapshot := v_upload_record.normalized_snapshot;

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

  UPDATE public.lte_catalog_uploads
  SET
    status = 'published',
    published_at = NOW(),
    published_by = p_published_by,
    publish_summary = jsonb_build_object(
      'publishedAt', NOW(),
      'publishedBy', p_published_by,
      'inserted', v_total_inserted,
      'skipped', v_total_skipped,
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
    'tableSummary', v_table_summary
  );
EXCEPTION
  WHEN OTHERS THEN
    UPDATE public.lte_catalog_uploads
    SET
      last_publish_error = jsonb_build_object(
        'errorAt', NOW(),
        'errorCode', SQLSTATE,
        'errorMessage', SQLERRM
      ),
      last_publish_attempt_at = NOW(),
      publish_attempt_count = publish_attempt_count + 1
    WHERE id = p_upload_id;

    RETURN jsonb_build_object('status', 'error', 'message', SQLERRM, 'errorCode', SQLSTATE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.publish_lte_catalog_snapshot(UUID, UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.publish_lte_catalog_snapshot(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_lte_catalog_snapshot(UUID, UUID, TEXT) TO service_role;
