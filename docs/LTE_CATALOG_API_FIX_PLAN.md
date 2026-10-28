# LTE catalog API boundary fix

**Status: the three reopened application/CI findings are resolved.** Final local
coverage, quality checks and builds pass. Production cutover and live queue
verification remain operational checks; no deployment was performed.

## Pages deployment follow-up (2026-10-16)

The failed Cloudflare build of `30cf1db` completed Vite successfully, then
Wrangler 3.114.17 failed to resolve the bare `crypto` import in
`functions/lib/catalog/ingestion/snapshot-serializer.ts`. A local Functions build
without compatibility overrides reproduced the failure. Earlier validation passed
explicit compatibility settings and missed this deployment compiler path.

The serializer now imports `node:crypto`. Functions compile successfully with
both Cloudflare's Wrangler 3.114.17 and the locked Wrangler 4.120.1 without CLI
compatibility overrides. The hashing implementation and snapshot format are unchanged.

The build also selected Node 20 from `.nvmrc`, below the locked dependencies'
requirements. The pin is now 22.22.3, CI reads the same file, and package/lockfile
metadata declare the actual minimum, 22.13.0. The optional Docker build stage now
uses Node 22. The new `npm run build:functions` command compiles the existing
Pages Functions into ignored local artifacts; CI runs both frontend and Functions
builds. Neither command starts a persistent server or deploys another Worker.

A read-only download of the live LTE Pages configuration confirmed that its
production and preview runtime settings already enable `nodejs_compat` with
compatibility date `2026-06-08`. The missing `pages_build_output_dir` notice
means the checked-in Wrangler file remains local-only and deployment uses dashboard
settings. It is not the fatal compiler error. Simply adding that property would
replace dashboard-managed bindings and variables with the local configuration.
The file contains local URLs and unverified namespace IDs, so this fix documents
the configuration boundary instead of migrating deployment settings implicitly.

The same read-only inspection found no deployed `RATE_LIMIT_KV` or
`LTE_ASSET_VALIDATION_QUEUE` binding in either environment. Those remain the
existing feature-specific production cutover prerequisites, separate from this
compiler fix. KV is required by review, explicit refresh and certificate handlers;
ordinary learning-path reads do not use the limiter. The asset queue is required
only when catalog publication emits asset validation messages. Neither missing
binding prevents compilation or establishes that the entire app is unavailable.
A direct read-only Pages API check on 2026-10-16 independently confirmed both
missing bindings and the existing Node compatibility settings in each environment.
It found no NODE_VERSION override. The Node 20 engine warnings are a separate
dependency mismatch, not the reported fatal compiler error; Docker alignment is
independent build maintenance. June 2026 is the existing compatibility date, not
a newly required minimum. No Cloudflare bindings, variables or secrets were changed.
No database commands, SQL edits, data changes or persistent application servers
are part of this follow-up.

Verification for this deployment follow-up: production Vite build passes;
Functions compile with Wrangler 3.114.17 and 4.120.1 without CLI compatibility
overrides. All 231 test files pass (1,801 tests passed, one skipped). Full-suite
coverage is 85.58% statements, 75.77% branches, 85.17% functions and 87.19%
lines, above the existing thresholds. The changed-line gate passes with no
changed executable lines (the source change is an import specifier). Existing
pre-commit quality checks pass; existing non-blocking Biome warnings remain.
The optional Docker image was not built. A remote Pages deployment was not run.

## Additional re-audit: corrections completed (2026-10-14)

The re-audit found an omitted CI gate and incomplete guards in alternate write
paths. These findings were reproduced with isolated fixtures and corrected:

| Reopened finding | Final correction | Verification |
| --- | --- | --- |
| Biome CI failed with 48 errors | Organized imports, fixed assignment/callback expressions, and added narrowly scoped comments for intentional awaitable Supabase test doubles. Existing rules and coverage targets are unchanged. | Biome CI passes over all 74 affected files; ESLint passes with zero warnings. Biome's existing dynamic-type/style warnings remain non-blocking. |
| Generic drafts could overwrite/discard queued catalog jobs; discarded jobs could be published again | Both generic draft mutations and the course-editor discard endpoint require `entity_type = level`. Draft snapshots must be objects and cannot supply server-owned publication state. Queue processing, lock acquisition, progress mutations and final commit honor catalog type and editable version status. Discarded deliveries are acknowledged without processing. | Cross-endpoint saves/discards return 409 without changing the job; malformed/forged snapshots return 400. ABANDONED/ARCHIVED jobs perform no download/publication. A discard racing finalization cannot become PUBLISHED. Native Pages cancellation wrapper is covered. |
| Elapsed-time takeover let an older publisher continue writing | Active catalog and workspace publication owners are never replaced solely because five minutes elapsed. Status polling is read-only. Ownership is checked before and after catalog table writes, before/after level-version creation, and before each workspace write; final state updates also use conditional ownership/status predicates. | Paused publishers exceeding five minutes keep the same token; a second publisher cannot start. Ownership lost during staging prevents live workspace writes. Lost ownership during a table write stops subsequent writes. Confirmed failed attempts remain retryable. |

