-- ============================================================================
-- LTE dev seed: map one fully-populated course to a test learner.
-- Learner : amruthareddy.9353@gmail.com (SSO user id 59dc759d-45ff-4d14-b7f3-34c435cbf4ae)
-- Course  : BCP_CREDIT_L1 "Industry, Role & Course Readiness" level (7 published modules,
--           42 modules_content stages, 42 e_content, 14 artifacts, 14 questions, 14 templates)
-- Role    : Credit Processing Associate (BCP-CAP-CREDIT-001 is sequence step 1, required L5)
-- Must sort after the catalog seeds (01-16) so roles/levels/sequences already exist.
-- DML only, safe to rerun (ON CONFLICT DO NOTHING). Runs under `npm run db:reset:dev`.
-- ============================================================================
BEGIN;

-- Learner mirror (user_profiles row is created by trigger trg_create_user_profile).
INSERT INTO public.users (id, email, first_name, status)
VALUES ('59dc759d-45ff-4d14-b7f3-34c435cbf4ae', 'amruthareddy.9353@gmail.com', 'Amrutha', 'active')
ON CONFLICT DO NOTHING;

-- Learning track (one active track per learner; only activate if none is active yet).
INSERT INTO public.learning_tracks (id, user_id, assessment_id, fit, track, match_score, topics, duration, why_it_fits, is_active)
SELECT '5d1c0a10-0000-4000-8000-000000000001', u.id, '5d1c0a10-0000-4000-8000-0000000000a1',
       'High', 'Credit Evaluation and Underwriting Support', 90, '[]'::jsonb, '6 months',
       'Dev test track: maps the learner to the fully populated BCP Credit course.',
       NOT EXISTS (SELECT 1 FROM public.learning_tracks t WHERE t.user_id = u.id AND t.is_active)
FROM public.users u WHERE u.id = '59dc759d-45ff-4d14-b7f3-34c435cbf4ae'
ON CONFLICT DO NOTHING;

-- Learning path (role) in progress at level 1.
INSERT INTO public.learning_paths (id, learning_track_id, user_id, role_id, level, status, started_at, metadata)
SELECT '5d1c0a10-0000-4000-8000-000000000002', t.id, t.user_id, r.id, 1, 'in_progress', now(),
       '{"industry": "Banking, Capital Markets & Payments"}'::jsonb
FROM public.learning_tracks t
JOIN public.roles r ON r.id = 'a5d71f85-2773-5a01-9115-86a72b37018b'
WHERE t.id = '5d1c0a10-0000-4000-8000-000000000001'
ON CONFLICT DO NOTHING;

-- Capability gaps for every capability of the role (mirrors public.import_learner_tracks).
INSERT INTO public.user_capabilities (user_id, learning_path_id, role_sequence_id, current_level, required_level, gap, has_gap, gap_score)
SELECT p.user_id, p.id, s.id, 0,
       CASE WHEN s.required_level::text ~ '^L[1-5]$' THEN right(s.required_level::text, 1)::int ELSE 1 END,
       CASE WHEN s.required_level::text ~ '^L[1-5]$' THEN right(s.required_level::text, 1)::int ELSE 1 END,
       true, 0
FROM public.learning_paths p
JOIN public.role_capability_sequence s ON s.role_id = p.role_id
WHERE p.id = '5d1c0a10-0000-4000-8000-000000000002'
ON CONFLICT DO NOTHING;

-- Enroll in the course: BCP_CREDIT_L1 level progress for the path.
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
