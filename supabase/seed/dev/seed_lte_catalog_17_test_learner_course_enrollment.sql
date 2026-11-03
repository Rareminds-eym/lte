-- ============================================================================
-- LTE dev seed: map the test learner to her SkillPassport assessment + one playable course.
-- Learner    : amruthareddy.9353@gmail.com (SSO user id 59dc759d-45ff-4d14-b7f3-34c435cbf4ae)
-- Assessment : SkillPassport personal_assessment_results 910b740b-7d59-4536-b692-ac4a94604435
--              (college, created 2026-06-09). HIGH cluster 'Business Analytics & Operations Support',
--              matchScore 46; skill-gap recommended track 'AI/ML Telemetry Systems Development'
--              (priority A skills used as topics). learning_tracks.assessment_id has no FK.
--
-- Path 1 (assessment-true, NOT playable): role Securities Operations Associate
--   (a5a29608-..., the first entry role of the HIGH cluster). The catalog has NO levels/modules/content
--   for the capabilities of any role in her assessment (Securities Operations Associate, Business
--   Analyst, Decision Support Analyst, nor the MEDIUM/EXPLORE roles), so this path gets
--   learning_path + user_capabilities only, status 'not_started', and no level progress rows.
--
-- Tracks (all from the assessment's career-fit clusters; only the HIGH one is active-if-none):
--   ...0011 HIGH    'Business Analytics & Operations Support' (46): Securities Operations Associate,
--                   Business Analyst, Decision Support Analyst (all not_started)
--   ...0012 MEDIUM  'Technology & Training Support' (53): Tech Risk Controls Testing Analyst,
--                   HR Technology Specialist, Skill Trainer (all not_started, inactive track)
--   ...0013 EXPLORE 'Consulting & Product Development' (49): Technical Consultant, AI Consultant,
--                   Product Manager (all not_started, inactive track)
-- Every not_started path also gets user_capabilities rows (no level progress; no content exists).
--
-- Path 2 (TEST-ONLY STAND-IN, does NOT match her assessment): role Credit Processing Associate
--   with level BCP_CREDIT_L1 "Industry, Role & Course Readiness" (7 published modules, 42 modules_content,
--   42 e_content, 14 artifacts, 14 questions, 14 templates). It is the only fully populated course
--   and exists purely so the LTE flow can be exercised. This is the only 'in_progress' path.
--
-- Remove path 2 (and its level progress insert) once content exists for the assessment roles.
-- Must sort after the catalog seeds (01-16). DML only, idempotent (ON CONFLICT DO NOTHING).
-- Runs under `npm run db:reset:dev`.
-- ============================================================================
BEGIN;

-- Learner mirror (user_profiles row is created by trigger trg_create_user_profile).
INSERT INTO public.users (id, email, first_name, status)
VALUES ('59dc759d-45ff-4d14-b7f3-34c435cbf4ae', 'amruthareddy.9353@gmail.com', 'Amrutha', 'active')
ON CONFLICT DO NOTHING;

-- Drop the earlier placeholder track (credit-only, fake assessment id) if a previous seed run created it.
DELETE FROM public.learning_tracks
WHERE id = '5d1c0a10-0000-4000-8000-000000000001'
  AND assessment_id = '5d1c0a10-0000-4000-8000-0000000000a1';

-- Learning track from the real assessment (one active track per learner; only activate if none is active yet).
INSERT INTO public.learning_tracks (id, user_id, assessment_id, fit, track, match_score, topics, duration, why_it_fits, is_active)
SELECT '5d1c0a10-0000-4000-8000-000000000011', u.id, '910b740b-7d59-4536-b692-ac4a94604435',
       'High', 'Business Analytics & Operations Support', 46,
       '["AI/ML Anomaly Detection Algorithms", "Real-Time Telemetry Processing", "Baseline Anomaly Detection Workflows"]'::jsonb,
       '6 months',
       'Aligns with her BTech in Computer Science: programming knowledge and analytical skills support data-analysis and operations-support roles. Strong investigative and enterprising RIASEC fit.',
       NOT EXISTS (SELECT 1 FROM public.learning_tracks t WHERE t.user_id = u.id AND t.is_active)
FROM public.users u WHERE u.id = '59dc759d-45ff-4d14-b7f3-34c435cbf4ae'
ON CONFLICT DO NOTHING;

-- MEDIUM and EXPLORE clusters: inactive tracks (only one active track per learner).
INSERT INTO public.learning_tracks (id, user_id, assessment_id, fit, track, match_score, topics, duration, why_it_fits, is_active)
SELECT v.id::uuid, u.id, '910b740b-7d59-4536-b692-ac4a94604435', v.fit, v.track, v.score, v.topics::jsonb, '6 months', v.why, false
FROM public.users u,
(VALUES
  ('5d1c0a10-0000-4000-8000-000000000012', 'Medium', 'Technology & Training Support', 53,
   '["Real-Time Telemetry Processing", "LLM Integration for Reporting", "AI Workflow Control Systems", "Predictive Analytics for Telemetry"]',
   'Technical background plus interest in supporting others; moderate RIASEC alignment.'),
  ('5d1c0a10-0000-4000-8000-000000000013', 'Explore', 'Consulting & Product Development', 49,
   '["AI/ML Anomaly Detection Algorithms", "LLM Integration for Reporting", "AI Workflow Control Systems", "Predictive Analytics for Telemetry"]',
   'Less aligned with her stream, but leverages her programming knowledge.')
) AS v(id, fit, track, score, topics, why)
WHERE u.id = '59dc759d-45ff-4d14-b7f3-34c435cbf4ae'
ON CONFLICT DO NOTHING;

-- Path 1: assessment role (Securities Operations Associate); no content exists, so not started.
INSERT INTO public.learning_paths (id, learning_track_id, user_id, role_id, level, status, metadata)
SELECT '5d1c0a10-0000-4000-8000-000000000003', t.id, t.user_id, r.id, 1, 'not_started',
       '{"source": "assessment", "note": "No LTE course content exists for this role yet"}'::jsonb
FROM public.learning_tracks t
JOIN public.roles r ON r.id = 'a5a29608-4629-5e5d-b798-506da01fe222'
WHERE t.id = '5d1c0a10-0000-4000-8000-000000000011'
ON CONFLICT DO NOTHING;

-- Remaining HIGH roles (Business Analyst, Decision Support Analyst): not started, no content.
INSERT INTO public.learning_paths (id, learning_track_id, user_id, role_id, level, status, metadata)
SELECT v.id::uuid, t.id, t.user_id, r.id, 1, 'not_started',
       '{"source": "assessment", "note": "No LTE course content exists for this role yet"}'::jsonb
FROM (VALUES
  ('5d1c0a10-0000-4000-8000-000000000004', '5d1c0a10-0000-4000-8000-000000000011', 'd54b3cbd-883a-50d3-a01b-aa98be2851ae'),
  ('5d1c0a10-0000-4000-8000-000000000005', '5d1c0a10-0000-4000-8000-000000000011', '269b7ca7-1295-5b41-8b45-f6854622573c'),
  ('5d1c0a10-0000-4000-8000-000000000007', '5d1c0a10-0000-4000-8000-000000000012', '77c283f4-f190-59a2-8777-a370c1021e0e'),
  ('5d1c0a10-0000-4000-8000-000000000008', '5d1c0a10-0000-4000-8000-000000000012', '66e72ba5-409a-58ab-a9db-27c133d8ab80'),
  ('5d1c0a10-0000-4000-8000-000000000009', '5d1c0a10-0000-4000-8000-000000000012', '7319aa77-dbae-5250-ae94-21c41a80fb13'),
  ('5d1c0a10-0000-4000-8000-00000000000a', '5d1c0a10-0000-4000-8000-000000000013', 'd63723fb-50ce-52ec-9d89-e2377f009829'),
  ('5d1c0a10-0000-4000-8000-00000000000b', '5d1c0a10-0000-4000-8000-000000000013', 'b0984acb-2e23-5b01-8bf1-5659078a64db'),
  ('5d1c0a10-0000-4000-8000-00000000000c', '5d1c0a10-0000-4000-8000-000000000013', 'aba07dfc-1ae1-5667-adf3-6ee7c754436c')
) AS v(id, track_id, role_id)
JOIN public.learning_tracks t ON t.id = v.track_id::uuid
JOIN public.roles r ON r.id = v.role_id::uuid
ON CONFLICT DO NOTHING;

-- Path 2: TEST-ONLY stand-in (Credit Processing Associate), does NOT match her assessment.
INSERT INTO public.learning_paths (id, learning_track_id, user_id, role_id, level, status, started_at, metadata)
SELECT '5d1c0a10-0000-4000-8000-000000000002', t.id, t.user_id, r.id, 1, 'in_progress', now(),
       '{"industry": "Banking, Capital Markets & Payments", "source": "dev-seed-standin", "note": "Test-only course, not from her assessment"}'::jsonb
FROM public.learning_tracks t
JOIN public.roles r ON r.id = 'a5d71f85-2773-5a01-9115-86a72b37018b'
WHERE t.id = '5d1c0a10-0000-4000-8000-000000000011'
ON CONFLICT DO NOTHING;

-- Capability gaps for every capability of both roles (mirrors public.import_learner_tracks).
INSERT INTO public.user_capabilities (user_id, learning_path_id, role_sequence_id, current_level, required_level, gap, has_gap, gap_score)
SELECT p.user_id, p.id, s.id, 0,
       CASE WHEN s.required_level::text ~ '^L[1-5]$' THEN right(s.required_level::text, 1)::int ELSE 1 END,
       CASE WHEN s.required_level::text ~ '^L[1-5]$' THEN right(s.required_level::text, 1)::int ELSE 1 END,
       true, 0
FROM public.learning_paths p
JOIN public.role_capability_sequence s ON s.role_id = p.role_id
WHERE p.id IN ('5d1c0a10-0000-4000-8000-000000000002', '5d1c0a10-0000-4000-8000-000000000003',
               '5d1c0a10-0000-4000-8000-000000000004', '5d1c0a10-0000-4000-8000-000000000005',
               '5d1c0a10-0000-4000-8000-000000000007', '5d1c0a10-0000-4000-8000-000000000008',
               '5d1c0a10-0000-4000-8000-000000000009', '5d1c0a10-0000-4000-8000-00000000000a',
               '5d1c0a10-0000-4000-8000-00000000000b', '5d1c0a10-0000-4000-8000-00000000000c')
ON CONFLICT DO NOTHING;

-- Enroll in the stand-in course only: BCP_CREDIT_L1 level progress for path 2.
INSERT INTO public.user_capability_level_progress
  (user_id, learning_path_id, level_id, sequence_no, from_level, to_level, current_score, current_level,
   required_level, gap, has_gap, gap_score, status, started_at)
SELECT p.user_id, p.id, l.id, s.sequence_step, 0, 1, 0, 0, 1, 1, true, 0, 'in_progress', now()
FROM public.learning_paths p
JOIN public.role_capability_sequence s ON s.role_id = p.role_id
JOIN public.levels l ON l.capability_id = s.capability_id AND l.level_code = 'BCP_CREDIT_L1'
WHERE p.id = '5d1c0a10-0000-4000-8000-000000000002'
ON CONFLICT DO NOTHING;

COMMIT;
