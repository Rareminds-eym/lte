-- ============================================================================
-- Migration: Add unique constraint on learning_tracks (user_id, assessment_id, track)
-- Fixes M6.8: TOCTOU race condition in upsertLearningTrack
-- Phase: 1 of 1 (Expand)
-- Breaking: No
-- Rollback: Safe — DROP CONSTRAINT IF EXISTS uq_learning_tracks_user_assessment_track
-- ============================================================================

BEGIN;

ALTER TABLE public.learning_tracks
    ADD CONSTRAINT uq_learning_tracks_user_assessment_track
    UNIQUE (user_id, assessment_id, track);

COMMIT;