This corrects the three defects without a new Worker, migration, RPC or schema.
The temporary audit probe at `/tmp/lte-reaudit-probe.test.ts` records the old
behavior; permanent regression tests assert the corrected behavior instead.

### Publication safety and interrupted attempts

A timeout does not prove that a writer or its database request has stopped.
Automatic time-based lock takeover has therefore been removed, including for
older persisted jobs. An interrupted attempt keeps its existing PUBLISHING or
workspace lock until its previous writer is confirmed stopped. Ordinary caught
failures release the workspace lock or persist PUBLISH_FAILED, so confirmed
failed attempts can retry through the normal endpoint.

For an interrupted owner, operators must first confirm that execution and
outstanding writes have stopped, then reconcile partial table/version writes
and retained assets. A separately authorized maintenance action can mark the
existing catalog job failed or clear the existing workspace lock with a revision
increment; normal editing/publishing can then resume. This fix performs no such
live mutation and supplies no unattended unlock based on an elapsed timer.

Separate Supabase HTTP writes remain non-transactional. Ownership checks cannot
undo an already dispatched write if someone changes ownership directly in the
database; strict database-side fencing/atomic publication requires a separate
database design. Supported application paths do not forcibly replace an active
owner. This is the safety/liveness tradeoff within the no-schema-change scope.

The missing recovery importer RPCs and live production queue flow remain
previously documented prerequisites/validation limits. No new recovery feature,
RPC, remote secret edit or deployment is introduced by these corrections.

## Objective and constraints

`sp-dash` must read and write the LTE catalog through LTE endpoints. The LTE
service-role credential and catalog R2 access belong to LTE's existing
Cloudflare Pages Functions deployment.

This plan replaces the earlier proposal after the user reverted its changes.
The authorized scope is an application boundary refactor:

- Use normal file-based Cloudflare Pages Functions endpoints in `lte/functions`.
- Keep LTE's existing Supabase project, schema, tables and R2 storage model.
- Reuse the existing asset validation queues and dashboard queue consumer.
- Preserve dashboard URLs, response contracts, XLSX formats and existing roles.
- Introduce no separate LTE Worker, SQL migration, RPC, database job table,
  database reset, or live database modification.
- Make configuration errors affect the requested LTE feature, rather than app
  boot or the dashboard build.

## Finding and root cause

`sp-dash/lib/supabase-lte.ts` constructed a service-role client at module import
and fell back to SkillPassport credentials. Eight admin route files used the
client directly. Publishing and status polling also reached it through helper
modules. The signed SkillPassport recovery export imported it dynamically.
The existing dashboard queue consumer separately constructed another LTE
service-role client and accessed LTE's R2 bucket.

Changing only `supabase-lte.ts` would leave several database paths in place.
Moving only publish would also leave workspace reads, editing, lifecycle,
source uploads and template generation outside the service boundary.

## Resulting request paths

Interactive catalog operations:

```text
Browser -> existing sp-dash /api/admin/lte route
        -> HTTPS LTE /api/v1/admin/catalog endpoint, original SSO bearer token
        -> LTE validates JWT and endpoint role
        -> existing LTE Supabase/R2 bindings
```

Asset publishing:

```text
sp-dash publish proxy -> LTE publish Pages Function
                     -> existing lte-asset-validation queue
                     -> existing sp-dash Worker queue consumer
                     -> signed LTE process-asset Pages Function
                     -> existing snapshot validation state and catalog tables
```

Cloudflare Pages supplies the HTTP functions and queue producer. The already
existing dashboard Worker remains the queue consumer. Its LTE consumer becomes
an HTTP relay; it no longer imports publishing/database/storage code.

Recovery remains compatible:

