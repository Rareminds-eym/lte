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

- Full Vitest run: 197 files passed; 1,527 tests passed and one skipped. Some existing tests emit refused localhost:3000 connections without failing.
- Application/backend typecheck, production build, certificate ESLint, additional changed shared/backend ESLint, global CSS lint, template artifact check and diff whitespace check passed.
- Isolated schema-only local database tests passed for SQL migrations, XP rollback/idempotency, snapshots, grants, cleanup retry/lease ownership and cascade erasure. Only their temporary audit database was removed; the source database was unchanged.
- Local Chrome render, with network requests blocked: one landscape A4 PDF, no content overflow for the representative fixture, semantic theme colors and a visible verification link. No Cloudflare rendering request was made.
- Rule checks passed: files, console, lengths, authentication, runtime separation, API client, state, versioning, lazy routes, test layout, binding and gateway. Gateway audit retains two pre-existing ownership warnings.
- FSD checker: exactly the same 26 errors and five warnings on current code and an isolated `dev` snapshot; no introduced or resolved findings.
- Existing `dev` failures remain in tokens (3), request validation (1), alias imports (4), empty catches (3), naming (2), native images (1 genuine finding; the old checker also falsely flags the shared Image implementation), and bare toasts (13). They were reproduced on the dev snapshot and are outside this branch's introduced changes. This is not a claim that repository-wide CI is green.
- LTE's graph was refreshed with `graphify update .`.

## Unresolved policy/operational requirements

The dev-compatible SkillPassport HTTP/HMAC service contract still conflicts with the rule against manual JWT verification and typed-RPC-only inter-service communication. Auth-core's installed user authentication is not a compatible service-token verifier. A coordinated SkillPassport/auth-core service contract and binding change, or an explicit policy exception, is required. Renaming its native Web Crypto verifier does not resolve this violation.

Before deployment, apply all six certificate migrations in order, including `20261008100400_atomic_certificate_issuance.sql` and `20261008100500_certificate_storage_cleanup.sql`. They were tested, not deployed. Configure the external maintenance scheduler and verify cleanup completion as described in `functions/README.md`; no scheduler was installed. Real upstream rendering, deployed RPC integration, and the full real-service browser journey were not rerun as part of these isolated checks.
