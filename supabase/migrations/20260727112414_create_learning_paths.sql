-- ============================================================================
-- Migration: Create learning_paths
-- Database: PostgreSQL / Supabase
-- ============================================================================

BEGIN;

-- ============================================================================
-- 3. LEARNING PATHS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.learning_paths (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    learning_track_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,

    role_readiness_percentage numeric(5, 2) NOT NULL DEFAULT 0.00,

    badge varchar NULL,

    level integer NOT NULL,

    status varchar NOT NULL DEFAULT 'not_started',

    is_active boolean NOT NULL DEFAULT true,

    version_no integer NOT NULL DEFAULT 1,

    is_latest boolean NOT NULL DEFAULT true,

    started_at timestamptz NULL,
    completed_at timestamptz NULL,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_learning_paths_learning_track
        FOREIGN KEY (learning_track_id)
        REFERENCES public.learning_tracks(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_learning_paths_user
        FOREIGN KEY (user_id)
        REFERENCES public.users(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_learning_paths_role
        FOREIGN KEY (role_id)
        REFERENCES public.roles(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT uq_learning_paths_user_track
        UNIQUE (user_id, learning_track_id, role_id),

    CONSTRAINT chk_learning_paths_role_readiness
        CHECK (
            role_readiness_percentage >= 0.00
            AND role_readiness_percentage <= 100.00
        ),

    CONSTRAINT chk_learning_paths_badge_values
        CHECK (
            badge IS NULL
            OR badge IN (
                'developing',
                'skilled',
                'mastery'
            )
        ),

    CONSTRAINT chk_learning_paths_badge_only_on_progress
        CHECK (
            badge IS NULL
            OR status IN (
                'in_progress',
                'completed'
            )
        ),

    CONSTRAINT chk_learning_paths_level
        CHECK (
            level IN (1, 2, 3, 4, 5)
        ),

    CONSTRAINT chk_learning_paths_status
        CHECK (
            status IN (
                'not_started',
                'in_progress',
                'completed',
                'paused'
            )
        ),

    CONSTRAINT chk_learning_paths_version_no
        CHECK (
            version_no > 0
        ),

    CONSTRAINT chk_learning_paths_started_at
        CHECK (
            status = 'not_started'
            OR started_at IS NOT NULL
        ),

    CONSTRAINT chk_learning_paths_completed_at
        CHECK (
            status <> 'completed'
            OR completed_at IS NOT NULL
        ),

    CONSTRAINT chk_learning_paths_date_order
        CHECK (
            completed_at IS NULL
            OR started_at IS NULL
            OR completed_at >= started_at
        )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_learning_paths_user_track_role
    ON public.learning_paths (user_id, learning_track_id, role_id);

CREATE INDEX IF NOT EXISTS idx_learning_paths_user_is_active
    ON public.learning_paths (user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_learning_paths_status
    ON public.learning_paths (status);

CREATE INDEX IF NOT EXISTS idx_learning_paths_user_status
    ON public.learning_paths (user_id, status);

CREATE INDEX IF NOT EXISTS idx_learning_paths_user_latest
    ON public.learning_paths (user_id, is_latest);

CREATE INDEX IF NOT EXISTS idx_learning_paths_role_id
    ON public.learning_paths (role_id);

CREATE INDEX IF NOT EXISTS idx_learning_paths_level
    ON public.learning_paths (level);

CREATE INDEX IF NOT EXISTS idx_learning_paths_user_badge
    ON public.learning_paths (user_id, badge);




-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS trg_learning_paths_set_updated_at
    ON public.learning_paths;

CREATE TRIGGER trg_learning_paths_set_updated_at
BEFORE UPDATE ON public.learning_paths
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();


-- ============================================================================
-- TABLE COMMENTS
-- ============================================================================

COMMENT ON TABLE public.learning_paths IS
    'Personalized and versioned learning paths for users and their selected learning tracks.';

COMMENT ON COLUMN public.learning_paths.learning_track_id IS
    'Learning track from which this learning path was generated.';

COMMENT ON COLUMN public.learning_paths.user_id IS
    'User who owns this learning path.';

COMMENT ON COLUMN public.learning_paths.role_id IS
    'Industry role targeted by this learning path.';

COMMENT ON COLUMN public.learning_paths.role_readiness_percentage IS
    'Cached role-readiness percentage between 0.00 and 100.00.';

COMMENT ON COLUMN public.learning_paths.badge IS
    'Optional learning-path badge: developing, skilled, or mastery.';

COMMENT ON COLUMN public.learning_paths.version_no IS
    'Version number of the learning path snapshot.';

COMMENT ON COLUMN public.learning_paths.is_latest IS
    'Indicates whether this is the latest learning-path version.';

COMMIT;
