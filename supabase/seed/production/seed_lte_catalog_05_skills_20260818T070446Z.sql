-- Generated from LTE_LEARNING_CATALOG_CAP_CREDIT_001_FINAL_VALIDATED.xlsx: public.skills.
-- Edit the Excel template and rerun scripts/excel_to_lte_seed.py.
-- ON CONFLICT DO NOTHING keeps this seed safe to rerun.

BEGIN;

-- public.skills
INSERT INTO public."skills" ("id", "code", "name", "description", "tags")
VALUES ('c6b697c0-a6dd-526c-8987-b3198551d21c'::uuid, 'CREDIT_SK001', 'Inspect and record borrower evidence', 'Inspect borrower-file records and capture exact visible facts, source IDs, dates/periods and unresolved items without filling gaps by assumption.', '["borrower evidence", "evidence intake", "source trace", "fact recording", "missing evidence", "credit support"]'::jsonb)
ON CONFLICT DO NOTHING;
INSERT INTO public."skills" ("id", "code", "name", "description", "tags")
VALUES ('cf01c457-ce92-5e03-9ab9-1a4268925c89'::uuid, 'CREDIT_SK002', 'Classify evidence status using supplied rules', 'Apply approved status labels to received, missing, inconsistent, dependency-pending and control-sensitive evidence using the supplied rule set.', '["status classification", "pre-screen rules", "evidence pending", "dependency pending", "control review", "checklist"]'::jsonb)
ON CONFLICT DO NOTHING;
INSERT INTO public."skills" ("id", "code", "name", "description", "tags")
VALUES ('46035cf5-13b7-5285-9bc1-72ac5874edba'::uuid, 'CREDIT_SK003', 'Route unresolved evidence and dependencies', 'Identify the visible next owner or safely record owner uncertainty, and route gaps, dependencies or exceptions without inventing ownership.', '["owner routing", "dependency routing", "escalation", "relationship manager", "reviewer queue", "owner uncertainty"]'::jsonb)
ON CONFLICT DO NOTHING;
INSERT INTO public."skills" ("id", "code", "name", "description", "tags")
VALUES ('bc514aa9-e474-5f39-aff3-05247eb59825'::uuid, 'CREDIT_SK004', 'Prepare boundary-safe reviewer handoffs', 'Create factual, traceable handoff notes and summaries that support authorised reviewers while keeping approval and credit judgement outside the learner role.', '["reviewer handoff", "support note", "boundary safe", "credit authority", "traceability", "handoff quality"]'::jsonb)
ON CONFLICT DO NOTHING;
INSERT INTO public."skills" ("id", "code", "name", "description", "tags")
VALUES ('c3dc4ab5-b14c-5d2f-8bf4-e85620dd02a4'::uuid, 'CREDIT_SK005', 'Analyse evidence conflicts and exceptions', 'Separate facts, claims and signals, classify non-routine evidence conflicts and exceptions, and identify the operational consequence without unsupported conclusions.', '["exception analysis", "evidence conflict", "fact vs claim", "source of truth", "linked party", "exposure"]'::jsonb)
ON CONFLICT DO NOTHING;
INSERT INTO public."skills" ("id", "code", "name", "description", "tags")
VALUES ('0d6a7b68-1941-5f50-a212-c43a97ed57dc'::uuid, 'CREDIT_SK006', 'Prioritise exceptions and escalation routes', 'Defend exception urgency, operational impact and escalation order using evidence, approved labels and visible ownership.', '["priority", "urgency", "escalation route", "exception routing", "reviewer support", "operational impact"]'::jsonb)
ON CONFLICT DO NOTHING;
INSERT INTO public."skills" ("id", "code", "name", "description", "tags")
VALUES ('1a7ef354-ce5c-5f90-9393-02cb022e3238'::uuid, 'CREDIT_SK007', 'Integrate multi-packet evidence and dependencies', 'Baseline multiple support packets, versions and cross-functional dependencies so the combined reviewer-support output remains traceable and complete.', '["multi-packet", "integration", "dependency map", "version control", "cross functional", "traceability"]'::jsonb)
ON CONFLICT DO NOTHING;
INSERT INTO public."skills" ("id", "code", "name", "description", "tags")
VALUES ('05163033-d0f7-5506-a910-41bfb688cdba'::uuid, 'CREDIT_SK008', 'Correct and optimise appraisal-support outputs', 'Identify support-quality defects, correct unsupported language without altering source evidence, coordinate rework and optimise reviewer usability.', '["quality review", "correction", "rework", "optimisation", "appraisal support", "reviewer usability"]'::jsonb)
ON CONFLICT DO NOTHING;
INSERT INTO public."skills" ("id", "code", "name", "description", "tags")
VALUES ('5e2bc55b-f4cc-5c47-8924-cb989ba37925'::uuid, 'CREDIT_SK009', 'Govern queue readiness and recurring defects', 'Baseline queue/SLA signals, analyse recurring quality defects and prepare supervised governance actions for authorised owners.', '["workflow governance", "queue readiness", "SLA", "defect trend", "quality pattern", "supervised governance"]'::jsonb)
ON CONFLICT DO NOTHING;
INSERT INTO public."skills" ("id", "code", "name", "description", "tags")
VALUES ('315193fa-79c2-5295-a27a-fcadb26b92c0'::uuid, 'CREDIT_SK010', 'Coach junior work and propose controlled improvements', 'Review junior support work, record coaching/rework needs and prepare evidence-backed template or workflow improvement proposals within supervised authority.', '["coaching", "junior review", "controlled improvement", "workflow proposal", "governance handoff", "quality lead"]'::jsonb)
ON CONFLICT DO NOTHING;

COMMIT;
