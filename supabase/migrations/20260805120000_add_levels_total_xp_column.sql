-- Migration: Add explicit total_xp column to public.levels and auto-sync triggers
-- Phase: 1 of 3 (Expand)
-- Breaking: No
-- Rollback: Safe —
--   DROP TRIGGER trg_sync_level_total_xp ON public.e_content;
--   DROP TRIGGER trg_sync_level_total_xp_modules ON public.modules;
--   DROP TRIGGER trg_sync_level_total_xp_modules_content ON public.modules_content;
--   DROP FUNCTION public.sync_level_total_xp();
--   ALTER TABLE public.levels DROP COLUMN total_xp;
--
-- Context: Level cards show XP rewards; totals are derived from e_content.xp_reward
-- via triggers so they stay correct as catalog content changes. Triggers cover
-- e_content (content add/edit/delete), modules (level moves) and modules_content
-- (module moves between levels).
--
-- Deployment order:
-- 1. Run this migration
-- 2. Run seed 15 (dev or production) to normalize xp_reward = 1; the UPDATE fires
--    the sync trigger for every touched row and backfills levels.total_xp.
BEGIN;

-- 1. Add total_xp column to levels table with default 0 (trigger will populate from e_content.xp_reward)
ALTER TABLE public."levels"
  ADD COLUMN IF NOT EXISTS "total_xp" integer DEFAULT 0 NOT NULL;

-- Idempotent constraint add (Postgres has no ADD CONSTRAINT IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_levels_total_xp' AND conrelid = 'public.levels'::regclass
  ) THEN
    ALTER TABLE public."levels"
      ADD CONSTRAINT "chk_levels_total_xp" CHECK ("total_xp" >= 0);
  END IF;
END;
$$;

-- 2. Create PostgreSQL trigger function to sync levels.total_xp from e_content.xp_reward sum.
--    Dispatches on the firing table: modules (level_id moves), modules_content
--    (module moves between levels) or e_content (content changes).
CREATE OR REPLACE FUNCTION public.sync_level_total_xp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  target_level_ids uuid[] := '{}';
  target_level_id uuid;
  computed_xp integer;
BEGIN
  IF TG_TABLE_NAME = 'modules' THEN
    -- modules.level_id is the level directly
    IF TG_OP = 'UPDATE' THEN
      target_level_ids := ARRAY[OLD.level_id, NEW.level_id];
    ELSE
      target_level_ids := ARRAY[COALESCE(NEW.level_id, OLD.level_id)];
    END IF;
  ELSIF TG_TABLE_NAME = 'modules_content' THEN
    -- modules_content.module_id links to a level via modules
    IF TG_OP = 'UPDATE' THEN
      SELECT m.level_id INTO target_level_id
      FROM public.modules m
      WHERE m.id = OLD.module_id;
      target_level_ids := ARRAY[target_level_id];
      SELECT m.level_id INTO target_level_id
      FROM public.modules m
      WHERE m.id = NEW.module_id;
      target_level_ids := target_level_ids || target_level_id;
    ELSE
      SELECT m.level_id INTO target_level_id
      FROM public.modules m
      WHERE m.id = COALESCE(NEW.module_id, OLD.module_id);
      target_level_ids := ARRAY[target_level_id];
    END IF;
  ELSE
    -- e_content.modules_content_id links to a level via modules_content -> modules
    IF TG_OP = 'DELETE' THEN
      SELECT m.level_id INTO target_level_id
      FROM public.modules m
      JOIN public.modules_content mc ON mc.module_id = m.id
      WHERE mc.id = OLD.modules_content_id;
      target_level_ids := ARRAY[target_level_id];
    ELSIF TG_OP = 'UPDATE' AND OLD.modules_content_id IS DISTINCT FROM NEW.modules_content_id THEN
      -- Content moved between modules: refresh both the source and target levels
      SELECT m.level_id INTO target_level_id
      FROM public.modules m
      JOIN public.modules_content mc ON mc.module_id = m.id
      WHERE mc.id = OLD.modules_content_id;
      target_level_ids := ARRAY[target_level_id];
      SELECT m.level_id INTO target_level_id
      FROM public.modules m
      JOIN public.modules_content mc ON mc.module_id = m.id
      WHERE mc.id = NEW.modules_content_id;
      target_level_ids := target_level_ids || target_level_id;
    ELSE
      SELECT m.level_id INTO target_level_id
      FROM public.modules m
      JOIN public.modules_content mc ON mc.module_id = m.id
      WHERE mc.id = NEW.modules_content_id;
      target_level_ids := ARRAY[target_level_id];
    END IF;
  END IF;

  FOREACH target_level_id IN ARRAY target_level_ids LOOP
    IF target_level_id IS NOT NULL THEN
      SELECT COALESCE(SUM(ec.xp_reward), 0) INTO computed_xp
      FROM public.modules m
      JOIN public.modules_content mc ON mc.module_id = m.id
      JOIN public.e_content ec ON ec.modules_content_id = mc.id
      WHERE m.level_id = target_level_id;

      UPDATE public.levels
      SET total_xp = computed_xp
      WHERE id = target_level_id;
    END IF;
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 3. Create Triggers on e_content, modules and modules_content
DROP TRIGGER IF EXISTS trg_sync_level_total_xp ON public.e_content;

CREATE TRIGGER trg_sync_level_total_xp
  AFTER INSERT OR UPDATE OR DELETE ON public.e_content
  FOR EACH ROW EXECUTE FUNCTION public.sync_level_total_xp();

DROP TRIGGER IF EXISTS trg_sync_level_total_xp_modules ON public.modules;

CREATE TRIGGER trg_sync_level_total_xp_modules
  AFTER INSERT OR UPDATE OR DELETE ON public.modules
  FOR EACH ROW EXECUTE FUNCTION public.sync_level_total_xp();

DROP TRIGGER IF EXISTS trg_sync_level_total_xp_modules_content ON public.modules_content;

CREATE TRIGGER trg_sync_level_total_xp_modules_content
  AFTER INSERT OR UPDATE OR DELETE ON public.modules_content
  FOR EACH ROW EXECUTE FUNCTION public.sync_level_total_xp();

COMMIT;
