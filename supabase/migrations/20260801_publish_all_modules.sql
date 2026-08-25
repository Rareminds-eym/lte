-- Publish all modules
UPDATE public.modules
SET is_published = true
WHERE is_published IS NOT true;
