-- Generated from LTE_LEARNING_CATALOG_TEMPLATE.xlsx: public.courses.
-- Edit the Excel template and rerun scripts/excel_to_lte_seed.py.
-- ON CONFLICT DO NOTHING keeps this seed safe to rerun.

BEGIN;

-- public.levels
INSERT INTO public."levels" ("id", "level_code", "capability_id", "level_id", "title", "description", "observable_behavior", "example_outputs", "problem_statement", "duration_minutes", "difficulty_level", "status", "version_no", "is_active")
VALUES ('0a010796-10c0-5287-b89a-6ab56bd71399'::uuid, 'HTT_L1', (SELECT "id" FROM public."capabilities" WHERE "code" = 'BCP-CAP-CM-001'), (SELECT "id" FROM public."level_scale" WHERE "level_no" = 1), 'Guided Guest and Visitor Arrival Readiness', 'Build guided L1 capability to verify guest and visitor arrival readiness through reservation, identity, PMS/payment, room status, SOP, and service-handoff evidence without crossing role authority.', '["With guidance, the learner identifies reservation, ID, room-status, payment/readiness, and handoff evidence", "completes low-risk guided actions", "prepares usable arrival checklist, front-office note, handoff proof, and escalation/closure reasoning."]'::jsonb, '["Course Readiness Sheet", "Case Intake Note", "Evidence Validation Checklist", "Action or Handoff Note", "Risk and Escalation Note", "Quality and Closure Report", "Final Portfolio Pack"]'::jsonb, '{"title": "Guided Guest and Visitor Arrival Readiness", "description": "A front-office team is preparing for a guest arrival, but the reservation record, guest identity evidence, room-status signal, and service handoff information must be checked before the learner can recommend a safe next step, request supervisor review, or prepare a role-safe handoff."}'::jsonb, 360, 'beginner'::public.difficulty_level, 'published'::public.status, 2, TRUE)
ON CONFLICT DO NOTHING;

COMMIT;
