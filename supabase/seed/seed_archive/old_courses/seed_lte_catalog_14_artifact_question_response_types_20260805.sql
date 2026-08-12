-- Seed: artifact question response types for existing XLSX template artifacts.
-- Keeps generated catalog seed files unchanged.

BEGIN;

UPDATE public."artifact_questions"
SET
  "response_type" = 'file',
  "allowed_file_types" = ARRAY['xlsx'],
  "max_file_size_mb" = 10,
  "response_required" = TRUE,
  "updated_at" = now()
WHERE EXISTS (
  SELECT 1
  FROM public."artifact_templates" AS template
  WHERE template."question_id" = public."artifact_questions"."id"
    AND template."file_type" = 'excel'::public.lte_file_type
    AND template."is_downloadable" = TRUE
);

COMMIT;