```text
LTE recovery -> SkillPassport catalogue action -> signed sp-dash export route
             -> signed LTE catalog export endpoint -> published catalog only
```

The bridge URL, HMAC input format and exported version-1 table shape remain
compatible with the existing SkillPassport caller.

## Endpoint and ownership inventory

| Existing dashboard operation | LTE Pages endpoint | Work retained in dashboard |
| --- | --- | --- |
| workspace views | `/api/v1/admin/catalog/workspace` | Existing UI and proxy |
| upload | `/api/v1/admin/catalog/upload` | XLSX parsing and file limits |
| template | `/api/v1/admin/catalog/template-data` | ExcelJS workbook formatting |
| review GET/PATCH | `/api/v1/admin/catalog/review` | Existing UI and proxy |
| drafts POST/PUT/DELETE | `/api/v1/admin/catalog/drafts` | Existing UI and proxy |
| course content GET/PUT/POST/DELETE | `/api/v1/admin/catalog/course-content` | Existing editor and proxy |
| publish POST | `/api/v1/admin/catalog/publish` | Existing UI and proxy |
| publish status | `/api/v1/admin/catalog/publish/:jobId/status` | Existing polling URL |
| lifecycle POST | `/api/v1/admin/catalog/lifecycle` | Existing UI and proxy |
| resource assets | `/api/v1/catalog/assets` | Streaming compatibility proxy |
| recovery export | `/api/v1/internal/catalog/export` | Existing signed caller bridge |
| queue asset processing | `/api/v1/internal/catalog/process-asset` | Existing consumer relay |
| diagnostic scripts | `/api/v1/internal/catalog/health` | CLI entry points |

Materialization routes remain disabled with their existing 410 responses.
Existing relative `/api/admin/lte/assets?key=...` URLs continue to work in both
applications through a dashboard proxy and an LTE compatibility function.

## Implementation sequence

1. Move the existing catalog handlers and backend helpers into LTE. Use native
   Request/Response and request-local dependency injection. Import no Next.js
   or OpenNext runtime into LTE. Preserve the existing data behavior and errors.
2. Supply LTE's existing `createServiceSupabase(env)` and `STORAGE_BUCKET` to
   handlers and publishing helpers. Remove implicit global database clients
   and the in-memory R2 fallback from the deployed publishing path.
3. Add centralized admin authentication using LTE's existing auth-core package
   and SSO service binding. Verify the actual issued `sso-api` issuer and
   `sso-client` audience. Require active membership and existing endpoint roles;
   do not require a learner LTE subscription for catalog administrators.
4. Add dashboard HTTP transport. Forward the original token, method, query and
   payload. Derive the actor at LTE from verified claims. Forward no role/user
   cookie. Reject cross-origin cookie mutations before the proxy calls LTE.
5. Keep XLSX parsing and workbook generation in the dashboard. LTE validates
   the normalized upload envelope, row bound and deterministic snapshot hash
   before creating the existing catalog version record.
6. Move publishing and asset processing to LTE. Keep validation state in the
   existing catalog version snapshot and retain original queue message fields
   (`uploadId`, `assetUrl`). Persist the publishing actor in that JSON state so
   asynchronous completion records the administrator who requested publishing.
7. Keep the existing dashboard consumer and retry model. Sign its HTTP call;
   acknowledge only a confirmed processing/exhaustion response. LTE must check
   that the URL belongs to the persisted job before downloading anything.
   Duplicate deliveries must still allow finalization of validated assets.
8. Retain the existing recovery HMAC protocol at the dashboard boundary. LTE's
   machine endpoints verify the exact method, path, timestamp and body with
   the same shared secret. Bound machine request bodies to 16 KiB.
9. Remove the dashboard LTE client, database helper copies, LTE R2 binding and
   LTE database URL configuration. Change diagnostic scripts to read-only LTE
   HTTP diagnostics. Keep SkillPassport's own database bindings intact. Remove unused direct-query
   ingestion/concurrency utilities; retain the parser's pure record comparisons.
10. Move backend behavior tests to LTE, retain upload parser tests in the
    dashboard, and add proxy/authentication/queue/signature boundary tests.
11. Update this plan and deployment checklist, run builds and checks, inspect
    both diffs, then refresh both Graphify graphs.

## Validation and acceptance criteria

- No dashboard application or queue path constructs an LTE Supabase client.
- No dashboard runtime path references LTE_SERVICE_ROLE_KEY, LTE_SUPABASE_URL,
  LTE_DATABASE_URL, or an LTE R2 binding. Historical documentation can describe
  removal of old secrets; it must not instruct new deployments to require them.
