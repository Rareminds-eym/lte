-- User-selected access model: explicit table/RPC grants and backend authorization.
-- Applies the same configuration to databases that ran the earlier migrations.
ALTER TABLE public.review_rubric_templates DISABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.review_rubric_templates FROM PUBLIC,anon,authenticated;
ALTER TABLE public.review_assignments DISABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.review_assignments FROM PUBLIC,anon,authenticated;
ALTER TABLE public.review_commands DISABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.review_commands FROM PUBLIC,anon,authenticated;
ALTER TABLE public.review_audit DISABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.review_audit FROM PUBLIC,anon,authenticated;
ALTER TABLE public.review_outbox DISABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.review_outbox FROM PUBLIC,anon,authenticated;
