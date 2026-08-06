-- Seed: Normalize e_content.xp_reward to 1 XP per content item (TRD-DB-007).
-- The UPDATE fires trg_sync_level_total_xp for every touched row, backfilling
-- levels.total_xp (run AFTER migration 20260805120000_add_levels_total_xp_column).
-- Idempotent: reruns are no-ops.
BEGIN;

UPDATE public."e_content"
SET "xp_reward" = 1
WHERE "xp_reward" IS DISTINCT FROM 1;

COMMIT;
