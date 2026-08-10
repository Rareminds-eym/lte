# 2026-08-10 Branch Audit Verification: `feat/artifact-ai-evaluation` vs `dev`

**Date**: 2026-08-10
**Contract**: `lte/.codereview.yml` (1899 lines) + workspace steering (`.kiro/steering/04-database-api-standards.md`)
**Scope**: `git diff dev...HEAD` (13 commits, merge-base `11da8c6`, 203 files) **plus uncommitted working-tree remediation** (`queries.ts`, `ArtifactFeedbackTab.tsx`, `ArtifactPanel.tsx`, new `useSubmissionEvaluation.ts`, migration `20260807090000`, test relocations).
**Method**: 5 parallel read-only audit subagents (AI engine / artifact API / backend infra / frontend / migrations-config-tests) + cross-cutting scans (console, secrets, hex colors, `supabase.*`, `<img>`, raw fetch, Toaster mounts) + independent re-verification of every Critical/High claim by the main agent.

## Decisions recorded (user-confirmed 2026-08-10)

| ID | Item | Decision |
|---|---|---|
| H2 | RLS on new artifact tables | **Declined — no RLS.** Tables stay GRANT-CRUD to `authenticated`. NOTE: `supabase/README.md:84` claims "All tables have RLS enabled" — that claim is false; README should be corrected or reworded. |
| H8 | Raw prompt/response in `debug_telemetry` returned to learners | **Retained for now** (confirmed 2026-08-10). `artifact-evaluator.ts:566-579,664` stores `rawPromptContent`/`rawResponseContent`; `evaluation.ts:46` returns the blob. Revisit before GA. |

## Verdict summary

- **Blocking (fix before merge)**: ~~H3~~ **FIXED** (seed + guard), ~~M6~~ **FIXED** (capped body read), ~~F-1~~ **FIXED** (test added); H1/H7 fixes committed with the branch.
- **Should fix**: M1, M2, M3, M4, M5, M7, M8, I3
- **Needs product decision**: L12 (deterministic AI fallback), fail-open vs fail-closed pre-parse caps, new dep `mammoth` + xlsx CDN pin
- **Fixed by working-tree remediation (verified)**: H1 (idempotency), H4 (mock-data UI), H5 (evaluation via TanStack Query), H6 (decision union), H7 (silent catches), H9 (tests out of source tree), L13, L14, L15, "ArtifactFeedbackTab untested"
- **Passed clean**: auth migration repo-wide, SSO typed RPC, FSD direction + `@/` alias, API versioning, IDOR guards, file guards (magic bytes/zip-bomb), R2 orphan cleanup, P0-1 fallback guarantees, Zod at AI-response boundary, no console/secrets/hex/`<img>`/local-Toaster violations, query keys include userId, kebab-case renames fully propagated, backend tests co-located, migrations idempotent (`IF NOT EXISTS`)

## 🔴 Critical / blocking

| # | Finding | Rule | Status |
|---|---------|------|--------|
| C1 | **H1 + H7 fixes exist only in the working tree** (`functions/api/v1/artifacts/queries.ts` +51, `queries.test.ts` +42: early idempotency lookup at `:380` before demote/insert; race re-find at `:449`; `apiLogger.warn` at `:206,231,253` pre-parse catches). Merge without committing = the original `is_latest` corruption and silent catches ship. | Correctness | Fix present — **commit before merge** |
| C2 | **H3 — DML `UPDATE` in migration** `supabase/migrations/20260807090000_artifact_submission_idempotency_and_latest.sql` (working tree had a DO block; rationale: seeds are not auto-run on `supabase db push`, and the backfill must precede the unique index). Steering 11.8.1 forbids DML in migration files. | 04 §11.8.1 | **FIXED 2026-08-10 (user decision: move to seed)**: UPDATE removed from the migration; backfill moved to `supabase/seed/{dev,production}/seed_lte_catalog_16_artifact_submission_latest_demote.sql` (idempotent, DML-only); the migration now has a DDL-only pre-check DO block (SELECT + RAISE EXCEPTION) that fails loudly with run-the-seed instructions if duplicate `is_latest` groups exist before index creation. Fresh DBs (empty table) pass the check. |
| C3 | **M6 — body size guard bypass** `submit/index.ts:23-38,103-132`: Content-Length is advisory (chunked bodies omit it); `request.formData()`/`request.json()` buffer the full body before the cumulative cap runs; JSON path had no post-parse size check. Memory-DoS surface (~128MB isolate). | Security / "Backend validation mandatory" | **FIXED 2026-08-10**: `readBodyWithCap` streaming reader with hard 25MB byte cap before any parse; multipart rebuilt from capped bytes; JSON path now capped too; regression test "rejects a chunked body (no Content-Length) above maxRequestBytes" added (`submit.test.ts`) |
| C4 | **F-1 — `useSubmissionEvaluation.ts` untested** (new, untracked). Critical "Mandatory Test Files" rule: PRs with untested new modules are blocked. | Testing (critical) | **FIXED 2026-08-10**: `src/__tests__/submit-artifact/model/useSubmissionEvaluation.test.tsx` added |

