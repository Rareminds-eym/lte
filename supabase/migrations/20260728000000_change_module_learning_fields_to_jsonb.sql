BEGIN;

ALTER TABLE public."modules"
  ALTER COLUMN "pressure_points" TYPE jsonb
    USING COALESCE("pressure_points"::jsonb, '[]'::jsonb),
  ALTER COLUMN "pressure_points" SET DEFAULT '[]'::jsonb,
  ALTER COLUMN "pressure_points" SET NOT NULL,
  ALTER COLUMN "user_confusion" TYPE jsonb
    USING COALESCE("user_confusion"::jsonb, '[]'::jsonb),
  ALTER COLUMN "user_confusion" SET DEFAULT '[]'::jsonb,
  ALTER COLUMN "user_confusion" SET NOT NULL,
  ALTER COLUMN "prerequisites" TYPE jsonb
    USING COALESCE("prerequisites"::jsonb, '[]'::jsonb),
  ALTER COLUMN "prerequisites" SET DEFAULT '[]'::jsonb,
  ALTER COLUMN "prerequisites" SET NOT NULL,
  ALTER COLUMN "what_youll_learn" TYPE jsonb
    USING COALESCE("what_youll_learn"::jsonb, '[]'::jsonb),
  ALTER COLUMN "what_youll_learn" SET DEFAULT '[]'::jsonb,
  ALTER COLUMN "what_youll_learn" SET NOT NULL;

COMMIT;
