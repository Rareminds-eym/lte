BEGIN;

ALTER TABLE public."courses"
  ALTER COLUMN "observable_behavior" TYPE jsonb
  USING CASE
    WHEN "observable_behavior" IS NULL OR btrim("observable_behavior") = '' THEN '[]'::jsonb
    ELSE jsonb_build_array("observable_behavior")
  END;

ALTER TABLE public."courses"
  ALTER COLUMN "observable_behavior" SET DEFAULT '[]'::jsonb,
  ALTER COLUMN "observable_behavior" SET NOT NULL;

COMMIT;
