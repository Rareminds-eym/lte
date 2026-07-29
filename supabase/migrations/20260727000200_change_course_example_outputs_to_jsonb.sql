BEGIN;

ALTER TABLE public."levels"
  ALTER COLUMN "example_outputs" TYPE jsonb
  USING CASE
    WHEN "example_outputs" IS NULL OR btrim("example_outputs") = '' THEN '[]'::jsonb
    ELSE jsonb_build_array("example_outputs")
  END;

ALTER TABLE public."levels"
  ALTER COLUMN "example_outputs" SET DEFAULT '[]'::jsonb,
  ALTER COLUMN "example_outputs" SET NOT NULL;

COMMIT;