## 🟠 High

| # | Finding | Rule | Status |
|---|---------|------|--------|
| H1 | M1 — env validation lazy: `validateBackendEnv` only invoked inside `requireAuth` (`middleware/auth.ts:23`); public endpoints never validate; `OPENROUTER_API_KEY` optional (`env.ts:32`) degrades silently to `human_review` fallback (`artifact-evaluator.ts:455-459`) with 200. | "Immediate Validation of Environment Variables" (critical) | Open — needs decision (required vs optional key; root `_middleware.ts` init validation) |
| H2 | M2 — rate limiter inline only on submit (`submit/index.ts:87-94`); `auth/refresh.ts`, `auth/sso/exchange.ts`, evaluation/download endpoints unrate-limited. | "Use middleware for cross-cutting concerns" (high) | Open |
| H3 | M3 — `GET /api` (exact), `//api/x`, `/api%2Fx` fall through to SPA shell 200: `[[path]].ts:13` uses `startsWith("/api/")`. Test suite lacks the exact-`/api` case. | "Endpoint Versioning" (critical) | **FIXED 2026-08-10**: `pathname === "/api" || startsWith("/api/")` + "GET /api (exact)" test case added (`spa-fallback.test.ts`) |
| H4 | M4 — prompt-injection residuals: `urlResponse` sent unwrapped (no `[BEGIN/END]` delimiters, `artifact-evaluator.ts:413`); model free-text (`feedback`, `notes`, `singleImprovementPoint`, `failuresFound`) unvalidated → learner-facing text. Cannot flip decision/XP (backend recomputes). | Security | Open — needs product call on model-text handling |
| H5 | M5 — redundant migration `20260808000000:13`: `CREATE UNIQUE INDEX IF NOT EXISTS uq_learning_tracks_...` duplicates dev constraint `20260730120000:14`; header missing `-- Rollback`. | 04 §11.7 | Open |
| H6 | M7 — untested: `evaluation-context.ts` (140 new lines), `sanitizeContentDispositionFilename`/`assertValidArtifactFileName` (CR/LF injection guards, `artifact-file-guard.ts:129-147`), `processAndSaveArtifactEvaluation` (`artifact-evaluator.ts:599-744` DB/XP transitions), chunked-oversize (fixed), `HTTPS_URL_REQUIRED`. | "Mandatory Test Files" (critical) | Open (partial) |
| H7 | M8 — hardcoded values: 140-line `SYSTEM_PROMPT` inline (`artifact-evaluator.ts:227-367`); temperature/max_tokens not in `constants.ts` (`:224-225`); truncation caps inline (`:402,411,414`); extractor caps module-local (`artifact-extractor.ts:17-21,248`); retry/timeout inline (`client.ts:25,28,38`); `?? 60` defaults (`:51,441`); criteria labels triplicated (`types.ts`, `response-schema.ts`, evaluator). | "No Hardcoded Values" (critical) | Open |
| H8 | OpenRouter transport response cast `as OpenRouterChatResponse` (`client.ts:57`), not zod-validated (content IS validated one layer up at `artifact-evaluator.ts:480`). | "Proper Zod usage" — external API response validation | Open |
| H9 | I3 — test roots `src/__tests__/submit-artifact/` and `src/__tests__/entities/` not in the `.codereview.yml:209-244` approved root list. Follows the responsibility pattern; needs list extension or relocation. | "Tests must use feature/responsibility folders" (high) | Open — recommend extending the contract list |

## 🟡 Medium

