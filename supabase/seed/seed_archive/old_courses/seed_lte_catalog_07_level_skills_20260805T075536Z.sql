-- Generated from LTE_LEARNING_CATALOG_CAP037_L1_L2_L3_L4_L5_BLOCKERS_CORRECTED.xlsx: public.level_skills.
-- Edit the Excel template and rerun scripts/excel_to_lte_seed.py.
-- ON CONFLICT DO NOTHING keeps this seed safe to rerun.

BEGIN;

-- public.level_skills
INSERT INTO public."level_skills" ("id", "level_id", "skill_id")
VALUES ('658e166f-52a2-5abb-838a-816ab42da4fb'::uuid, '417bcbcf-1354-516f-96af-7bbe5897bffb'::uuid, '9854d9a0-bda6-5ea3-8e44-8b54d374c728'::uuid)
ON CONFLICT DO NOTHING;
INSERT INTO public."level_skills" ("id", "level_id", "skill_id")
VALUES ('ea191e8b-74f9-5239-8b02-06dfc774b814'::uuid, '02c85598-3f29-50f3-bdba-deea3d62de79'::uuid, '5691da83-4657-5a87-bb8b-6015e2b8bee7'::uuid)
ON CONFLICT DO NOTHING;
INSERT INTO public."level_skills" ("id", "level_id", "skill_id")
VALUES ('9210bb72-1398-560c-8242-837fc17b3175'::uuid, '54eb917e-e5a9-5ebf-8c8d-cd8bac472907'::uuid, 'a14134d3-7ecc-5de2-94ad-b9149b6cef6c'::uuid)
ON CONFLICT DO NOTHING;
INSERT INTO public."level_skills" ("id", "level_id", "skill_id")
VALUES ('73882c5f-be05-552c-88cb-2f3cf17624ed'::uuid, '0899a455-1166-5d00-810d-8594e8c29ef9'::uuid, 'e910366c-ed3a-5a10-839c-b12b66953ad7'::uuid)
ON CONFLICT DO NOTHING;
INSERT INTO public."level_skills" ("id", "level_id", "skill_id")
VALUES ('db102d23-1560-5641-9b42-b4f057c6c258'::uuid, '3aa64007-0085-5217-9951-c1f64ff9ee7c'::uuid, '449ff42e-2a3c-596e-b927-7023523b548d'::uuid)
ON CONFLICT DO NOTHING;

COMMIT;