- Workspace, template, upload, review, drafts, content, lifecycle, publishing,
  status, assets, diagnostics and recovery all reach LTE HTTP endpoints.
- Valid SSO tokens use the actual issued audience. Anonymous, expired,
  wrong-audience, suspended and wrong-role callers cannot invoke handlers.
- A forged dashboard user/role cookie cannot elevate a caller at LTE.
- Cookie mutations from another origin fail before an LTE request is sent.
- Machine signatures fail if the method/path/body changes or time expires.
- Queue delivery preserves existing message fields and retry semantics; no
  acknowledgement occurs on an unconfirmed upstream failure.
- Existing helper tests preserve URL replacement, SSRF protection, hashing,
  deterministic identifiers, R2 keys and published-only exports.
- LTE strict typecheck and relevant backend tests pass. Dashboard typecheck,
  relevant tests and build pass. Bundle Pages Functions with Wrangler.
- `git diff` contains no schema/migration changes or new Worker configuration.
- Refresh Graphify from the workspace root and separately from inside `lte`.

## Deployment configuration and order

No deployment or remote secret/database modification is part of local coding.
Before the actual cutover:

1. Configure `LTE_INTERNAL_SECRET` (at least 32 characters) on LTE Pages
   and the dashboard, matching the existing recovery secret. The SkillPassport
   recovery caller keeps its existing matching secret.
2. Confirm LTE production uses its existing production Supabase credentials,
   `STORAGE_BUCKET` and `lte-asset-validation` queue producer. Configure preview
   with the existing `lte-asset-validation-dev` queue.
3. Verify preview storage/database mapping. The checked-in LTE preview bucket
   currently points to `lte`; do not assume it is isolated or change it without
   establishing the intended deployment configuration.
4. Deploy LTE Pages Functions first. Verify authenticated admin and signed
   machine endpoints, plus resource streaming.
5. Set dashboard `LTE_API_BASE_URL` to the matching LTE origin. Production is
   `https://lte.rareminds.in`. Supply the actual preview origin explicitly;
   do not invent it or route preview traffic to production. Local development
   uses `http://localhost:8789`. Other HTTP origins are rejected.
6. Deploy the dashboard proxy and existing consumer relay. Queues retain their
   names and original body format, allowing outstanding messages to drain.
7. Smoke-test a complete upload/review/publish flow with assets, draft editing,
   lifecycle, workspace and template reads, and SkillPassport recovery.
8. Retire the previous dashboard deployment, then remove its old LTE database
   credential and R2 binding. LTE retains its own service-role credential.

Rollback keeps the previously deployed dashboard/LTE versions available.
Do not remove old dashboard secrets until the old version is no longer needed
for rollback. No schema rollback is necessary because this change has no DDL.

## Existing limitations outside the boundary refactor

Publishing retains the existing sequence of Supabase table operations. Moving
those operations behind LTE does not make the multi-table write atomic. A
partial failure can still require a retry; true transactional publication
would require a separately designed database change, which is explicitly out
of scope here.

Existing level snapshot/restore semantics are retained. A stored level version
can contain a broader catalog snapshot; this refactor does not silently change
its restore scope or transform old stored data. Version-number allocation also
retains the existing behavior and database uniqueness constraints.

The legacy HTTP signing freshness window permits replay within 60 seconds.
Read-only exports are safe to repeat and asset processing uses persisted job
state; this refactor does not introduce a new replay database.

Remote SSO, preview environment mappings and production end-to-end behavior
must be verified during cutover. Local tests and bundling cannot establish
those deployment facts. No live database data has been changed by this fix.

## Current resolution and verification (2026-10-14)

The original boundary fixes and the three reopened corrections are implemented.
The verification below records final local results and their deployment limits.