- **L1** — persistence failures return 200 (`artifact-evaluator.ts:671,683,699-700` log-only). Fix: `partial_persistence` signal or rethrow.
- **L2** — unbounded OpenRouter response body (`client.ts:57` `response.json()`). Fix: size-cap the read (~1MB).
- **L3** — zip-bomb check only for xlsx/xls (`artifact-extractor.ts:131-140`); docx/pptx paths skip it.
- **L4** — SSRF-shaped template fetch (`evaluation-context.ts:112,119`): server-side `fetch(file_url)` for any `http`-prefixed URL; allowlist or R2-only keys.
- **L5** — raw `error.message` leaked in 500s: `me.ts:50-52`; no requestId on auth errors (`http.ts:18` supports it).
- **L6** — `shared/logger.ts:40-51` recreated in branch with no level gating — debug/info emit in prod.
- **L7** — `_middleware.ts:22` rethrows non-auth errors without log/requestId.
- **L8** — `refresh.ts:56-58` empty catch (comment only); `refresh.ts:42-46` manual `atob` JWT decode (pre-existing, on touched file).
- **L9** — untyped duck-cast `sso-client.ts:63-80` (`authenticateSharedSession` absent from `SsoRpcService`).
- **L10** — skill-gateway docstring claims auth-core signing (`skill-gateway.ts:10-12`) but code hand-rolls HS256 (`:30-65`); `GATEWAY_TIMEOUT_MS = 2000` hardcoded (`:27`).
- **L11** — `mammoth ^1.12.0` new unapproved dep (docx extraction) + caret range; `xlsx` moved to CDN tarball `0.20.3` (pinned, official — security-positive; L17). Pin mammoth exact; document supply chain.
- **L12** — fail-open pre-parse caps (`queries.ts:202-211,229-237,251-259`): infra error → cap check skipped (extractor still enforces later). Keep fail-open vs fail-closed needs decision.
- **L13** — `package.json` version drift vs `.codereview.yml` stack contract (react 19.2.7 vs 18.3.1, vite 8.1.5 vs 5.4.2, etc.) — pre-existing.
- **L14** — `package.json:45` script drift: `test:property` removed, `eval:replay` added (L16).

## 🟢 Low / Info

- **L1** — `useSubmissionEvaluation` query uses `isFetching` for "Evaluation in progress…" (`ArtifactPanel.tsx:100`) — fires on background refetch; use `isPending`.
- **L2** — hardcoded `Evaluator: OpenRouter AI` label renders even when no evaluation exists (`ArtifactFeedbackTab.tsx:171`); derive from real data or hide.
- **L3** — `(0–3 Scale)` and `{row.score}/3` hardcoded while `maxScore` available (`ArtifactFeedbackTab.tsx:245,254`; `:260` uses it correctly).
- **L4** — silent decode fallback `artifact-extractor.ts:75-79` (no log); retry attempts unlogged (`client.ts:40-44`).
- **L5** — DB error conflated with not-found → 404 (`queries.ts:274-276,941-943`); masks infra faults.
- **L6** — unlogged early returns in `evaluation-context.ts:17,25,35` (`artError`/`mcError`/`modError`).
- **L7** — `as never` in `gold-standard.test.ts:31`; `requireEnv` hand-rolled not zod (`eval-replay.ts:43-47`).
- **L8** — migration `20260808000000` missing `-- Rollback` header field.
- **L9** — `supabase/README.md:84` claims "All tables have RLS enabled" — false (see decision H2). Correct the README.
- **L10** — `Toaster.tsx:16-22` uses `var(--color-*, #fallback)` — token-first with fallback values; acceptable, consistent with Tailwind v4 token strategy.
- **INFO** — `console.*` in `scripts/eval-replay.ts` (dev CLI, feature branch — permitted by rule; will trip CI if merged to a production branch as-is).
- **INFO** — `LevelContentPage.test.tsx` uses `findBy*`/`waitFor` (async-query rule compliant).

## Per-rule matrix (consolidated)

