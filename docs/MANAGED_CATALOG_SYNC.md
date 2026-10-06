# Missing catalogue recovery through SkillPassport

LTE uses its existing authenticated SkillPassport gateway for both assessment tracks (`learning-track:get`) and missing catalogue dependencies (`catalogue:get`). SkillPassport serves catalogue data from the SP-Dash source selected for this deployment; it verifies that every requested role belongs to the authenticated learner's assessment.

On dashboard load or Retry, LTE obtains all recommended tracks, checks the local catalogue for missing roles, role-capability mappings, published levels, modules, and stage records, and requests catalogue data only for incomplete roles. The import inserts missing records in dependency order in one transaction. Existing catalogue records and learner progress are not overwritten. It then repairs tracks, role paths, and course assignments.

This is missing-data recovery, not a source-update subscription. It cannot discover extra remote lessons when an already populated local course appears complete. Courses with no published levels at the source remain unavailable and are rechecked on later recovery requests.

## One-time deployment

- Apply `supabase/migrations/20261003100000_skill_catalog_recovery.sql` in LTE through normal migration deployment. It grants the two catalogue RPCs only to `service_role`; RLS is unchanged.
- Deploy the new SkillPassport `catalogue:get` gateway action and SP-Dash's `/api/internal/lte/catalog` endpoint.
- Configure `SP_DASH_CATALOG_URL` and `LTE_CATALOG_SYNC_SECRET` on SkillPassport. Configure the same private secret on SP-Dash. SP-Dash's existing LTE database configuration must point to the authoritative published catalogue.
- LTE continues using `SKILLPASSPORT_INTERNAL_URL` and `SKILLPASSPORT_INTERNAL_SECRET`; it no longer calls SP-Dash directly or needs the catalogue shared secret.

No direct database import is needed. After configuration and migration deployment, the application fetches missing data itself. These changes do not publish drafts or copy asset files; existing published asset URLs are retained.