| Confirmed item | Implemented correction | Regression evidence |
| --- | --- | --- |
| Direct dashboard LTE database/storage access | All catalog operations use LTE's existing Pages Functions; the existing dashboard queue consumer is a signed HTTP relay. | Transport, signature, queue relay and real Pages handler tests. |
| Local config can select production | Request-time Cloudflare bindings supply URL and secret. Node development accepts loopback settings and defaults to local LTE. Runtime credentials have no `process.env` fallback. CLI diagnostics load `.dev.vars`. | Tests deliberately supply a production binding and conflicting process secret; local selection and binding credential win. |
| Failed publish regresses to VALIDATING | Terminal states survive recomputation; duplicate failed deliveries cannot corrupt an already VALID asset or PUBLISHED version. Exhausted publication failures acknowledge only the confirmed terminal state. | Publishing failure, duplicate, retry and queue response tests. |
| Publication ownership | Each acquisition stores its start time and token in existing JSON. Active owners are not reclaimed on a timer; write-phase checks and conditional final commit honor ownership. | Slow active owner, lost ownership, confirmed failure retry and superseded executor tests. |
| Draft/review edits race or alter publication state | Writes compare revision and editable status atomically. Review UI sends the observed revision. Workspace draft endpoints are scoped to level versions; queued catalog jobs and active publication ownership cannot be bypassed. | Competing edits, cross-endpoint job protection, discarded-job finalization and slow-publisher tests. |
| PPTX/DOCX reject relative catalog assets | Recognized local asset endpoints are fetched directly; filename/type inference uses the stored object key. External resources retain the preview proxy. | Rendered PPTX/DOCX tests and PDF/slide/extension regression cases. |
| Asset and proxy buffering | Deployed asset processing incrementally validates and hashes into temporary R2 objects, with multipart parts bounded to 5 MiB; final object keys stay compatible. Mutation proxy bodies stream with a byte limit. | Storage cleanup/retry and bounded body tests; 100 MiB native workerd/R2 staging succeeded with the expected hash and no temporary objects left. |
| Malformed multi-URL scalar fields | Upload, review and workspace editing reject multiple URLs or URL arrays in scalar fields before persisting them. | Extraction, upload/review and course editor validation tests. |
| Coverage excludes unloaded backend code | Explicit source/functions inclusion, backend Codecov flag, CI upload and changed executable-line gate. Existing targets remain unchanged. | Full coverage suite and local patch coverage calculation. |
| Learner routes fail locally | User-authorized `npx supabase start` restored LTE's configured local database. Existing Pages app restarted after `.dev.vars` binding updates. | All five reported learner routes return 200 for the existing learner; signed catalog health succeeds. |

Local server configuration belongs in each project's `.dev.vars`. SP-Dash now
includes `.dev.vars.example`; its LTE runtime and recovery bridge read Cloudflare
bindings. `.env` examples do not carry LTE runtime secrets. Next.js build-time
configuration remains distinct from Worker runtime bindings. The local matching
catalog secret and origins were configured privately; no key values were logged
or added to tracked files and no remote secrets were changed.

Environment cleanup removed the obsolete LTE database URL and explicit
`NODE_ENV` from sp-dash's private `.env.local`, plus the obsolete LTE database
URL and unused `NEXTJS_ENV` from its private `.dev.vars`. The duplicate
`.env.local.example` was deleted and `.env.example` remains the local Next.js
template. Required Next.js/SkillPassport configuration and the two LTE API
bindings were preserved and their loading verified. No server was restarted.

Verification on the final application code:

- LTE full suite: **231 files; 1,801 tests passed, one skipped**.
- LTE coverage: **85.58% statements, 75.77% branches, 85.17% functions,
  87.19% lines**; all existing Vitest thresholds pass.
- Changed executable lines: **1,983 / 2,249 = 88.17%**, above the 80% local
  patch gate. Codecov retains its project 70% / patch 80% targets and tolerances.
- SP-Dash LTE-related suite: **26 files; 354 tests passed**.
- Both strict TypeScript checks passed; LTE was rechecked on the final fixes.
- Biome CI over all affected files, scoped ESLint, file-type, console-use,
  file-length and secret checks pass. The existing database-history validator
  passes against HEAD, checking 107 SQL files with no migration changes.
- LTE frontend build and final Pages Functions compilation passed.
- A read-only request against local Supabase verified the nested JSON ownership
  predicates used by the new guard; an absent record matched no rows and returned
  no query error. No database write was performed by this check.
- SP-Dash Next.js/OpenNext build completed and produced the existing Worker;
  Wrangler's deployment dry run packaged it successfully without deployment.
- Native 100 MiB R2 stream staging passed. Dashboard runtime compatibility flags
  were tested with a local LTE fetch; the native Worker returned 200.
- Signed local catalog health reports the existing role/module tables. All five
  learner endpoints returned 200 after verifying an existing active user and
  active track first. These probes did not create users or import tracks.
- The signed recovery bridge through running SP-Dash and LTE returned 200,
  payload version 1 and all 13 expected tables, using private `.dev.vars` settings.
