# Missing catalogue recovery through SkillPassport

LTE uses its existing authenticated SkillPassport gateway for both assessment tracks (`learning-track:get`) and missing catalogue dependencies (`catalogue:get`). SkillPassport serves catalogue data from the SP-Dash source selected for this deployment; it verifies that every requested role belongs to the authenticated learner's assessment.

When the existing recovery RPCs are available, dashboard load or Retry obtains recommended tracks, checks the local catalogue for missing dependencies, and requests catalogue data only for incomplete roles. The recovery importer is intended to insert missing records without overwriting existing catalogue records or learner progress. Track, role-path and course-assignment repair then uses the available catalogue.

This is missing-data recovery, not a source-update subscription. It cannot discover extra remote lessons when an already populated local course appears complete. Courses with no published levels at the source remain unavailable and are rechecked on later recovery requests.

## Deployment prerequisites

- Verify that `missing_managed_catalog_roles` and `import_managed_lte_catalog` already exist in the target LTE database before relying on automatic missing-data recovery. Their migration is absent from this checkout. The catalog API boundary fix adds no RPC or migration. If the missing-role RPC is unavailable, `syncManagedCatalog()` logs the unavailable dependency and skips recovery; existing local catalogue reads can still succeed. Implementing the importer requires a separate database change.
- Deploy the new SkillPassport `catalogue:get` gateway action and SP-Dash's `/api/internal/lte/catalog` endpoint.
- Configure `SP_DASH_CATALOG_URL` and `LTE_CATALOG_SYNC_SECRET` on SkillPassport. Configure the same private secret on SP-Dash and LTE Pages. SP-Dash uses `LTE_API_BASE_URL` to request the published catalog from LTE's Pages Functions; LTE owns the database credentials. Local server settings belong in each project's `.dev.vars`.
- LTE's recovery caller continues using `SKILLPASSPORT_INTERNAL_URL` and `SKILLPASSPORT_INTERNAL_SECRET`. LTE's catalog machine endpoints separately require `LTE_CATALOG_SYNC_SECRET` to verify calls from SP-Dash.

Where the recovery prerequisites are satisfied, the application can fetch missing data itself. The API boundary change does not publish drafts or copy asset files; existing published asset URLs are retained. Successful reads from a populated local catalogue do not prove that missing-data recovery is operational.
