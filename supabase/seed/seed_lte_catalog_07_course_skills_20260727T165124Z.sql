-- Generated from LTE_LEARNING_CATALOG_TEMPLATE.xlsx: public.course_skills.
-- Edit the Excel template and rerun scripts/excel_to_lte_seed.py.
-- ON CONFLICT DO NOTHING keeps this seed safe to rerun.

BEGIN;

-- public.course_skills
INSERT INTO public."course_skills" ("id", "course_id", "skill_id")
VALUES ('910f09f1-5281-5864-9c08-2938eef1fdb0'::uuid, '0a010796-10c0-5287-b89a-6ab56bd71399'::uuid, '2370cc9b-bb66-5ace-9cfd-e3907bc9be37'::uuid)
ON CONFLICT DO NOTHING;
INSERT INTO public."course_skills" ("id", "course_id", "skill_id")
VALUES ('6bf09d87-9b0a-5f49-b6b0-39bd42ed6ad8'::uuid, '0a010796-10c0-5287-b89a-6ab56bd71399'::uuid, '0b5e8893-a2a7-5622-8d9a-1f3951a676cd'::uuid)
ON CONFLICT DO NOTHING;
INSERT INTO public."course_skills" ("id", "course_id", "skill_id")
VALUES ('679b3a51-3d83-582f-9808-aa8b9956a06b'::uuid, '0a010796-10c0-5287-b89a-6ab56bd71399'::uuid, '3680861a-9f9d-5d45-bb35-6f8e2e345257'::uuid)
ON CONFLICT DO NOTHING;
INSERT INTO public."course_skills" ("id", "course_id", "skill_id")
VALUES ('606c0659-cd00-571c-a6a7-d977c77466ff'::uuid, '0a010796-10c0-5287-b89a-6ab56bd71399'::uuid, '2382fc3b-dd54-54b6-9846-969a2bf560c7'::uuid)
ON CONFLICT DO NOTHING;
INSERT INTO public."course_skills" ("id", "course_id", "skill_id")
VALUES ('39d2d0c6-8e0f-508d-8b4a-505ed0d84d4e'::uuid, '0a010796-10c0-5287-b89a-6ab56bd71399'::uuid, 'af4131f4-4cfd-50dd-9e2c-f61337400adf'::uuid)
ON CONFLICT DO NOTHING;
INSERT INTO public."course_skills" ("id", "course_id", "skill_id")
VALUES ('67276203-1f9c-5cb4-adcf-081decea59db'::uuid, '0a010796-10c0-5287-b89a-6ab56bd71399'::uuid, '7ae2d40c-3a20-5110-a830-1aafaebd7d36'::uuid)
ON CONFLICT DO NOTHING;

COMMIT;
