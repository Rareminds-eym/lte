-- Dev-only seed: five levels for BCP-CAP-CM-001.
-- Keep production seed separate; developer course variants belong here.

BEGIN;

INSERT INTO public."levels" (
  "id",
  "level_code",
  "capability_id",
  "level_id",
  "title",
  "description",
  "observable_behavior",
  "example_outputs",
  "problem_statement",
  "duration_minutes",
  "difficulty_level",
  "status",
  "version_no",
  "is_active"
)
SELECT
  v.id::uuid,
  v.level_code,
  c.id,
  ls.id,
  v.title,
  v.description,
  v.observable_behavior::jsonb,
  v.example_outputs::jsonb,
  v.problem_statement::jsonb,
  v.duration_minutes,
  v.difficulty_level::public.difficulty_level,
  'published'::public.status,
  1,
  TRUE
FROM (
  VALUES
    (
      '5b9b6c73-8cc2-4d78-9f66-5390d4455f11',
      'BCP-CAP-CM-001-L1',
      1,
      'Guided Trade Record Intake',
      'Build guided L1 capability to capture securities trade lifecycle records, verify required fields, identify missing evidence, and prepare supervisor-reviewable handoff notes without giving trade advice.',
      '["Identifies basic trade record fields with guidance", "Checks source evidence against a checklist", "Flags missing, unclear, or mismatched data for review"]',
      '["Trade Intake Checklist", "Missing Evidence Note", "Supervisor Handoff Summary"]',
      '{"title": "Guided Trade Record Intake", "description": "A back-office learner receives a securities trade record with incomplete booking details and must capture the available evidence, identify missing fields, and prepare a safe handoff for review without interpreting market advice or approving the trade."}',
      240,
      'beginner'
    ),
    (
      '0f6d27c4-12a6-45f1-bb25-8a5c8d7f2c22',
      'BCP-CAP-CM-001-L2',
      2,
      'Routine Trade Enrichment and Validation',
      'Build foundation capability to enrich routine trade lifecycle records, validate standard reference data, resolve common documentation gaps, and prepare clean exception notes within defined procedures.',
      '["Completes routine enrichment using approved sources", "Validates counterparty, instrument, settlement, and booking fields", "Documents common exceptions with clear evidence"]',
      '["Enriched Trade Record", "Reference Data Validation Log", "Routine Exception Note"]',
      '{"title": "Routine Trade Enrichment and Validation", "description": "A routine trade record has missing enrichment fields and reference-data checks. The learner must complete standard validations, document evidence, and route any unresolved exception to the correct owner."}',
      300,
      'foundation'
    ),
    (
      '6c6d920f-bcb0-4b7a-8d9e-fcbcc3f2f333',
      'BCP-CAP-CM-001-L3',
      3,
      'Exception Diagnosis and Handoff Control',
      'Build intermediate capability to diagnose non-routine securities trade lifecycle exceptions, compare evidence across systems, classify exception type, and prepare owner-ready handoffs.',
      '["Compares trade data across source, booking, and settlement evidence", "Classifies non-routine exceptions by type and owner", "Prepares actionable handoff notes with risk and next step"]',
      '["Exception Diagnosis Sheet", "Evidence Comparison Log", "Owner-Ready Handoff Note"]',
      '{"title": "Exception Diagnosis and Handoff Control", "description": "A trade record shows inconsistent booking, settlement, and counterparty evidence. The learner must diagnose the exception, classify the likely owner, and prepare a controlled handoff without making unauthorized corrections."}',
      360,
      'intermediate'
    ),
    (
      '9ab89ec5-b5d6-4325-bc71-9439f394b444',
      'BCP-CAP-CM-001-L4',
      4,
      'Lifecycle Quality Review and Risk Evidence',
      'Build advanced capability to review complex trade lifecycle records, detect quality and operational-risk patterns, coach routine corrections, and produce review-ready exception evidence.',
      '["Reviews complex trade lifecycle evidence end to end", "Identifies recurring quality, timing, and ownership risks", "Produces review packs that support escalation and remediation"]',
      '["Trade Lifecycle Review Pack", "Operational Risk Evidence Note", "Correction Coaching Summary"]',
      '{"title": "Lifecycle Quality Review and Risk Evidence", "description": "A set of trade lifecycle records contains repeated exception patterns across enrichment, booking, and settlement evidence. The learner must prepare a quality review pack and risk evidence for escalation or remediation planning."}',
      420,
      'advanced'
    ),
    (
      'd7c51be2-1719-4d31-b5e4-0997181c5555',
      'BCP-CAP-CM-001-L5',
      5,
      'Trade Lifecycle Control Standard and Improvement',
      'Build expert capability to define evidence standards for securities trade lifecycle records, lead exception-control improvement, and prepare governance-ready analysis within role authority.',
      '["Defines evidence standards for trade lifecycle record control", "Interprets exception trends and control weaknesses", "Prepares governance-ready improvement recommendations"]',
      '["Lifecycle Control Standard", "Exception Trend Analysis", "Governance Improvement Brief"]',
      '{"title": "Trade Lifecycle Control Standard and Improvement", "description": "Recurring trade lifecycle exceptions indicate a control weakness in evidence capture, enrichment, or handoff quality. The learner must define improved evidence standards and prepare governance-ready recommendations without exceeding approval authority."}',
      480,
      'expert'
    )
) AS v (
  id,
  level_code,
  level_no,
  title,
  description,
  observable_behavior,
  example_outputs,
  problem_statement,
  duration_minutes,
  difficulty_level
)
JOIN public."capabilities" c
  ON c."code" = 'BCP-CAP-CM-001'
JOIN public."level_scale" ls
  ON ls."level_no" = v.level_no
ON CONFLICT ("capability_id", "level_id") DO UPDATE SET
  "level_code" = EXCLUDED."level_code",
  "title" = EXCLUDED."title",
  "description" = EXCLUDED."description",
  "observable_behavior" = EXCLUDED."observable_behavior",
  "example_outputs" = EXCLUDED."example_outputs",
  "problem_statement" = EXCLUDED."problem_statement",
  "duration_minutes" = EXCLUDED."duration_minutes",
  "difficulty_level" = EXCLUDED."difficulty_level",
  "status" = EXCLUDED."status",
  "version_no" = EXCLUDED."version_no",
  "is_active" = EXCLUDED."is_active",
  "updated_at" = now();

COMMIT;
