# Certificate branch rule remediation

Checked on 2026-10-09. Scope: LTE's `feat/certificate-system` changes against local `dev`, including staged, unstaged and new files. No sibling project, remote deployment or live database was modified.

## Implemented

- Atomic certificate issuance and pending-name finalization, idempotent XP, rollback assertions, and service-only SQL permissions.
- Durable R2 upload/erasure cleanup intents, leased retryable batches, unique render keys and compare-and-set cache updates. Deferred provenance FK checks permit path/progress cascades.
- Canonical auth-core learner middleware and existing SSO RPC pattern; no direct `jose` dependency or invented auth wrapper.
- Zod request schemas in backend schema ownership, operational handling of invalid upstream results, opaque correlation IDs, trace propagation and bounded database/render/API requests.
- Public module imports, matching module tests, TanStack server state/mutations, shared feedback/skeletons, page composition and mobile-first utility layouts.
- PDF utility CSS compiled from the single global Tailwind theme, stale-artifact verification, isolated markup and template version bump. The frontend-design skill was applied to token/layout consistency without rebranding LTE; the Supabase skill guided atomic transactions, constrained grants and short cleanup leases.
- Correct render-failure monitoring and privacy-safe operational logs.

## Verification

- Full Vitest run with normal subprocess permissions: 206 files passed; 1,586 tests passed and one skipped. Some existing tests emit refused localhost:3000 connections without failing.
- Application/backend typecheck, production build, certificate ESLint, additional changed shared/backend ESLint, global CSS lint, template artifact check and diff whitespace check passed.
- Isolated schema-only local database tests passed for SQL migrations, XP rollback/idempotency, snapshots, grants, cleanup retry/lease ownership and cascade erasure. Only their temporary audit database was removed; the source database was unchanged.
- Real local Cloudflare Browser Rendering produced a landscape A4 PDF and the LTE Chrome journey passed sign-in, completion, focused preview, listing and download. The PDF's embedded verification URI matched the immutable certificate snapshot. The LTE-only run did not start or modify the sibling SkillPassport application.
- Rule checks passed: files, console, lengths, authentication, runtime separation, API client, state, versioning, lazy routes, test layout, binding and gateway. Gateway audit retains two pre-existing ownership warnings.
- FSD checker: exactly the same 26 errors and five warnings on current code and an isolated `dev` snapshot; no introduced or resolved findings.
- Existing `dev` failures remain in tokens (3), request validation (1), alias imports (4), empty catches (3), naming (2), native images (1 genuine finding; the old checker also falsely flags the shared Image implementation), and bare toasts (13). They were reproduced on the dev snapshot and are outside this branch's introduced changes. This is not a claim that repository-wide CI is green.
- LTE's graph was refreshed with `graphify update .`.

## Unresolved policy/operational requirements

The dev-compatible SkillPassport HTTP/HMAC service contract still conflicts with the rule against manual JWT verification and typed-RPC-only inter-service communication. Auth-core's installed user authentication is not a compatible service-token verifier. A coordinated SkillPassport/auth-core service contract and binding change, or an explicit policy exception, is required. Renaming its native Web Crypto verifier does not resolve this violation.

Before deployment, apply all six certificate migrations in order, including `20261008100400_atomic_certificate_issuance.sql` and `20261008100500_certificate_storage_cleanup.sql`. They were tested, not deployed. Configure the external maintenance scheduler and verify cleanup completion as described in `functions/README.md`; no scheduler was installed. Real upstream rendering and the LTE browser journey were rerun locally. Deployed RPC integration and the sibling SkillPassport browser were outside the LTE-only scope.

## Post-completion certificate display (2026-10-09)

Course completion now opens `/certificates?levelId=<level UUID>` after the existing XP acknowledgement, including completions with zero XP. The same view is reachable from issued course cards in My Certificates; completed module lists display the document inline. The query parameter is validated before requesting data. Opening a link never authorizes issuance: the existing authenticated server reconciliation and completion rules remain authoritative.

Immediate AI acceptance and later staff approval now converge on one learner-owned progression path. That path resolves the accepted submission to its parent level, recalculates authoritative completion and invokes idempotent certificate issuance. The learner view polls while staff review is pending, refreshes course and certificate queries when the review becomes terminal, and opens the focused certificate only for a passing completion confirmed by the certificate API. Returned work refreshes feedback without opening a certificate. Delayed issuance shows a status message and manual retry instead of failing silently.

The responsive document displays the recorded learner name, title, level, badge, completion date and credential ID. The owner-only summary API now includes `learnerName` from the immutable issuance snapshot. The frontend tolerates its absence during staggered deployment without substituting the current profile name. PDF download, copy-link and verification actions use existing services; the download permission is respected and verification URLs accept only HTTP(S).

The implementation follows the existing FSD public APIs, TanStack Query ownership and user-partitioned keys, centralized labels, global semantic Tailwind tokens, shared skeletons and local error boundaries. Empty issuance results receive up to six automatic checks at three-second intervals; polling stops on a certificate or error, pauses in background tabs, and manual retry remains available. Missing-name and revoked states never render an issued document.

Reference research consulted on 2026-10-09:

- [Udemy certificate guidance](https://support.udemy.com/hc/en-us/sections/360011037194-Certificates-of-Completion?type=student): expose certificate availability after course requirements are complete and provide download access.
- [Coursera course certificates](https://www.coursera.support/s/article/learner-000001187?language=en_US): maintain an accessible certificate collection with download/share actions.
- [W3C status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html): announce availability without forcing focus; the issued-state message uses `role="status"`.

Validation for this addition:

- Targeted component, hook, completion-navigation and backend certificate regression tests cover issued/pending/revoked states, zero/positive XP completion navigation, immediate AI acceptance, deferred staff approval, returned work, learner-owned level recalculation, immutable name serialization, invalid links, delayed issuance, bounded polling, manual retry and download permissions.
- Application/backend typecheck and production build passed after adding two missing `UI_TEXT` imports in the concurrently edited WidgetCard and UserProfileBadge components. Certificate and changed completion-file ESLint checks passed.
- Local Chrome fixture checks passed at 1280px, 390px and 320px: no horizontal overflow and no automated axe WCAG A/AA findings. Browser checks also passed for pending-name and revoked states. Screenshots were visually inspected. The separate LTE-only integration used local Supabase, workerd R2/KV and real Cloudflare PDF rendering. These checks do not establish live deployment or a full accessibility conformance audit.
- State ownership, runtime separation, test layout and file-length checks passed. Repository-wide checks still report the previously documented 26 FSD errors/five warnings, three token findings and one unrelated resource-preview validation finding. This addition does not claim repository-wide CI is green.
- LTE's code graph was refreshed. No database migrations, deployment or live certificate issuance were performed for this addition. The deployment prerequisites above still apply.
