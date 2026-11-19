-- LOCAL COLLEGE DEMO ONLY. Engineering and MBA links, first module, Engage only.
-- Keep original curriculum-reference text and use actual exported LMS course IDs.
BEGIN;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.modules_content mc JOIN public.modules m ON m.id=mc.module_id JOIN public.levels l ON l.id=m.level_id JOIN public.capabilities c ON c.id=l.capability_id WHERE c.code='RIV-CAP-01' AND m.module_no=1 AND mc.stage_name='engage')<>1 THEN RAISE EXCEPTION 'Expected one Problem Identification first-module Engage stage'; END IF;
END $$;
UPDATE public.modules_content mc
SET curriculum_reference=(CASE
 WHEN jsonb_typeof(mc.curriculum_reference)='object' THEN mc.curriculum_reference
 WHEN jsonb_typeof(mc.curriculum_reference)='array' THEN
 jsonb_build_object('source_reference',mc.curriculum_reference)||coalesce((
 SELECT jsonb_object_agg(trim(split_part(entry,':',1)),trim(substr(entry,strpos(entry,':')+1)))
 FROM jsonb_array_elements_text(mc.curriculum_reference) a(entry) WHERE strpos(entry,':')>1
 ),'{}'::jsonb)
 ELSE '{}'::jsonb END)||jsonb_build_object('lms_courses','[{"course_id": "11c04f89-3f30-4e15-bd4c-cc9dac40819b", "code": "RM-ENG-07", "title": "Environmental Chemistry and Pollutant Transformations"}, {"course_id": "686e4743-39eb-4098-8549-1871d65e4892", "code": "RM-ENG-06", "title": "General Chemistry for Water Engineers"}, {"course_id": "264d8e8b-f14e-41f1-8a05-65494eb2c5ad", "code": "RM-ENG-04", "title": "Fluid Mechanics and River Hydraulics"}, {"course_id": "c00276d0-489d-424d-ac57-e47cc7f68dfb", "code": "RM-ENG-10", "title": "Water Quality Parameters and Their Relationships"}]'::jsonb),updated_at=now()
FROM public.modules m JOIN public.levels l ON l.id=m.level_id JOIN public.capabilities c ON c.id=l.capability_id
WHERE mc.module_id=m.id AND c.code='RIV-CAP-01' AND m.module_no=1 AND mc.stage_name='engage';
-- MBA: Data Quality & Analytics, first module, Engage only.
DO $$ BEGIN
 IF (SELECT count(*) FROM public.modules_content mc JOIN public.modules m ON m.id=mc.module_id JOIN public.levels l ON l.id=m.level_id JOIN public.capabilities c ON c.id=l.capability_id WHERE c.code='RIV-CAP-06' AND m.module_no=1 AND mc.stage_name='engage')<>1 THEN RAISE EXCEPTION 'Expected one Data Quality and Analytics first-module Engage stage'; END IF;
END $$;
UPDATE public.modules_content mc
SET curriculum_reference=(CASE
 WHEN jsonb_typeof(mc.curriculum_reference)='object' THEN mc.curriculum_reference
 WHEN jsonb_typeof(mc.curriculum_reference)='array' THEN
 jsonb_build_object('source_reference',mc.curriculum_reference)||coalesce((
 SELECT jsonb_object_agg(trim(split_part(entry,':',1)),trim(substr(entry,strpos(entry,':')+1)))
 FROM jsonb_array_elements_text(mc.curriculum_reference) a(entry) WHERE strpos(entry,':')>1
 ),'{}'::jsonb)
 ELSE '{}'::jsonb END)||jsonb_build_object('lms_courses','[{"course_id": "a5b09ec3-c792-4173-be26-875080659a8c", "code": "RM-ENG-14", "title": "Environmental Data Analysis and Scientific Reasoning"}, {"course_id": "a8b5b1e6-ae27-4b23-9661-969b725571bf", "code": "RM-ENG-15", "title": "Environmental Monitoring, Risk and Engineering Decisions"}, {"course_id": "a347445e-edcf-4684-881f-ede210aabba1", "code": "RM-ENG-11", "title": "Sampling Instruments and Laboratory Quality"}]'::jsonb),updated_at=now()
FROM public.modules m JOIN public.levels l ON l.id=m.level_id JOIN public.capabilities c ON c.id=l.capability_id
WHERE mc.module_id=m.id AND c.code='RIV-CAP-06' AND m.module_no=1 AND mc.stage_name='engage';
COMMIT;
