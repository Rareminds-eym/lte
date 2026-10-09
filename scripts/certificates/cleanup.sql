BEGIN;
DELETE FROM public.users WHERE id IN ('{{user}}','{{other}}');
DELETE FROM public.modules WHERE id='{{module}}';
DELETE FROM public.levels WHERE id='{{level}}';
DELETE FROM public.capabilities WHERE id='{{capability}}';
DELETE FROM public.roles WHERE id='{{role}}';
COMMIT;
