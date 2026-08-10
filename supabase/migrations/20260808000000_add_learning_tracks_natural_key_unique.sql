-- ============================================================================
-- Migration: Add natural-key unique constraint to learning_tracks
-- Database: PostgreSQL / Supabase
-- Phase: 1 of 1
-- Breaking: No
--
-- Context: M6.8 — TOCTOU race fix. upsertLearningTrack relies on a 23505
-- (unique_violation) to fall back to an UPDATE. Without a unique constraint
-- on the natural key (user_id, assessment_id, track), concurrent inserts
-- both succeed and create duplicate rows; the partial index
-- uq_learning_tracks_one_active_per_user only fires for active rows.
--
-- Prerequisite: if pre-existing duplicate (user_id, assessment_id, track)
-- rows exist, de-duplicate them before applying (the index creation fails on
-- duplicates).
-- ============================================================================

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS uq_learning_tracks_user_assessment_track
    ON public.learning_tracks (user_id, assessment_id, track);

COMMIT;
