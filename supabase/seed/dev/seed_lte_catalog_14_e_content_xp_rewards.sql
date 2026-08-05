-- Seed: Update e_content items to have 1 XP reward
BEGIN;

UPDATE public."e_content"
SET "xp_reward" = 1
WHERE "xp_reward" IS DISTINCT FROM 1;

COMMIT;
