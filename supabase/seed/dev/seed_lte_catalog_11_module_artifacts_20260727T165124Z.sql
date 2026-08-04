-- Generated from LTE_LEARNING_CATALOG_TEMPLATE.xlsx: public.module_artifacts.
-- Edit the Excel template and rerun scripts/excel_to_lte_seed.py.
-- ON CONFLICT DO NOTHING keeps this seed safe to rerun.

BEGIN;

-- public.module_artifacts
INSERT INTO public."module_artifacts" ("id", "modules_content_id", "artifact_type", "total_score", "passing_score", "is_active")
VALUES ('fc3b022f-135b-569e-a5e4-63f3e91a18c8'::uuid, 'b3fce0a2-ce90-50b2-bd9a-5e0544d4ba87'::uuid, 'practice'::public.lte_artifact_type, 20, 12, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."module_artifacts" ("id", "modules_content_id", "artifact_type", "total_score", "passing_score", "is_active")
VALUES ('bda47fb5-c7a2-5379-ade0-3213b38a4bf8'::uuid, '1812dd59-483b-5b34-88d5-157b86fb3801'::uuid, 'practice'::public.lte_artifact_type, 20, 12, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."module_artifacts" ("id", "modules_content_id", "artifact_type", "total_score", "passing_score", "is_active")
VALUES ('7336d607-35ea-5036-8b55-580767dda89b'::uuid, 'da000269-2331-5314-9195-61f407425ecd'::uuid, 'practice'::public.lte_artifact_type, 20, 12, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."module_artifacts" ("id", "modules_content_id", "artifact_type", "total_score", "passing_score", "is_active")
VALUES ('bf5260af-952f-5bc6-9805-40e00b785fab'::uuid, '1a4de1c0-6748-503c-b923-d4fbbe62134b'::uuid, 'practice'::public.lte_artifact_type, 20, 12, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."module_artifacts" ("id", "modules_content_id", "artifact_type", "total_score", "passing_score", "is_active")
VALUES ('2d47e5d6-eace-5acd-a80b-b362351309bd'::uuid, 'f39245a7-5594-57dc-8bb0-f6645a6f983d'::uuid, 'practice'::public.lte_artifact_type, 20, 12, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."module_artifacts" ("id", "modules_content_id", "artifact_type", "total_score", "passing_score", "is_active")
VALUES ('de69b051-e2ab-56b2-a17a-87bd54042672'::uuid, '62f14bd1-7495-5f8b-a806-00e2081fb5d5'::uuid, 'practice'::public.lte_artifact_type, 20, 12, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."module_artifacts" ("id", "modules_content_id", "artifact_type", "total_score", "passing_score", "is_active")
VALUES ('f90d981e-929e-5359-8e0c-92989e7ca89f'::uuid, '43801986-7a75-58c2-8b17-70b45a7a32be'::uuid, 'final'::public.lte_artifact_type, 20, 12, TRUE)
ON CONFLICT DO NOTHING;

COMMIT;
