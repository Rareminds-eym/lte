BEGIN;

ALTER TABLE public."capabilities"
  ADD COLUMN IF NOT EXISTS "slug" varchar(120);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_capabilities_slug"
  ON public."capabilities" ("slug")
  WHERE "slug" IS NOT NULL;

ALTER TABLE public."modules"
  ADD COLUMN IF NOT EXISTS "pressure_points" text,
  ADD COLUMN IF NOT EXISTS "user_confusion" text,
  ADD COLUMN IF NOT EXISTS "industry_challenge" text,
  ADD COLUMN IF NOT EXISTS "prerequisites" text,
  ADD COLUMN IF NOT EXISTS "what_youll_learn" text,
  ADD COLUMN IF NOT EXISTS "when_to_apply" text;

COMMIT;
