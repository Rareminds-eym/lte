# Certificate system verification — 2026-10-08

The certificate system is implemented across LTE and SkillPassport. The user's instruction, **“dont deploy to anywhere. test locally only”**, supersedes the earlier preview target selection. No deployment, remote migration, remote secret change, or remote configuration write was performed.

## Task coverage

| Tasks | Implementation and evidence |
| --- | --- |
| T1 | Four additive migrations, including immutable replacement lineage and a service-role-only atomic replacement RPC. SQL assertions pass against local PostgreSQL; all four versions are recorded in the local migration ledger. Natural-key uniqueness, state transitions, frozen snapshots, replacement, erasure behavior, grants, and XP enum insertion are covered. |
| T2 | Required environment validation, credential generator, learner-name resolution, and shared service-token signer/verifier. |
| T3–T4 | Course/role issuance, collision recovery, pending-name finalization, revocation, atomic revoke/reissue, bounded reconciliation, idempotent 50 engagement XP, completion/settings hooks, and the readiness schema fix. |
| T5–T6 | Authenticated learner list/detail/download routes and public valid/revoked/not_found verification with ownership, validation, CORS, and distributed limits. |
| T7–T8 | Escaped self-contained templates, bounded real Cloudflare rendering, typed failures, random R2 keys, conditional caching, and race cleanup. Local integration uses real workerd R2/KV bindings. |
| T9 | Scoped five-minute HS256 service tokens, stable cursor pagination, field mapping, and authenticated PDF streaming. The local signed pull returns both course and role certificates. |
| T10–T11 | LTE schemas, hooks, cards, actions, completed-level wiring, Certificates page/navigation, and cache invalidation. The local browser harness exercises the production page through sign-in, completion, listing, and download. |
| T12 | Public lazy SkillPassport route with all response states, `noindex`, strict response parsing, and credential-free fetch. The page hides the third party chat widget and the public mobile menu now has an accessible name/state. |
| T13 | PII-safe structured logs, executable alert thresholds/monitor, ADR, API and operations runbook, erasure guidance, and certificate-scoped coverage above 80%. |
| T14 | The amended local browser demonstration passes. Preview/production deployment is intentionally excluded. |

## Checks and results

| Check | Result |
| --- | --- |
| LTE full `vitest run` | **167 files passed; 1,476 tests passed, 1 skipped** |
| Focused certificate tests | **10 files; 76 tests passed** |
| Certificate runtime coverage | **97.82% statements; 90.10% branches; 97.70% functions; 98.32% lines** |
| LTE `npm run typecheck` | Passed |
| LTE production build | Passed |
| Cloudflare Pages Functions bundle | Compiled successfully locally |
| SkillPassport certificate tests | **7 passed** |
| LTE and SkillPassport certificate ESLint | Passed |
| LTE auth-boundary lint | Passed after stale-path/config correction |
| SkillPassport production build | Passed; existing circular-chunk and large-chunk warnings remain |
| `supabase/tests/certificates.sql` | Passed on real local PostgreSQL; assertion fixtures rolled back |
| `npm run certificates:test:local -- --browser` | Passed; all temporary database fixtures removed |
| `npm run certificates:test:local -- --performance` | Every local p95 target passed |
| `npm run certificates:monitor` smoke | Emitted one deduplicated `issuance_failures` firing transition at count 11 |
| Git whitespace validation | Both repositories pass |

The local browser run signs in through a local auth boundary, presses the completion control, executes the real progress/issuance backend against local PostgreSQL, renders the production LTE Certificates page, and downloads a real PDF through Cloudflare Browser Rendering. It extracts the PDF's actual `/URI` annotation and opens that exact address through the real SkillPassport router while logged out. Desktop (1280×900) and mobile (390×844) runs show **Verified achievement**, the stored snapshot, and `noindex`; axe reports no WCAG 2 A/AA violations. Browser artifacts are stored under `/tmp/lte-certificate-*`.

The same integration uses local workerd R2 and KV bindings. It confirms cache reuse, distributed-limit allow/deny behavior, signed internal pull, PostgreSQL immutability, revocation responses, and idempotent atomic replacement with corrected content and no duplicate XP. Cleanup removed every synthetic user; a final query returned zero certificate fixture users.

Local performance evidence is stored in `/tmp/lte-certificate-performance.json`:

| Operation | Samples | p95 | Target |
| --- | ---: | ---: | ---: |
| Issuance | 30 | 13.20 ms | <150 ms |
| List + reconcile | 30 | 10.35 ms | <300 ms |
| Public verify | 30 | 7.07 ms | <150 ms |
| First download, real rendering | 10 | 1,626.11 ms | <8,000 ms |
| Cached download, workerd R2 | 30 | 5.62 ms | <500 ms |
| Internal page | 30 | 3.69 ms | <500 ms |

The environment for these measurements is local PostgreSQL and workerd R2/KV with the configured real Cloudflare Browser Rendering API. They establish the local acceptance target, not deployed-region latency.

## Fixes discovered during validation

- Supabase's default service-role grants included DELETE. The migration explicitly revokes existing privileges before granting SELECT/INSERT/UPDATE.
- Readiness queried profile columns absent from the local schema. Both readers now use owned `users.metadata`, allowing role-certificate issuance.
- The lint configuration referenced moved auth, image, and resource-viewer files, and demanded a nonexistent `withAuth` wrapper. Paths now match the repository and backend routes are checked for the canonical `@functions/middleware` adapter.
- SkillPassport lint traversed generated `.wrangler`, coverage, graph, and template output and applied browser globals to worker/node files. The configuration now excludes generated output, uses the actual TypeScript projects, applies runtime globals by environment, and leaves TypeScript identifier resolution to TypeScript.
- The SkillPassport public header's mobile icon button lacked an accessible name; axe found it and the button now exposes its name and expanded state.
- The chat widget hide class depended on the third party widget becoming ready. The verification page now applies and removes the class directly for its lifetime.
- The original local integration used R2/KV doubles and covered only the verification page in Chrome. It now uses workerd bindings and Playwright covers the learner page, download, desktop/mobile verification, and automated accessibility.

## Scope qualifications

SkillPassport's repository-wide lint and typecheck still report thousands of pre-existing errors in assessment, admin, messaging, generated/incomplete modules, and other unrelated areas. Per the user's explicit scope choice, this work fixes certificate files and lint configuration only. Targeted certificate lint/tests pass, and the production build succeeds.

Automated axe checks do not replace manual screen-reader testing. Managed alert notification delivery and deployed latency cannot be verified without a deployment; the repository monitor emits clean firing/resolved JSON transitions for a deployment log pipeline to route. Cloudflare dashboard state, public R2 domain exposure, and cross-application production SSO remain deployment-time checks.

The local database contains all four migrations:

- `20261008100000_create_certificates`
- `20261008100100_grant_certificates_access`
- `20261008100200_add_certificate_earned_xp_event`
- `20261008100300_certificate_replacements`

No remote environment was changed.