| Rule (severity) | Verdict |
|---|---|
| Approved auth middleware (critical) | PASS |
| Typed Service Binding RPC (high) | PASS (1 low: untyped duck-cast) |
| Immediate env validation (critical) | PARTIAL (lazy init; optional key degrades silently) |
| Endpoint versioning (critical) | PARTIAL → FIXED for exact `/api` (M3); all routes versioned |
| Middleware for cross-cutting concerns (high) | PARTIAL (rate limiter inline-only) |
| Correct error handling / no fallbacks (critical) | PARTIAL (L12 fallback policy; refresh.ts empty catch) |
| No hardcoded values (critical) | PARTIAL (M8 prompt/caps/criteria; L1-L3 frontend) |
| Secrets not exposed (critical) | PASS |
| Backend validation mandatory (critical) | PARTIAL → FIXED for chunked-body bypass (M6) |
| Proper Zod usage (critical) | PASS (1 low: OpenRouter transport cast) |
| No direct Supabase auth (critical) | PASS |
| Frontend/backend separation (critical) | PASS |
| FSD layer order / no upward imports (critical) | PASS |
| Tailwind v4 + semantic tokens (critical) | PASS |
| Mandatory test files (critical) | PARTIAL → F-1 fixed; M7 gaps remain |
| TanStack Query for server state (critical) | PASS (H5 fixed) |
| Restricted loading states (high) | PASS (L14 fixed; L1 `isFetching` info) |
| Kebab-case dirs (high) | PASS (56 renames, 0 stale imports) |
| Public API index.ts / no deep imports (high) | PARTIAL (L15 fixed; page-internal import acceptable) |
| `@/` alias (high) | PASS |
| Shared Image component (high) | PASS |
| Global Toaster (high) | PASS |
| Auth/user ID in query key (high) | PASS |
| apiFetch generic constraints (high) | PASS |
| Mobile-first (high) | PASS |
| Tests use feature/responsibility folders (high) | PARTIAL (I3 roots) |
| Async queries for lazy tests (high) | PASS (N/A — no AppRouter changes) |
| React.lazy/PageLoader (high) | N/A (AppRouter untouched) |
| Use apiClient/ssoClient (high) | PASS |
| Component placement (high) | PASS |
| Type placement by ownership (high) | PASS |
| Zod schemas near ownership (high) | PASS |
| Migrations DDL-only (critical) | PASS (H3 fixed: backfill in seed 16, guard-only pre-check in migration) |
| RLS on new tables (critical) | FAIL → **declined by decision 2026-08-10** |
| Logging rules (high) | PARTIAL (logger no level gating; refresh.ts empty catch) |
| Backend test placement (high) | PASS |

## Verified clean (evidence)

- **Auth**: all ~30 endpoints on `@functions/middleware` (`requireAuth` → auth-core `verifyJWT`); 0 stale `@functions/lib/auth`/`lib/logger` imports; old fake `verifyAuthToken` removed.
- **IDOR**: `requireOwnedFile` (`queries.ts:919-946`), evaluation ownership (`:994-1014`), download = `attachment` + sanitized filename; verified by tests.
- **File guards before persistence**: magic bytes `queries.ts:153-160`, zip-bomb `:163-183`, control-char guard `:111-118`; R2 orphan cleanup never silent (`:680-685,763-781`).
- **P0-3**: sealed/accepted resubmission → 409 before any state change; idempotency retry path without demoting `is_latest` (new working-tree tests `queries.test.ts:491-526`).
- **Zod at AI boundary**: `AI_RESPONSE_SCHEMA` parse before metrics/decision; evidence quotes verified verbatim; decision enforced backend-side; fallback never awards XP (tested).
- **Zero violations**: `console.*` in src/ or functions/ lib (except dev CLI script), secrets/keys, `VITE_`-prefixed secrets, hex colors in changed components, `<img>` tags, local `<Toaster>`, raw `fetch(` to backend, `supabase.*` in src, upward FSD imports, stale rename references.
- **Migrations**: idempotent (`IF NOT EXISTS`, DO-block), naming correct, second migration DDL-only, transactional.

## Delta vs 2026-08-09 report

- **Fixed since**: H1, H4, H5, H6, H7, H9, L13, L14, L15, ArtifactFeedbackTab tests, `evaluation-context`/spa-fallback/rate-limiter tests added.
- **Resolved by decisions**: H2 (RLS declined), H8 (telemetry retained).
- **Still open**: M1-M8 (as of this report), L1-L17.
- **Fixed this session (2026-08-10)**: M3 (exact `/api` 404 + test), M6 (capped body read + chunked-oversize regression test), C4/F-1 (`useSubmissionEvaluation` test), C2/H3 (DML moved to seed 16 + DDL-only guard in migration).
