BEGIN;

ALTER TABLE public."courses"
  ADD COLUMN IF NOT EXISTS "course_problem_statement" jsonb;

ALTER TABLE public."modules"
  ADD COLUMN IF NOT EXISTS "module_problem_statement" text;

ALTER TABLE public."modules_content"
  ADD COLUMN IF NOT EXISTS "stage_description" text,
  ADD COLUMN IF NOT EXISTS "module_context" text,
  ADD COLUMN IF NOT EXISTS "curriculum_reference" jsonb;

COMMIT;
