# Certificate issuance, rendering, and verification

Date: 2026-10-08. Implements the accepted v4 certificate-system plan.

Course certificates follow any level completion, including late completions. Role certificates follow a learning path's completed transition, independently of readiness score. Both hooks are non-fatal. Reading a learner's certificate list (including the level-filtered list) reconciles historical/missed completions, at most five new natural subjects per request. Settings saves finalize missing names and reconcile completions. Natural-key uniqueness spans path versions and imports; no progress regression retracts a certificate.

Issued records contain display snapshots, frozen by a PostgreSQL trigger. Missing names produce `pending_name`; email is never used as a name. Finalization uses a status compare-and-set. Concurrent insert conflicts return the natural-key winner, or retry a random credential collision three times. Engagement XP is 50, idempotent under `cert:<userId>:<certificateId>`; reconciliation also repairs missed XP writes. Revocation and atomic revoke-and-reissue replacement are ops service functions with no HTTP routes. Replacement preserves the revoked snapshot, records immutable `supersedes_id` lineage, clears the PDF cache, and never awards duplicate XP.

## D15 and D16

The only new secret is the account-scoped `BROWSER_RENDERING_API_TOKEN`, with Browser Rendering – Edit permission. `CF_ACCOUNT_ID`, `CERTIFICATE_VERIFY_BASE_URL`, and SkillPassport's `VITE_LTE_APP_URL` are public configuration. No HMAC certificate key is introduced. Online authenticity comes from authoritative lookup of an 80-bit Crockford credential; integrity comes from the database immutability trigger. This intentionally does not provide offline cryptographic verification.

Browser Rendering runs through the REST `/browser-run/pdf` endpoint from existing Pages Functions; no Worker, Queue, or QR code is introduced. Rendering is lazy and bounded to 25 seconds; PDF responses must have the correct content type, `%PDF-` magic, and at most 5 MiB. Templates escape all values, disable JavaScript and outbound HTTP(S) requests, use inline artwork/system fonts, and print an actual PDF hyperlink. R2 cache keys contain 128 random bits; public bucket URLs and keys are never returned. Concurrent first renders can create an orphan object. A cache-version increment lazily re-renders old PDFs.

Public verification lives in SkillPassport and fetches LTE without credentials. Its API exposes only certificate facts, caches for 60 seconds, and sends CORS headers only to the configured SkillPassport origin. Pending names are indistinguishable from absent IDs; revoked responses omit the learner and title. The page is noindex and has textual status and keyboard-accessible retry controls.

Internal certificate access reuses the existing shared secret, requires `app=skillpassport`, `certificates.read`, and a maximum five-minute token lifetime. The existing SkillPassport gateway checks `app=lte` in `functions/api/internal/lte/v1/index.ts`, separating directions. A leak still compromises both directions. JWT signature verification uses Web Crypto. Internal synchronization is pull-only; no SkillPassport import consumer or backend changes are included.

## Implementation corrections to the plan

- Supabase default privileges already grant DELETE to service_role. Explicitly revoke all its existing privileges before granting SELECT/INSERT/UPDATE; merely omitting DELETE from GRANT is insufficient. Verified in SQL.
- Pending records cannot be revoked before being issued, consistent with required issued fields and the documented transition matrix. Issued revocation fields cannot change without revocation; revocation cannot mutate PDF cache fields.
- Revoked snapshots remain frozen, while deletion may clear provenance and the revocation actor FK. Actor erasure must not be blocked by immutability.
- Course issuance derives the trusted path from the owned completed progress row; callers need not pass environment secrets or look up the path separately.
- Reads explicitly paginate past Supabase's row cap. Incremental pulls implement `(updated_at,id)` ordering with two disjoint parameterized reads, avoiding raw PostgREST filter interpolation. User-filtered pulls also paginate.
- Rendering checks conditional cache-update results and deletes the just-created PDF if revocation or erasure raced generation.
- Local integration exposed an existing readiness blocker: `user_profiles` has no bio/job_title/skills columns. Both readiness readers now select these fields from `users.metadata` with user ownership, preserving the scoring formula and allowing path completion to issue role certificates.
- Local schema/migration assertions use an isolated database copied from the local LTE schema, preserving development data instead of resetting the active database.
- The fourth additive migration makes natural-key uniqueness apply to active rows and adds a service-role-only replacement RPC. It serializes concurrent replacements on the old row and returns the existing child on retry.
- Local integration uses actual workerd R2/KV bindings. Playwright covers the production certificate page and logged-out SkillPassport verification at desktop/mobile sizes; axe covers automated WCAG 2 A/AA rules.
- A repository alert monitor consumes the certificate logger format, retains only timestamp/event/outcome, and emits deduplicated firing/resolved transitions using versioned thresholds.

There is no rollout flag and no rollback strategy, per D8/D9. Migrations and configuration must precede deployment. All local percentile targets passed; deployed latency and manual assistive-technology behavior still require environment validation when deployment is authorized.
