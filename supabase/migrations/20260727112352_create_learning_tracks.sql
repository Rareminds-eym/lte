-- ============================================================================
-- Migration: Create learning_tracks
-- Database: PostgreSQL / Supabase
-- ============================================================================

BEGIN;

-- ============================================================================
-- 2. LEARNING TRACKS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.learning_tracks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id uuid NOT NULL,
    assessment_id uuid NOT NULL,

    fit varchar NOT NULL,
    track varchar NOT NULL,
    match_score integer NOT NULL,

    topics jsonb NOT NULL DEFAULT '[]'::jsonb,

    duration varchar NOT NULL,
    why_it_fits text NOT NULL,

    is_active boolean NOT NULL DEFAULT false,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    CONSTRAINT fk_learning_tracks_user
        FOREIGN KEY (user_id)
        REFERENCES public.users(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT chk_learning_tracks_fit
        CHECK (
            fit IN ('High', 'Medium', 'Explore')
        ),

    CONSTRAINT chk_learning_tracks_match_score
        CHECK (
            match_score >= 0
            AND match_score <= 100
        )
);

CREATE INDEX IF NOT EXISTS idx_learning_tracks_user_id
    ON public.learning_tracks (user_id);

CREATE INDEX IF NOT EXISTS idx_learning_tracks_fit
    ON public.learning_tracks (fit);

CREATE INDEX IF NOT EXISTS idx_learning_tracks_match_score
    ON public.learning_tracks (match_score);

CREATE INDEX IF NOT EXISTS idx_learning_tracks_assessment_id
    ON public.learning_tracks (assessment_id);

CREATE INDEX IF NOT EXISTS idx_learning_tracks_user_fit
    ON public.learning_tracks (user_id, fit);

CREATE UNIQUE INDEX IF NOT EXISTS uq_learning_tracks_one_active_per_user
    ON public.learning_tracks (user_id)
    WHERE (is_active = true);


-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS trg_learning_tracks_set_updated_at
    ON public.learning_tracks;

CREATE TRIGGER trg_learning_tracks_set_updated_at
BEFORE UPDATE ON public.learning_tracks
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();


-- ============================================================================
-- TABLE COMMENTS
-- ============================================================================

COMMENT ON TABLE public.learning_tracks IS
    'Learning track recommendations generated for users from assessment results.';

COMMENT ON COLUMN public.learning_tracks.user_id IS
    'User for whom this learning track was recommended.';

COMMENT ON COLUMN public.learning_tracks.assessment_id IS
    'Assessment that generated the learning track recommendation.';

COMMENT ON COLUMN public.learning_tracks.topics IS
    'JSON array containing the core topics covered by the learning track.';

COMMENT ON COLUMN public.learning_tracks.match_score IS
    'Recommendation match score between 0 and 100.';

COMMIT;
