-- Generated from LTE_LEARNING_CATALOG_TEMPLATE.xlsx: public.artifact_templates.
-- Edit the Excel template and rerun scripts/excel_to_lte_seed.py.
-- ON CONFLICT DO NOTHING keeps this seed safe to rerun.

BEGIN;

-- public.artifact_templates
INSERT INTO public."artifact_templates" ("id", "artifact_id", "question_id", "file_name", "file_url", "file_type", "version", "is_downloadable")
VALUES ('1f06128b-baac-5707-b845-4023cdc824dd'::uuid, 'fc3b022f-135b-569e-a5e4-63f3e91a18c8'::uuid, 'b5fc4ee1-dbc6-5ea9-9d6d-b265ed9fb601'::uuid, 'Module_0_Guided_Arrival_Course_Readiness_Artifact.xlsx', 'https://bucket.lte.rareminds.in/resources/capabilities/HTT-IND-CAP-01/courses/HTT_L1/modules-0/artifacts/practice/templates/Module_0_Guided_Arrival_Course_Readiness_Artifact.xlsx', 'excel'::public.lte_file_type, 1, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."artifact_templates" ("id", "artifact_id", "question_id", "file_name", "file_url", "file_type", "version", "is_downloadable")
VALUES ('c27c3561-1fb1-5f02-9424-3bde0f656159'::uuid, 'bda47fb5-c7a2-5379-ade0-3213b38a4bf8'::uuid, 'f34a240b-1e45-54d2-936a-ec448785afa2'::uuid, 'Module_1_Guided_Arrival_Case_Intake_Note_Artifact.xlsx', 'https://bucket.lte.rareminds.in/resources/capabilities/HTT-IND-CAP-01/courses/HTT_L1/modules-1/artifacts/practice/templates/Module_1_Guided_Arrival_Case_Intake_Note_Artifact.xlsx', 'excel'::public.lte_file_type, 1, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."artifact_templates" ("id", "artifact_id", "question_id", "file_name", "file_url", "file_type", "version", "is_downloadable")
VALUES ('97454941-9fe4-5fb7-90a3-73f944501f4c'::uuid, '7336d607-35ea-5036-8b55-580767dda89b'::uuid, 'e2400924-4696-54f2-ba32-a44f2fc07e5b'::uuid, 'Module_2_Guided_Arrival_Evidence_Validation_Checklist_Artifact.xlsx', 'https://bucket.lte.rareminds.in/resources/capabilities/HTT-IND-CAP-01/courses/HTT_L1/modules-2/artifacts/practice/templates/Module_2_Guided_Arrival_Evidence_Validation_Checklist_Artifact.xlsx', 'excel'::public.lte_file_type, 1, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."artifact_templates" ("id", "artifact_id", "question_id", "file_name", "file_url", "file_type", "version", "is_downloadable")
VALUES ('4cfacab0-637b-5f73-9ac6-e77ce5d00862'::uuid, 'bf5260af-952f-5bc6-9805-40e00b785fab'::uuid, 'fefc9afa-3aa8-544d-8873-cd9a89e5e26a'::uuid, 'Module_3_Guided_Arrival_Action_or_Handoff_Note_Artifact.xlsx', 'https://bucket.lte.rareminds.in/resources/capabilities/HTT-IND-CAP-01/courses/HTT_L1/modules-3/artifacts/practice/templates/Module_3_Guided_Arrival_Action_or_Handoff_Note_Artifact.xlsx', 'excel'::public.lte_file_type, 1, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."artifact_templates" ("id", "artifact_id", "question_id", "file_name", "file_url", "file_type", "version", "is_downloadable")
VALUES ('1310d0ff-2b32-5936-885b-00344a41d811'::uuid, '2d47e5d6-eace-5acd-a80b-b362351309bd'::uuid, '563bcbdb-e3ce-54c1-8191-829913c8cf09'::uuid, 'Module_4_Guided_Arrival_Risk_and_Escalation_Note_Artifact.xlsx', 'https://bucket.lte.rareminds.in/resources/capabilities/HTT-IND-CAP-01/courses/HTT_L1/modules-4/artifacts/practice/templates/Module_4_Guided_Arrival_Risk_and_Escalation_Note_Artifact.xlsx', 'excel'::public.lte_file_type, 1, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."artifact_templates" ("id", "artifact_id", "question_id", "file_name", "file_url", "file_type", "version", "is_downloadable")
VALUES ('10e82f42-402e-5933-8877-7524273426f2'::uuid, 'de69b051-e2ab-56b2-a17a-87bd54042672'::uuid, '39cb826a-d903-5bc9-a09d-a0c5209964de'::uuid, 'Module_5_Guided_Arrival_Quality_and_Closure_Report_Artifact.xlsx', 'https://bucket.lte.rareminds.in/resources/capabilities/HTT-IND-CAP-01/courses/HTT_L1/modules-5/artifacts/practice/templates/Module_5_Guided_Arrival_Quality_and_Closure_Report_Artifact.xlsx', 'excel'::public.lte_file_type, 1, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."artifact_templates" ("id", "artifact_id", "question_id", "file_name", "file_url", "file_type", "version", "is_downloadable")
VALUES ('85fa2d07-f88b-5530-9165-f937c7fffc2e'::uuid, 'f90d981e-929e-5359-8e0c-92989e7ca89f'::uuid, '1e0dd5fd-2fde-587d-a2fe-02d38ebed6c5'::uuid, 'Module_6_Guided_Arrival_Final_Portfolio_Pack_Artifact.xlsx', 'https://bucket.lte.rareminds.in/resources/capabilities/HTT-IND-CAP-01/courses/HTT_L1/modules-6/artifacts/final/templates/Module_6_Guided_Arrival_Final_Portfolio_Pack_Artifact.xlsx', 'excel'::public.lte_file_type, 1, TRUE)
ON CONFLICT DO NOTHING;

COMMIT;
