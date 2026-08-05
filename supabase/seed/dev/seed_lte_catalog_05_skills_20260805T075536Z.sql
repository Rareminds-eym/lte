-- Generated from LTE_LEARNING_CATALOG_CAP037_L1_L2_L3_L4_L5_BLOCKERS_CORRECTED.xlsx: public.skills.
-- Edit the Excel template and rerun scripts/excel_to_lte_seed.py.
-- ON CONFLICT DO NOTHING keeps this seed safe to rerun.

BEGIN;

-- public.skills
INSERT INTO public."skills" ("id", "code", "name", "description", "tags")
VALUES ('9854d9a0-bda6-5ea3-8e44-8b54d374c728'::uuid, 'SKILL-037-L1', 'Classify GenAI Application and Prompt Workflow Design Work Objects', 'Learner recognises, identifies, classifies, records and safely hands off supplied GenAI workflow objects, evidence, claims and visible review signals within L1 authority.', '["GenAI workflow objects", "evidence classification", "visible signals", "uncertainty", "review handoff", "authority boundary", "human oversight"]'::jsonb)
ON CONFLICT DO NOTHING;
INSERT INTO public."skills" ("id", "code", "name", "description", "tags")
VALUES ('5691da83-4657-5a87-bb8b-6015e2b8bee7'::uuid, 'SKILL-037-L2', 'Execute Supported GenAI Application and Prompt Workflow Tasks', 'Learner performs bounded GenAI workflow requirement, prompt assembly, approved context connection, sandbox configuration, test execution, authorised revision and evidence handoff tasks using approved procedures and supervision.', '["supported GenAI workflow", "workflow requirements", "prompt assembly", "approved sources", "sandbox configuration", "test execution", "controlled revision", "evidence handoff", "authority boundary"]'::jsonb)
ON CONFLICT DO NOTHING;
INSERT INTO public."skills" ("id", "code", "name", "description", "tags")
VALUES ('a14134d3-7ecc-5de2-94ad-b9149b6cef6c'::uuid, 'SKILL-037-L3', 'Independently Build and Validate Standard GenAI Workflows', 'Learner independently defines objectives and acceptance criteria, designs standard prompt workflows, configures approved context and retrieval, plans and executes validation, resolves routine defects and prepares an accountable handoff within L3 authority.', '["standard GenAI workflow", "acceptance criteria", "prompt workflow design", "context retrieval", "validation planning", "routine defect resolution", "validation handoff", "escalation"]'::jsonb)
ON CONFLICT DO NOTHING;
INSERT INTO public."skills" ("id", "code", "name", "description", "tags")
VALUES ('e910366c-ed3a-5a10-839c-b12b66953ad7'::uuid, 'SKILL-037-L4', 'Adapt GenAI Workflows for Complex and Ambiguous Conditions', 'Learner interprets ambiguous workflow change requests, compares design options, adapts prompt and context strategies, expands test coverage, evaluates conflicting evidence and recommends defensible designs with explicit trade-offs, residual risks and escalation points.', '["ambiguous GenAI workflow", "adaptive prompt design", "option comparison", "context adaptation", "retrieval risk", "expanded testing", "trade-off analysis", "recommendation handoff", "governance boundary"]'::jsonb)
ON CONFLICT DO NOTHING;
INSERT INTO public."skills" ("id", "code", "name", "description", "tags")
VALUES ('449ff42e-2a3c-596e-b927-7023523b548d'::uuid, 'SKILL-037-L5', 'Govern and Scale GenAI Workflow Design Practice', 'Learner defines standards, reusable patterns, evaluation and governance controls, analyses systemic weaknesses, coaches reviewers and creates a scale-ready governance pack while preserving accountable approval and control ownership.', '["GenAI governance", "workflow standards", "pattern library", "evaluation controls", "systemic weakness analysis", "reviewer coaching", "practice improvement", "scale governance", "accountable ownership"]'::jsonb)
ON CONFLICT DO NOTHING;

COMMIT;
