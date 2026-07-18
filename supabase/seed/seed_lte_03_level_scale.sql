-- ============================================================================
-- LTE Seed: level scale (L1-L5)
-- ============================================================================

INSERT INTO public.level_scale (level_no, level_code, level_label, generic_definition) VALUES
  (1, 'L1', 'Beginner', 'Performs simple, well-defined tasks under close supervision; follows checklists and escalates anything unusual.'),
  (2, 'L2', 'Foundation', 'Handles routine work independently within clear procedures; recognises common exceptions and applies standard fixes.'),
  (3, 'L3', 'Intermediate', 'Works independently on varied tasks; diagnoses non-routine problems, adapts procedures, and reviews others'' routine output.'),
  (4, 'L4', 'Advanced', 'Owns complex work end to end; sets local standards, coaches others, and is trusted with judgement calls and sign-offs.'),
  (5, 'L5', 'Expert', 'Recognised authority; defines methods and standards, leads improvement, and handles the most ambiguous, high-impact problems.')
ON CONFLICT (level_no) DO UPDATE SET level_code = EXCLUDED.level_code, level_label = EXCLUDED.level_label, generic_definition = EXCLUDED.generic_definition, updated_at = now();
