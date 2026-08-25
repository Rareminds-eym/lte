BEGIN;

ALTER TABLE public."artifact_questions"
  ALTER COLUMN "instructions" TYPE jsonb
  USING jsonb_build_object(
    'required_fields', '[]'::jsonb,
    'pass_criteria', '',
    'critical_fail', '',
    'optional_fields', NULL,
    'raw_text', "instructions"
  );

COMMIT;
