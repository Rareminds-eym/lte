-- ============================================================================
-- Migration: Add content viewing timer tracking (2026-08-06)
-- Purpose: Track time spent by users on content (PDFs, videos, etc.)
-- ============================================================================

BEGIN;

-- Add time_spent_seconds column to track total viewing duration
ALTER TABLE public.user_stage_progress
ADD COLUMN time_spent_seconds INT DEFAULT 0 NOT NULL;

-- Add last_viewed_at to track when user last accessed content
ALTER TABLE public.user_stage_progress
ADD COLUMN last_viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL;

-- Create index for efficient querying of recently viewed content
CREATE INDEX idx_user_stage_progress_last_viewed
ON public.user_stage_progress(user_id, last_viewed_at DESC);

-- Create index for time spent analytics
CREATE INDEX idx_user_stage_progress_time_spent
ON public.user_stage_progress(user_id, time_spent_seconds DESC);

COMMIT;
