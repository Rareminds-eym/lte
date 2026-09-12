-- Backfill canonical workspace mappings from the legacy catalog relationships.
-- The UI reads only the v1.5 mapping tables; it does not infer relationships at runtime.

BEGIN;

INSERT INTO public.capability_course_map (
  capability_id,
  course_id,
  sequence,
  mandatory,
  is_active,
  reason
)
SELECT
  level.capability_id,
  course.id,
  1,
  true,
  true,
  'BACKFILL_FROM_PUBLISHED_LEVEL'
FROM public.courses AS course
JOIN public.levels AS level
  ON level.level_code = course.course_code
WHERE level.is_active = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.capability_course_map AS existing
    WHERE existing.capability_id = level.capability_id
      AND existing.course_id = course.id
      AND existing.is_active = true
  );

INSERT INTO public.role_capability_map (
  role_id,
  capability_id,
  priority,
  required_level,
  is_active,
  reason
)
SELECT
  sequence.role_id,
  sequence.capability_id,
  COALESCE(sequence.sequence_step, 1),
  sequence.required_level::text,
  true,
  'BACKFILL_FROM_ROLE_CAPABILITY_SEQUENCE'
FROM public.role_capability_sequence AS sequence
JOIN public.roles AS role
  ON role.id = sequence.role_id
 AND role.deleted_at IS NULL
JOIN public.capabilities AS capability
  ON capability.id = sequence.capability_id
 AND capability.is_active = true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.role_capability_map AS existing
  WHERE existing.role_id = sequence.role_id
    AND existing.capability_id = sequence.capability_id
    AND existing.is_active = true
);

COMMIT;
