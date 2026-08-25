-- Add metadata column to public.learning_paths
ALTER TABLE public.learning_paths 
ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