- Successful catalog publication, queue responses, races and native Pages
  wrappers are tested with isolated database/storage fixtures. This does not
  claim a live production upload-to-queue-to-viewer flow has been exercised.
- SQL/schema/configuration diffs contain no migration or new LTE Worker.
- Knowledge graphs were refreshed separately from the workspace root and LTE.
  Existing Wrangler configuration changes only transfer the queue producer and
  LTE API ownership bindings; no additional deployed service is introduced.

Pure record comparisons also use own-property lookups for unknown table names.
JSON round-trip properties account for JSON normalizing JavaScript -0 to 0.

The remaining operational work is the deployment order, smoke tests and
interrupted-owner reconciliation procedure above.
Sequential multi-table writes, broader historical snapshot restore scope and
version-number allocation remain inherited database design limits. Shared
machine credential separation and cancellation of previously approved work on
role revocation remain optional policy choices, not unresolved exploit claims.

A separate recovery prerequisite is now documented accurately: the migration
previously named in `lte/docs/MANAGED_CATALOG_SYNC.md` is absent from the checkout.
Existing `syncManagedCatalog()` skips recovery if its missing-role RPC is
unavailable. Populated learner reads and the signed export boundary pass; they
do not prove the importer RPC exists. No replacement migration was introduced
under the user's explicit no-database-change constraint.

## Re-audit and false-positive review (2026-10-14)

The initial re-audit overstated several findings and labelled unrelated or
conditional observations as P1 defects. The following verdicts supersede that
list. Comparisons against the original `sp-dash` HEAD distinguish inherited
behavior from changes introduced by this refactor. No production code, secrets,
configuration bindings or database data were modified during this review.

| Finding | Corrected verdict | Evidence and actual impact |
| --- | --- | --- |
| Failed publication becomes VALIDATING | **Confirmed functional defect; inherited.** | Exercised actual `finalizePublishJob()` and `readPublishJobStatus()` against an in-memory Supabase test double. A simulated publishing failure persisted VALIDATING instead of PUBLISH_FAILED. The catch/recompute logic is identical in the original SP implementation. Queue retries can eventually produce another terminal state; the claim should not imply every failure hangs indefinitely. |
| All learner previews are broken by relative URLs | **Overstated; narrowed to confirmed PPTX/DOCX inline preview incompatibility.** | Actual `R2StorageService.uploadAsset()` emits the relative URL. A supported `contentType: slide` selects the PPTX viewer, whose preview request returns 400 and has no direct fetch fallback. DOCX likewise fetches only the preview endpoint. PDF and spreadsheet buffer loading have a direct-URL fallback; an executable check confirmed successful PDF fallback after a 400. Images/audio/video use direct URLs. The relative URL itself predates this refactor; the new LTE alias allows direct reads. |
| Multiple URLs in one field lose earlier replacements | **Confirmed helper behavior on malformed/conditional input; withdraw as a blanket P1 data-loss finding.** | The actual extractor/replacer reproduces last-link-only replacement. However, the canonical `e_content.url` and `artifact_templates.file_url` fields represent one URL per row, and templates do not declare multi-link support for those fields. No valid multi-link business contract was established. Appropriate follow-up is rejecting malformed scalar URL inputs; do not introduce multi-link/array support solely to satisfy that synthetic example. Normal one-URL replacement is unaffected. |
| Concurrent draft/review edits can overwrite or change publish state | **Confirmed functional defect; inherited.** | Two actual PUT handler calls with expected revision 5 both returned 200; final stored revision was only 6, with one edit overwriting the other. Existing migrations contain no revision/status-transition trigger, and the update lacks a revision predicate. The review update has neither an editable-status nor revision predicate. Original SP code has the same omissions; deletion of the unused concurrency utility did not introduce this behavior. |
| Shared secret allows arbitrary catalog writes / queue is unauthenticated | **Withdraw that diagnosis; optional credential-scope hardening remains.** | HMAC authentication is enforced and bound to method/path/body/time. The asset endpoint requires a persisted catalog job containing the submitted URL; the initial publish endpoint requires super_admin/platform_admin authorization. A caller cannot use this endpoint to create arbitrary jobs or submit arbitrary catalog rows. The read and job credentials do share a trust domain; separating them is a policy/hardening choice, not a demonstrated arbitrary-write exploit. |
| Background publisher must be reauthenticated after role revocation | **Policy-dependent; withdraw as a mandatory P1 fix.** | The queued operation was authorized when publication was requested. Completing approved queued work without a fresh user token is a normal service execution model. No repository requirement was found that revocation must cancel already approved catalog work. Current SSO revalidation is needed only if that cancellation policy is explicitly selected. The JWT checks on interactive catalog endpoints remain enforced. |
| Large assets always exceed memory and crash | **Confirmed double buffering; conditional capacity risk, not a reproduced runtime crash.** | Download chunks are retained while a second complete Uint8Array is allocated. At the supported 100 MiB video limit, asset buffers can approach 200 MiB. Cloudflare documents a 128 MB isolate budget, but no out-of-memory runtime test was performed. Small assets are not shown to fail, and the same buffering/limits existed in the SP implementation. The new proxy also buffers mutation bodies before LTE's limit; that is a separately confirmed new buffering path. |
| Local configuration can select production despite a local override | **Confirmed selection/configuration risk introduced by the HTTP client.** | Read the actual Wrangler configuration: its default LTE origin is production. Executed actual `lteConnection()` with that binding and a localhost process override: it selected production. Installed OpenNext code defaults to top-level Wrangler settings when no named dev environment is selected. This confirms precedence; no production request or database mutation was made. Explicit `.dev.vars` API settings or named dev selection can avoid the condition. |
| Different local DB ports / preview bucket name prove wrong data ownership | **Withdraw as defect claims; retain deployment verification items.** | Separate SP/LTE database ports are compatible with the intended service boundary. The shared preview bucket may be intentional. No deployed schema/content/binding evidence proves either setup wrong. Missing API entries in checked-in env examples are documentation debt; missing local sync-secret entries are local setup facts and do not prove production secrets are absent. Dashboard dev still needs its actual LTE origin configured, as already documented in the cutover plan. |
| Publishing locks can become stale immediately after acquisition | **Confirmed conditional logic defect; inherited.** | Recovery checks validation start time rather than the current publishing lock's start time. If validation took more than five minutes, a newly acquired PUBLISHING state can satisfy the stale test. The code is unchanged from the original SP implementation. This requires long validation/backlog and a competing recovery call; it is not an unconditional failure. |
| Earlier smoke tests establish complete publication readiness | **Not established by the original smoke tests; expanded local tests now pass.** | Five workerd checks covered rejection/invalid input/missing assets, not successful catalog publication or the full queue/viewer chain. Many of the 1,067 backend tests cover other features. Passing results remain valid, but their scope does not prove the untested flows. |

