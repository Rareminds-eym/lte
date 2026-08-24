-- Generated from LTE_LEARNING_CATALOG_CAP037_L1_L2_L3_L4_L5_BLOCKERS_CORRECTED.xlsx: public.artifact_templates.
-- Edit the Excel template and rerun scripts/excel_to_lte_seed.py.
-- ON CONFLICT DO NOTHING keeps this seed safe to rerun.

BEGIN;

-- public.artifact_templates
INSERT INTO public."artifact_templates" ("id", "artifact_id", "question_id", "file_name", "file_url", "file_type", "version", "is_downloadable")
VALUES ('eb03e44b-59dd-5271-bc63-fae1584ae779'::uuid, '5e1e45f2-9e32-5055-8fb1-338d9a25b8d0'::uuid, '73050239-27ae-581c-a874-9c8d38ec6dcc'::uuid, 'CAP037_L1_M0_GenAI_Workflow_Entry_Record_Template_with_Rubric.xlsx', 'https://bucket.lte.rareminds.in/resources/capabilities/ITS-CAP-037/levels/CAP037_L1/modules-0/artifacts/practice/templates/CAP037_L1_M0_GenAI_Workflow_Entry_Record_Template_with_Rubric.xlsx', 'excel'::public.lte_file_type, 1, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."artifact_templates" ("id", "artifact_id", "question_id", "file_name", "file_url", "file_type", "version", "is_downloadable")
VALUES ('be089b10-27e4-573e-9f8a-6178d2aa9cb6'::uuid, '50680fa9-d2c5-5b8d-bd1d-d5579dbc5a13'::uuid, '8e44bc6c-47c9-59ad-9166-72dbbe455bbb'::uuid, 'CAP037_L1_M1_Annotated_GenAI_Workflow_Map_Template_with_Rubric.xlsx', 'https://bucket.lte.rareminds.in/resources/capabilities/ITS-CAP-037/levels/CAP037_L1/modules-1/artifacts/final/templates/CAP037_L1_M1_Annotated_GenAI_Workflow_Map_Template_with_Rubric.xlsx', 'excel'::public.lte_file_type, 1, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."artifact_templates" ("id", "artifact_id", "question_id", "file_name", "file_url", "file_type", "version", "is_downloadable")
VALUES ('dca4ae6c-1b1d-5b2b-9f22-a8f0bad0f54f'::uuid, 'e2b3beb5-7170-5b95-96e6-779d47eca0aa'::uuid, '4cfd53a6-a622-5184-90a6-62ddc6987649'::uuid, 'CAP037_L1_M2_Evidence_Classification_Register_Template_with_Rubric.xlsx', 'https://bucket.lte.rareminds.in/resources/capabilities/ITS-CAP-037/levels/CAP037_L1/modules-2/artifacts/final/templates/CAP037_L1_M2_Evidence_Classification_Register_Template_with_Rubric.xlsx', 'excel'::public.lte_file_type, 1, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."artifact_templates" ("id", "artifact_id", "question_id", "file_name", "file_url", "file_type", "version", "is_downloadable")
VALUES ('fd0b9538-555c-5a88-bbe4-680c9e0006df'::uuid, '0842e16b-5293-5fff-ab65-d6f37718bd61'::uuid, '73dd1223-d1d3-5a34-9abc-b28f1e31b6cb'::uuid, 'CAP037_L1_M3_GenAI_Response_Signal_Scan_Template_with_Rubric.xlsx', 'https://bucket.lte.rareminds.in/resources/capabilities/ITS-CAP-037/levels/CAP037_L1/modules-3/artifacts/final/templates/CAP037_L1_M3_GenAI_Response_Signal_Scan_Template_with_Rubric.xlsx', 'excel'::public.lte_file_type, 1, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."artifact_templates" ("id", "artifact_id", "question_id", "file_name", "file_url", "file_type", "version", "is_downloadable")
VALUES ('9569104b-ae3b-557b-a6a2-e63856571164'::uuid, '682673ae-9153-5f81-8466-229e00a85380'::uuid, '7968b88f-6fa9-57ba-8bfa-49796d58d6e5'::uuid, 'CAP037_L1_M4_GenAI_Workflow_Review_Handoff_Pack_Template_with_Rubric.xlsx', 'https://bucket.lte.rareminds.in/resources/capabilities/ITS-CAP-037/levels/CAP037_L1/modules-4/artifacts/final/templates/CAP037_L1_M4_GenAI_Workflow_Review_Handoff_Pack_Template_with_Rubric.xlsx', 'excel'::public.lte_file_type, 1, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."artifact_templates" ("id", "artifact_id", "question_id", "file_name", "file_url", "file_type", "version", "is_downloadable")
VALUES ('c10b99fe-81cd-5ecd-816f-b1d22328f811'::uuid, 'd5c03703-f95a-5f64-b332-9a0b8ca91276'::uuid, '84413a5b-aae2-58f9-b2fc-3432e7cb50c9'::uuid, 'CAP037_L1_M5_Safe_First_Review_Action_Record_Template_with_Rubric.xlsx', 'https://bucket.lte.rareminds.in/resources/capabilities/ITS-CAP-037/levels/CAP037_L1/modules-5/artifacts/final/templates/CAP037_L1_M5_Safe_First_Review_Action_Record_Template_with_Rubric.xlsx', 'excel'::public.lte_file_type, 1, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."artifact_templates" ("id", "artifact_id", "question_id", "file_name", "file_url", "file_type", "version", "is_downloadable")
VALUES ('e7f40632-8e2a-50e2-b93b-f683dffbbe0c'::uuid, '26b9b371-3215-589e-aa19-f5e9444fe476'::uuid, 'dcd0e254-b54e-5a33-bcf9-8ca51985b8e0'::uuid, 'CAP037_L1_M6_L1_Evidence_Review_Portfolio_and_Transfer_Pack_Template_with_Rubric.xlsx', 'https://bucket.lte.rareminds.in/resources/capabilities/ITS-CAP-037/levels/CAP037_L1/modules-6/artifacts/final/templates/CAP037_L1_M6_L1_Evidence_Review_Portfolio_and_Transfer_Pack_Template_with_Rubric.xlsx', 'excel'::public.lte_file_type, 1, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."artifact_templates" ("id", "artifact_id", "question_id", "file_name", "file_url", "file_type", "version", "is_downloadable")
VALUES ('ed1b74a2-ff64-52e6-9c65-7a458ea2f31a'::uuid, '752d6553-615f-51bf-ae79-fc6fa76ffd92'::uuid, '25faf29f-754a-5d9e-a29f-abba9e517c2e'::uuid, 'CAP037_L2_M0_L2_Readiness_and_Authority_Record_Template.xlsx', 'https://bucket.lte.rareminds.in/resources/capabilities/ITS-CAP-037/levels/CAP037_L2/modules-0/artifacts/final/templates/CAP037_L2_M0_L2_Readiness_and_Authority_Record_Template.xlsx', 'excel'::public.lte_file_type, 1, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."artifact_templates" ("id", "artifact_id", "question_id", "file_name", "file_url", "file_type", "version", "is_downloadable")
VALUES ('cb068e35-34a1-5d01-a1f3-62d3f9042285'::uuid, 'c8e2ac6b-c26b-562f-97a4-9eb5197d85cb'::uuid, '9485d7d1-83c9-50c5-ab03-ab76b7244a4a'::uuid, 'CAP037_L2_M1_Workflow_Requirement_Brief_Template.xlsx', 'https://bucket.lte.rareminds.in/resources/capabilities/ITS-CAP-037/levels/CAP037_L2/modules-1/artifacts/final/templates/CAP037_L2_M1_Workflow_Requirement_Brief_Template.xlsx', 'excel'::public.lte_file_type, 1, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."artifact_templates" ("id", "artifact_id", "question_id", "file_name", "file_url", "file_type", "version", "is_downloadable")
VALUES ('7dff0ef8-dfda-576c-8478-e1b03957d8d6'::uuid, '0d04dbfc-18c2-550b-8174-019266f290e9'::uuid, '4d0b61f1-f23e-52fd-b1f8-99291ef0da86'::uuid, 'CAP037_L2_M2_Prompt_Assembly_Record_Template.xlsx', 'https://bucket.lte.rareminds.in/resources/capabilities/ITS-CAP-037/levels/CAP037_L2/modules-2/artifacts/final/templates/CAP037_L2_M2_Prompt_Assembly_Record_Template.xlsx', 'excel'::public.lte_file_type, 1, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."artifact_templates" ("id", "artifact_id", "question_id", "file_name", "file_url", "file_type", "version", "is_downloadable")
VALUES ('98dd557a-9322-5373-b29a-5330a01fe865'::uuid, '6d1a2601-8141-560f-b2dd-4f865bfac025'::uuid, '4b2a6b6b-52f5-5fb6-9c45-7d4f78ef11de'::uuid, 'CAP037_L2_M3_Source_Connection_Checklist_Template.xlsx', 'https://bucket.lte.rareminds.in/resources/capabilities/ITS-CAP-037/levels/CAP037_L2/modules-3/artifacts/final/templates/CAP037_L2_M3_Source_Connection_Checklist_Template.xlsx', 'excel'::public.lte_file_type, 1, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."artifact_templates" ("id", "artifact_id", "question_id", "file_name", "file_url", "file_type", "version", "is_downloadable")
VALUES ('2a187009-3b53-5c75-b8d0-a5233d65ecb9'::uuid, '3771c8a0-2172-50ef-aea9-f1f64630928d'::uuid, 'ab9887d4-8704-5d94-a65b-97fca2cc729a'::uuid, 'CAP037_L2_M4_Sandbox_Configuration_Record_Template.xlsx', 'https://bucket.lte.rareminds.in/resources/capabilities/ITS-CAP-037/levels/CAP037_L2/modules-4/artifacts/final/templates/CAP037_L2_M4_Sandbox_Configuration_Record_Template.xlsx', 'excel'::public.lte_file_type, 1, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."artifact_templates" ("id", "artifact_id", "question_id", "file_name", "file_url", "file_type", "version", "is_downloadable")
VALUES ('be3b3f3e-dc71-55db-9884-593c665fae06'::uuid, '900c3c1b-2666-5939-b2cc-ff261bcf98c4'::uuid, '3f271883-2fa8-5a80-a043-dec7cb948f5c'::uuid, 'CAP037_L2_M5_Test_Execution_Log_Template.xlsx', 'https://bucket.lte.rareminds.in/resources/capabilities/ITS-CAP-037/levels/CAP037_L2/modules-5/artifacts/final/templates/CAP037_L2_M5_Test_Execution_Log_Template.xlsx', 'excel'::public.lte_file_type, 1, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."artifact_templates" ("id", "artifact_id", "question_id", "file_name", "file_url", "file_type", "version", "is_downloadable")
VALUES ('3f3f2664-1d94-5bc5-8ce8-1c74fc5d46e5'::uuid, '1085831e-4c42-5856-baad-a6c09ac63e48'::uuid, '152ff5f4-0e23-563a-8396-dc7d240902eb'::uuid, 'CAP037_L2_M6_Supported_GenAI_Workflow_Build_and_Test_Pack_Template.xlsx', 'https://bucket.lte.rareminds.in/resources/capabilities/ITS-CAP-037/levels/CAP037_L2/modules-6/artifacts/final/templates/CAP037_L2_M6_Supported_GenAI_Workflow_Build_and_Test_Pack_Template.xlsx', 'excel'::public.lte_file_type, 1, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."artifact_templates" ("id", "artifact_id", "question_id", "file_name", "file_url", "file_type", "version", "is_downloadable")
VALUES ('80f05ac4-d1be-52a9-9cbb-02389f87c3a8'::uuid, '6fb6285a-d4a0-50d3-b092-0850dbd2cae7'::uuid, '5ec44e47-d9ac-5bd4-af54-9898285acac8'::uuid, 'L3_Builder_Readiness_and_Authority_Record_Template_with_Rubric.xlsx', 'https://bucket.lte.rareminds.in/resources/capabilities/ITS-CAP-037/levels/CAP037_L3/modules-0/artifacts/final/templates/CAP037_L3_M0_L3_Builder_Readiness_and_Authority_Record_Template_with_Rubric.xlsx', 'excel'::public.lte_file_type, 1.0, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."artifact_templates" ("id", "artifact_id", "question_id", "file_name", "file_url", "file_type", "version", "is_downloadable")
VALUES ('5fb0c48e-dff0-5a3e-984f-c38fe0e0fe51'::uuid, '006ac214-c19e-5351-a550-31c2b4752ff3'::uuid, '6688d5e3-60bc-57fc-ac07-e53b52058661'::uuid, 'Workflow_Objective_and_Acceptance_Criteria_Brief_Template_with_Rubric.xlsx', 'https://bucket.lte.rareminds.in/resources/capabilities/ITS-CAP-037/levels/CAP037_L3/modules-1/artifacts/final/templates/CAP037_L3_M1_Workflow_Objective_and_Acceptance_Criteria_Brief_Template_with_Rubric.xlsx', 'excel'::public.lte_file_type, 1.0, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."artifact_templates" ("id", "artifact_id", "question_id", "file_name", "file_url", "file_type", "version", "is_downloadable")
VALUES ('c04d7498-a55a-5d27-a27e-ca86b67976ae'::uuid, 'cd046cba-a5d6-5298-9b18-5e3e0f948f53'::uuid, 'c281fa07-c68b-5478-8465-b3626b162617'::uuid, 'Prompt_Workflow_Design_Record_Template_with_Rubric.xlsx', 'https://bucket.lte.rareminds.in/resources/capabilities/ITS-CAP-037/levels/CAP037_L3/modules-2/artifacts/final/templates/CAP037_L3_M2_Prompt_Workflow_Design_Record_Template_with_Rubric.xlsx', 'excel'::public.lte_file_type, 1.0, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."artifact_templates" ("id", "artifact_id", "question_id", "file_name", "file_url", "file_type", "version", "is_downloadable")
VALUES ('4fc66bc6-e642-5590-8139-e2f1e45c7dca'::uuid, 'ba2f1856-d4af-5c56-8f4b-688051ad48a9'::uuid, 'e0848375-c5d4-58db-87d1-cc665d5190ca'::uuid, 'Context_Configuration_and_Retrieval_Record_Template_with_Rubric.xlsx', 'https://bucket.lte.rareminds.in/resources/capabilities/ITS-CAP-037/levels/CAP037_L3/modules-3/artifacts/final/templates/CAP037_L3_M3_Context_Configuration_and_Retrieval_Record_Template_with_Rubric.xlsx', 'excel'::public.lte_file_type, 1.0, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."artifact_templates" ("id", "artifact_id", "question_id", "file_name", "file_url", "file_type", "version", "is_downloadable")
VALUES ('df9e163e-e09e-565b-9c54-fdc6fd6dcbfd'::uuid, 'b1c6f0d8-ed70-543d-8a30-b7fd3d1a33fe'::uuid, 'b9c48fee-47a9-51a9-b944-6719d6dcdf45'::uuid, 'Workflow_Validation_Test_Plan_Template_with_Rubric.xlsx', 'https://bucket.lte.rareminds.in/resources/capabilities/ITS-CAP-037/levels/CAP037_L3/modules-4/artifacts/final/templates/CAP037_L3_M4_Workflow_Validation_Test_Plan_Template_with_Rubric.xlsx', 'excel'::public.lte_file_type, 1.0, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."artifact_templates" ("id", "artifact_id", "question_id", "file_name", "file_url", "file_type", "version", "is_downloadable")
VALUES ('d4a3d652-1c26-5b8a-9179-df3c223a0c68'::uuid, '49fd2be1-b49a-51c6-a8c4-cabef785573c'::uuid, '4d5dbf96-f59a-58cc-9c6a-eb27cbd5fdf6'::uuid, 'CAP037_L3_M5_Test_Run_and_Routine_Defect_Resolution_Log_Template_with_Rubric.xlsx', 'https://bucket.lte.rareminds.in/resources/capabilities/ITS-CAP-037/levels/CAP037_L3/modules-5/artifacts/final/templates/CAP037_L3_M5_Test_Run_and_Routine_Defect_Resolution_Log_Template_with_Rubric.xlsx', 'excel'::public.lte_file_type, 1.0, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."artifact_templates" ("id", "artifact_id", "question_id", "file_name", "file_url", "file_type", "version", "is_downloadable")
VALUES ('fb6668ab-28c4-58ca-846e-24212023e621'::uuid, '9a2933e3-6504-54cb-8a7f-7bda432b57e1'::uuid, '512673f5-8a76-532c-925f-4ffb6cd8117d'::uuid, 'Standard_GenAI_Workflow_Validation_Handoff_Pack_Template_with_Rubric.xlsx', 'https://bucket.lte.rareminds.in/resources/capabilities/ITS-CAP-037/levels/CAP037_L3/modules-6/artifacts/final/templates/CAP037_L3_M6_Standard_GenAI_Workflow_Validation_Handoff_Pack_Template_with_Rubric.xlsx', 'excel'::public.lte_file_type, 1.0, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."artifact_templates" ("id", "artifact_id", "question_id", "file_name", "file_url", "file_type", "version", "is_downloadable")
VALUES ('6eb0775c-f914-5ac2-bfc8-940825ee2e31'::uuid, '7b61ec91-7cbb-5b54-bd2d-33b37f8e90f3'::uuid, '58fa695f-da04-547e-b599-c169ddffdad9'::uuid, 'CAP037_L4_M0_L4_Adaptive_Authority_and_Ambiguity_Readiness_Record_Template_with_Rubric.xlsx', 'https://bucket.lte.rareminds.in/resources/capabilities/ITS-CAP-037/levels/CAP037_L4/modules-0/artifacts/final/templates/CAP037_L4_M0_L4_Adaptive_Authority_and_Ambiguity_Readiness_Record_Template_with_Rubric.xlsx', 'excel'::public.lte_file_type, 1, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."artifact_templates" ("id", "artifact_id", "question_id", "file_name", "file_url", "file_type", "version", "is_downloadable")
VALUES ('30d0a0e9-a951-57c9-a7f2-9a4f1c0f52e3'::uuid, '6219194c-375d-553d-8395-b8115b1fa5fd'::uuid, 'f34d2cd0-1262-5f41-b017-f8a58896a704'::uuid, 'CAP037_L4_M1_Ambiguous_Workflow_Change_Interpretation_Brief_Template_with_Rubric.xlsx', 'https://bucket.lte.rareminds.in/resources/capabilities/ITS-CAP-037/levels/CAP037_L4/modules-1/artifacts/final/templates/CAP037_L4_M1_Ambiguous_Workflow_Change_Interpretation_Brief_Template_with_Rubric.xlsx', 'excel'::public.lte_file_type, 1, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."artifact_templates" ("id", "artifact_id", "question_id", "file_name", "file_url", "file_type", "version", "is_downloadable")
VALUES ('be347c67-1bad-5bc2-ab8f-575314e09864'::uuid, '6331aeb5-d9cf-50ec-a805-e354707fb360'::uuid, '07700b3d-b78b-50dd-acc5-e7bddbbc3861'::uuid, 'CAP037_L4_M2_Adaptive_Prompt_and_Workflow_Option_Comparison_Matrix_Template_with_Rubric.xlsx', 'https://bucket.lte.rareminds.in/resources/capabilities/ITS-CAP-037/levels/CAP037_L4/modules-2/artifacts/final/templates/CAP037_L4_M2_Adaptive_Prompt_and_Workflow_Option_Comparison_Matrix_Template_with_Rubric.xlsx', 'excel'::public.lte_file_type, 1, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."artifact_templates" ("id", "artifact_id", "question_id", "file_name", "file_url", "file_type", "version", "is_downloadable")
VALUES ('8a6793a0-eea7-5f22-aba7-a7c2c66e9be4'::uuid, '4ce5dbaf-c039-57c3-80c6-3d762b6adeb3'::uuid, '005647d4-51c5-503b-9300-9671ffef46c8'::uuid, 'CAP037_L4_M3_Context_Adaptation_and_Retrieval_Risk_Record_Template_with_Rubric.xlsx', 'https://bucket.lte.rareminds.in/resources/capabilities/ITS-CAP-037/levels/CAP037_L4/modules-3/artifacts/final/templates/CAP037_L4_M3_Context_Adaptation_and_Retrieval_Risk_Record_Template_with_Rubric.xlsx', 'excel'::public.lte_file_type, 1, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."artifact_templates" ("id", "artifact_id", "question_id", "file_name", "file_url", "file_type", "version", "is_downloadable")
VALUES ('16d87f1b-e72d-5295-90fa-cea8c6e72cf5'::uuid, 'c99730d6-5a18-56df-af4b-504fb87eacd6'::uuid, '18449455-ebb0-5485-bd50-b277049da2c5'::uuid, 'CAP037_L4_M4_Adaptive_Workflow_Test_Coverage_Plan_Template_with_Rubric.xlsx', 'https://bucket.lte.rareminds.in/resources/capabilities/ITS-CAP-037/levels/CAP037_L4/modules-4/artifacts/final/templates/CAP037_L4_M4_Adaptive_Workflow_Test_Coverage_Plan_Template_with_Rubric.xlsx', 'excel'::public.lte_file_type, 1, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."artifact_templates" ("id", "artifact_id", "question_id", "file_name", "file_url", "file_type", "version", "is_downloadable")
VALUES ('29f80362-9059-57bc-acb7-59ff45c6f22e'::uuid, 'd5cab8a5-4a9f-5530-aad0-f52b5a4b9882'::uuid, '639b6419-e810-580a-a79f-465f8ab00109'::uuid, 'CAP037_L4_M5_Adaptive_Test_Evidence_Evaluation_Record_Template_with_Rubric.xlsx', 'sandbox:/mnt/data/CAP037_L4_Artifact_Templates/CAP037_L4_M5_Adaptive_Test_Evidence_Evaluation_Record_Template_with_Rubric.xlsx', 'excel'::public.lte_file_type, 1, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."artifact_templates" ("id", "artifact_id", "question_id", "file_name", "file_url", "file_type", "version", "is_downloadable")
VALUES ('1c691078-d4ae-5b4e-903a-a340284adb9d'::uuid, '38187024-bc61-581c-bd91-9a937d07fe6c'::uuid, 'a70ee02d-770d-5e66-8e29-fc3120d79e54'::uuid, 'CAP037_L4_M6_Adaptive_GenAI_Workflow_Design_Recommendation_Pack_Template_with_Rubric.xlsx', 'https://bucket.lte.rareminds.in/resources/capabilities/ITS-CAP-037/levels/CAP037_L4/modules-6/artifacts/final/templates/CAP037_L4_M6_Adaptive_GenAI_Workflow_Design_Recommendation_Pack_Template_with_Rubric.xlsx', 'excel'::public.lte_file_type, 1, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."artifact_templates" ("id", "artifact_id", "question_id", "file_name", "file_url", "file_type", "version", "is_downloadable")
VALUES ('c9bb7033-07f1-5503-94b8-b785c9fdf809'::uuid, '7875e32f-10fb-5735-8b84-69af6498a280'::uuid, 'f46117ae-dbb6-56e6-89a4-4a33868955e2'::uuid, 'CAP037_L5_M0_L5_Leadership_Authority_and_Governance_Readiness_Record_Template_with_Rubric.xlsx', 'https://bucket.lte.rareminds.in/resources/capabilities/ITS-CAP-037/levels/CAP037_L5/modules-0/artifacts/final/templates/CAP037_L5_M0_L5_Leadership_Authority_and_Governance_Readiness_Record_Template_with_Rubric.xlsx', 'excel'::public.lte_file_type, 1, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."artifact_templates" ("id", "artifact_id", "question_id", "file_name", "file_url", "file_type", "version", "is_downloadable")
VALUES ('b9b61feb-dacd-5bc7-bf71-2ec0424c47d7'::uuid, 'a679624b-59cc-5921-8a0f-b5fd6a43c7f4'::uuid, '5bb227ae-1e5b-5eb4-8004-abd9532e8f86'::uuid, 'CAP037_L5_M1_GenAI_Workflow_Design_Standard_Template_with_Rubric.xlsx', 'https://bucket.lte.rareminds.in/resources/capabilities/ITS-CAP-037/levels/CAP037_L5/modules-1/artifacts/final/templates/CAP037_L5_M1_GenAI_Workflow_Design_Standard_Template_with_Rubric.xlsx', 'excel'::public.lte_file_type, 1, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."artifact_templates" ("id", "artifact_id", "question_id", "file_name", "file_url", "file_type", "version", "is_downloadable")
VALUES ('dd8ccef5-c035-5cd1-867f-ef0173626f7b'::uuid, '8d84df78-1774-5927-b717-4c5a62edf5c5'::uuid, 'a4ce9731-14fa-53d6-ba24-8499a696c938'::uuid, 'CAP037_L5_M2_Prompt_and_Context_Pattern_Library_Entry_Template_with_Rubric.xlsx', 'https://bucket.lte.rareminds.in/resources/capabilities/ITS-CAP-037/levels/CAP037_L5/modules-2/artifacts/final/templates/CAP037_L5_M2_Prompt_and_Context_Pattern_Library_Entry_Template_with_Rubric.xlsx', 'excel'::public.lte_file_type, 1, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."artifact_templates" ("id", "artifact_id", "question_id", "file_name", "file_url", "file_type", "version", "is_downloadable")
VALUES ('19b2357c-f47c-5983-a03e-fc7936be5d41'::uuid, '69982da9-13bb-55e6-b87a-740c6f60596b'::uuid, '94cace9f-a473-528c-9d79-8088645ac941'::uuid, 'CAP037_L5_M3_Evaluation_and_Governance_Control_Plan_Template_with_Rubric.xlsx', 'https://bucket.lte.rareminds.in/resources/capabilities/ITS-CAP-037/levels/CAP037_L5/modules-3/artifacts/final/templates/CAP037_L5_M3_Evaluation_and_Governance_Control_Plan_Template_with_Rubric.xlsx', 'excel'::public.lte_file_type, 1, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."artifact_templates" ("id", "artifact_id", "question_id", "file_name", "file_url", "file_type", "version", "is_downloadable")
VALUES ('5731dd48-6de5-50b9-91f1-6ca7691d46d2'::uuid, 'a53776fe-e637-5ee3-8b50-d5de2efc97ac'::uuid, 'f944938d-f811-51e8-a309-10d15643b435'::uuid, 'CAP037_L5_M4_Systemic_Workflow_Weakness_Analysis_Template_with_Rubric.xlsx', 'https://bucket.lte.rareminds.in/resources/capabilities/ITS-CAP-037/levels/CAP037_L5/modules-4/artifacts/final/templates/CAP037_L5_M4_Systemic_Workflow_Weakness_Analysis_Template_with_Rubric.xlsx', 'excel'::public.lte_file_type, 1, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."artifact_templates" ("id", "artifact_id", "question_id", "file_name", "file_url", "file_type", "version", "is_downloadable")
VALUES ('e0214b32-ed2c-5ea5-a86f-950d1c8a3237'::uuid, '3bef052c-b434-51a2-b146-733905c7a519'::uuid, 'd5aa8941-1cf2-5d48-b0e7-965d08cb0a15'::uuid, 'CAP037_L5_M5_Reviewer_Coaching_and_Practice_Improvement_Plan_Template_with_Rubric.xlsx', 'https://bucket.lte.rareminds.in/resources/capabilities/ITS-CAP-037/levels/CAP037_L5/modules-5/artifacts/final/templates/CAP037_L5_M5_Reviewer_Coaching_and_Practice_Improvement_Plan_Template_with_Rubric.xlsx', 'excel'::public.lte_file_type, 1, TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public."artifact_templates" ("id", "artifact_id", "question_id", "file_name", "file_url", "file_type", "version", "is_downloadable")
VALUES ('782b3066-8c33-57a7-8186-acb630bccfca'::uuid, '3881e8c8-1e23-53d4-be4b-4dcc2670d3eb'::uuid, 'c9907bfb-fdd9-5a99-8e9e-b83c8c99bc15'::uuid, 'CAP037_L5_M6_L5_GenAI_Workflow_Governance_and_Scale_Pack_Template_with_Rubric.xlsx', 'https://bucket.lte.rareminds.in/resources/capabilities/ITS-CAP-037/levels/CAP037_L5/modules-6/artifacts/final/templates/CAP037_L5_M6_L5_GenAI_Workflow_Governance_and_Scale_Pack_Template_with_Rubric.xlsx', 'excel'::public.lte_file_type, 1, TRUE)
ON CONFLICT DO NOTHING;

COMMIT;
