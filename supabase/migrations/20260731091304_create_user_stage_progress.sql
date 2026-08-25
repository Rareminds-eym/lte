-- ============================================================================
-- Migration: Create user_stage_progress table
-- Date: 2026-07-31
-- Database: PostgreSQL / Supabase
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.user_stage_progress (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    user_module_progress_id uuid NOT NULL,
    user_id uuid NOT NULL,
    e_content_id uuid NOT NULL,

    stage_name varchar NOT NULL,
    stage_order integer NOT NULL,
    status varchar NOT NULL DEFAULT 'in_progress',

    started_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_user_stage_progress_module_progress
        FOREIGN KEY (user_module_progress_id)
        REFERENCES public.user_module_progress(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_user_stage_progress_user
        FOREIGN KEY (user_id)
        REFERENCES public.users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_user_stage_progress_e_content
        FOREIGN KEY (e_content_id)
        REFERENCES public.e_content(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_user_stage_progress_stage_name
        CHECK (
            stage_name IN (
                'engage',
                'explore',
                'explain',
                'express',
                'empower',
                'evolve'
            )
        ),

    CONSTRAINT chk_user_stage_progress_stage_order
        CHECK (stage_order BETWEEN 1 AND 6),

    CONSTRAINT chk_user_stage_progress_stage_mapping
        CHECK (
            (stage_name = 'engage' AND stage_order = 1)
            OR (stage_name = 'explore' AND stage_order = 2)
            OR (stage_name = 'explain' AND stage_order = 3)
            OR (stage_name = 'express' AND stage_order = 4)
            OR (stage_name = 'empower' AND stage_order = 5)
            OR (stage_name = 'evolve' AND stage_order = 6)
        ),

    CONSTRAINT chk_user_stage_progress_status
        CHECK (status IN ('in_progress', 'completed')),

    CONSTRAINT uq_user_stage_progress
        UNIQUE (
            user_module_progress_id,
            user_id,
            e_content_id,
            stage_name
        )
);

CREATE INDEX IF NOT EXISTS idx_user_stage_progress_module_progress
    ON public.user_stage_progress(user_module_progress_id);

CREATE INDEX IF NOT EXISTS idx_user_stage_progress_user_content
    ON public.user_stage_progress(user_id, e_content_id);

CREATE INDEX IF NOT EXISTS idx_user_stage_progress_e_content
    ON public.user_stage_progress(e_content_id);

CREATE INDEX IF NOT EXISTS idx_user_stage_progress_stage_status
    ON public.user_stage_progress(stage_name, status);

CREATE INDEX IF NOT EXISTS idx_user_stage_progress_user_status
    ON public.user_stage_progress(user_id, status);

COMMIT;