The Cloudflare memory-budget assessment uses
[Cloudflare's platform limits](https://developers.cloudflare.com/workers/platform/limits/).
It is a capacity inference, not evidence of an observed production crash.

### Executable confirmation performed

Temporary local audit scripts exercised actual source modules and handlers,
using mocked storage/database responses and no live database connection:

- `finalizePublishJob -> readPublishJobStatus`: publishing error persisted
  VALIDATING rather than PUBLISH_FAILED.
- Concurrent course-content PUTs: both returned 200 for expected revision 5;
  only one revision increment and one final edit remained.
- Actual R2-generated URL plus supported `slide` content type: PPTX selected,
  preview handler returned 400. An initial synthetic fixture used the invalid
  `document` content type; it was corrected before drawing this verdict.
- PDF/spreadsheet shared fetch helper: preview 400 followed by successful direct
  fallback, disproving the blanket viewer failure claim.
- Actual Wrangler default plus actual client configuration selection, with a
  mocked binding transport: localhost process override did not override the
  production binding. No remote request was sent.

Baseline source comparison confirmed that failure-state recomputation,
relative asset URLs, whole-field replacement, missing conditional draft/review
writes, large-asset buffering and stale-lock timestamps all existed before
this refactor. They are real or conditional inherited issues, not evidence
that the ownership migration introduced those behaviors.

### Corrected follow-up scope — application items completed

The items below were the accepted work scope; current resolutions are recorded
in the table above. Remote deployment verification remains operational work.

1. Resolve the new client's local/dev target selection and finish documented
   API/secret setup. Verify each intended environment without automatically
   changing database projects, copying data or replacing bucket bindings.
2. Address confirmed inherited functional issues: terminal publication states,
   conditional draft/review writes, PPTX/DOCX inline previews and stale lock
   timestamps. Use existing columns, snapshot JSON and Pages Functions.
3. Add successful publication/queue/viewer/race tests beyond the prior smoke
   checks. Keep database interactions isolated or mocked for this review.
4. Treat large-file/proxy buffering as bounded resource handling work. Reject
   malformed multi-URL scalar inputs unless multi-link support is separately
   part of the intended data contract.
5. Leave per-service credentials and cancellation on role revocation as explicit
   policy decisions; do not impose them as prerequisites based on the earlier
   overstated security finding.

No new LTE Worker, SQL migration, schema change, database reset or live data
mutation is needed for the application corrections described here.

## Local dashboard connection failure and coverage check (2026-10-14)

The learner API failures reported at 10:07 UTC were a local service outage.
LTE's `.dev.vars` points to `http://127.0.0.1:54341`, but no LTE Supabase
container, volume or listening API existed. SkillPassport and SSO databases
were running on their separate ports. All four dashboard handlers and the
active-learning-path handler depend on LTE's service query gateway, which
uses that Supabase URL. This is separate from the new catalog HTTP boundary.

After the user explicitly requested `npx supabase start`, it was run from
`lte/`. It created the local LTE database and applied the existing checked-in
migrations. No migration files were added or edited, no reset was run, and
automatic seeding remained disabled. The LTE database, REST gateway, API
gateway, metadata service and Studio started successfully; the REST API
responded with HTTP 200.

Authenticated read-only probes through the already-running Pages app returned:

| Endpoint | Status | Duration | Synthetic test learner response |
| --- | --- | --- | --- |
| `/api/v1/dashboard/xp` | 200 | 105 ms | Zero XP, no events |
| `/api/v1/dashboard/streak` | 200 | 16 ms | Zero streak days |
| `/api/v1/dashboard/journey` | 200 | 7 ms | `no_track` |
| `/api/v1/dashboard/feedback` | 200 | 8 ms | Empty feedback lists |

The initial probes used a short-lived locally signed synthetic test token,
did not create test users or catalog records, and did not log credentials.
The active-learning-path route was not probed with that synthetic user because
its GET synchronizes a user shadow record and can initiate track recovery.

Read-only follow-up checks found 2,280 roles, 730 capabilities, 10 levels and
70 modules in the running local database, with no catalog version records.
The local SkillPassport gateway returned an existing assessment with nine
tracks for the user ID from the browser logs. All nine recommended role IDs
matched LTE's current roles. The earlier inference that disabling automatic
seeding meant the catalog was empty is withdrawn. No additional seed command
was run by this investigation; these counts do not establish which process
populated the catalog. The pending catalog-source question is unnecessary for
these role dependencies.

Further read-only checks found the reported learner's existing user record,
three learning tracks and ten learning paths. After confirming an active user
and active track already existed, all five routes were probed with a short-lived
local test token using that user's existing email and ID. The guards prevented
creating a synthetic user or initiating a track import:

| Endpoint | Status | Duration | Result |
| --- | --- | --- | --- |
| `/api/v1/learning-paths/active` | 200 | 76 ms | `needsAssessment: false`, four roles, three tracks |
| `/api/v1/dashboard/xp` | 200 | 16 ms | Successful response |
| `/api/v1/dashboard/streak` | 200 | 8 ms | Successful response |
| `/api/v1/dashboard/journey` | 200 | 33 ms | Active journey with data |
| `/api/v1/dashboard/feedback` | 200 | 11 ms | Successful response |

This verifies the running Pages Functions, SSO JWT verification and LTE database
queries for the learner in the browser logs. It uses a local test token, not
the browser's original session. No additional seed, reset, SQL edit, schema
change or learner-data write was performed by these probes.

The restart instructions now name the correct LTE ports. A separate startup
defect was also repaired: `workers:dev` called a nonexistent `workers:sso`
script. That script now delegates to the existing sibling SSO worker's `dev`
command. Its Wrangler CLI entry point was checked with `--help`; a duplicate
SSO process was not launched while port 8787 was occupied.

### Coverage gap closed

The initial report covered only loaded catalog modules and did not establish
patch coverage. That report is historical. Vitest now includes all executable
`src/` and `functions/` source files, including unloaded handlers. Backend paths
are part of the Codecov unit-test flag; CI uploads LCOV and runs the changed-line
gate for pull requests. No application code was excluded and no target lowered.

The final full-suite and 88.17% local patch results are recorded in the current
verification section. Remote Codecov project/patch status will be evaluated by
CI on the pull request; the local check does not fabricate that remote result.
