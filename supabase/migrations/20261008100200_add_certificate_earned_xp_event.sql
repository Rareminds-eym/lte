-- Separate migration: a new enum value cannot be used in the transaction that adds it.
ALTER TYPE public.xp_event_type ADD VALUE IF NOT EXISTS 'certificate_earned';
