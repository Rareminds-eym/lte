-- Expand separately: PostgreSQL must commit a new enum value before it is used.
ALTER TYPE public.artifact_evaluation_stage ADD VALUE IF NOT EXISTS 'staff_review';
