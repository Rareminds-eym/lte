-- Local demo: Level 1, Observe the Prepared Water Settle, Engage only.
-- The school catalog must already exist. Preserve its curriculum reference.
BEGIN;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.modules_content mc JOIN public.modules m ON m.id=mc.module_id
 WHERE mc.id='6d55a71e-a2b6-5606-89e9-551970c50468' AND m.id='6f186474-f8b8-5325-b6f6-de400efdd3dd'
 AND m.title='Observe the Prepared Water Settle' AND mc.stage_name='engage')<>1
 THEN RAISE EXCEPTION 'Expected school Level 1 Module 1 Engage content; apply school catalog first'; END IF;
END $$;
UPDATE public.modules_content mc
SET curriculum_reference=coalesce(mc.curriculum_reference,'{}'::jsonb)||jsonb_build_object(
 'lms_courses',coalesce((SELECT jsonb_agg(item) FROM jsonb_array_elements(
 coalesce(mc.curriculum_reference->'lms_courses','[]'::jsonb)) a(item)
 WHERE item->>'course_id'<>'acc91623-73af-404c-a8e1-aee4270b15ac'),'[]'::jsonb)
 ||jsonb_build_array(jsonb_build_object(
 'course_id','acc91623-73af-404c-a8e1-aee4270b15ac',
 'code','G10-CHEMISTRY-RIVER','title','Grade 10 Chemistry — River Water'))),
 updated_at=now()
WHERE mc.id='6d55a71e-a2b6-5606-89e9-551970c50468';
COMMIT;
