# 2026-08-09 Branch Audit Verification: `feat/artifact-ai-evaluation` vs `dev`

**Date**: 2026-08-09
**Contract**: `lte/.codereview.yml` (1899 lines) + workspace steering
**Scope**: `git diff dev...HEAD` — 203 files, 13 commits (merge-base `11da8c6`). graphify-out/ excluded (dirty expected).
**Method**: 5 parallel read-only subagents, each auditing one change cluster with per-rule check matrices and `file:line` evidence.

---

## Verdict summary

- **Accepted by decision (2026-08-09)**: H2 (RLS — explicitly declined), H8 (debug_telemetry raw prompt/response — retained for now)
- **Blocking (fix before merge)**: H1 (idempotency `is_latest` corruption), H3 (DML in migration), H7 (silent catches), H4/H5 (mock-data UI + non-query evaluation flow), H6 (type contract mismatch), H9 (tests in source tree)
- **Should fix**: M1–M8
- **Debatable/needs product decision**: L12 (deterministic AI fallback — fallback policy requires explicit user approval), I2 (R2 public bucket intent)
- **Passed clean**: auth migration repo-wide (requireAuth everywhere, zero stale imports), SSO typed RPC, FSD direction, kebab-case renames fully propagated, no console/secrets/hex/tailwind/Image/toast violations, Zod at AI-response boundary, IDOR guards on downloads/evaluations, magic-byte + zip-bomb guards before persistence

---

## Per-rule matrix (consolidated)

| Rule (severity) | Verdict |
|---|---|
| Approved auth middleware (critical) | PASS |
| Typed Service Binding RPC (high) | PASS (1 low: untyped `authenticateSharedSession` duck-cast) |
| Immediate env validation (critical) | PARTIAL (lazy init; optional OPENROUTER_API_KEY degrades silently) |
| Endpoint versioning (critical) | PARTIAL (`/api` exact path → SPA shell 200) |
| Middleware for cross-cutting concerns (high) | PARTIAL (rate limiter inline-only, not on SSO endpoints) |
| Correct error handling / no fallbacks (critical) | PARTIAL (3 silent catches in queries.ts pre-parse; mock-data UI fallbacks) |
| No hardcoded values (critical) | PARTIAL (prompt 140-line inline; caps/magic numbers scattered; criteria triplicated) |
| Secrets not exposed (critical) | PASS |
| Backend validation mandatory (critical) | PARTIAL (chunked bodies bypass size guard) |
| Proper Zod usage (critical) | PASS |
| No direct Supabase auth (critical) | PASS |
| Frontend/backend separation (critical) | PASS |
| FSD layer order / no upward imports (critical) | PASS |
| Tailwind v4 only + semantic tokens only (critical) | PASS |
| Mandatory test files (critical) | PARTIAL (ArtifactFeedbackTab untested; 3 tests relocated into src tree) |
| TanStack Query for server state (critical) | FAIL (evaluation state in useState; query module dead code) |
| Restricted loading states (high) | PARTIAL (1 decorative inline spinner) |
| Kebab-case dirs (high) | PASS |
| Public API index.ts / no deep imports (high) | PARTIAL (1 deep import in new test) |
| `@/` alias (high) | PASS |
| Shared Image component (high) | PASS |
| Global Toaster (high) | PASS |
| Auth/user ID in query key (high) | N/A → should exist once evaluation is a query (H5) |
| apiFetch generic constraints (high) | PASS |
| Mobile-first (high) | PASS |
| Tests use feature/responsibility folders (high) | PARTIAL (F7/H9) |
| Async queries for lazy tests (high) | PASS (N/A — no AppRouter changes) |
| React.lazy/PageLoader (high) | N/A (AppRouter untouched) |
| Use apiClient/ssoClient (high) | PASS |
| Component placement (high) | PASS |
| Type placement by ownership (high) | PASS |
| Zod schemas near ownership (high) | PASS |
| Migrations DDL-only (critical) | FAIL (DML UPDATE in 20260807090000) |
| RLS on new tables (critical) | FAIL (no RLS anywhere; GRANT CRUD to authenticated) |
| Logging rules (high) | PARTIAL (logger has no level gating) |
| Test placement backend (high) | PASS (functions tests in functions/__tests__, co-located suites OK) |

---

## Findings

### Blocking — HIGH

**H1 — Idempotent retry corrupts the "exactly one latest" invariant → permanent 500 on resubmission**
- `functions/api/v1/artifacts/queries.ts:361-432` (`createSubmissionAttempt`): demotes current latest (`is_latest=false`) *before* the idempotent-insert collision (23505 on `uq_artifact_submissions_idempotency`) is detected. Duplicate path returns the original row as `duplicate:true` but leaves **zero** `is_latest=true` rows. Every later real resubmission then collides with the original attempt-1 row (23505 on `uq_artifact_submission_attempt`) → 500. Partial unique index only guarantees at-most-one latest, doesn't catch this. Also bypasses the 409 accepted-guard (`queries.ts:365`). Existing test mocks `latest=null` — the retry path is untested.
- Fix: when an idempotency key is present, check `findSubmissionByIdempotencyKey` *first* (before demotion) and return the duplicate; or restore `is_latest=true` on the duplicate path. Add test with `latest`=existing row + 23505.

**H2 — No RLS on artifact tables; GRANT full CRUD to `authenticated`** — **ACCEPTED BY DECISION (2026-08-09): RLS not wanted.**
- New tables `artifact_submissions`, `artifact_evaluation_flows`, `artifact_submission_files` (branch migrations `20260807090000`, `20260808000000`) add no `ENABLE ROW LEVEL SECURITY`/policies; grants file `20260731092000` (pre-existing on dev) grants SELECT/INSERT/UPDATE/DELETE to `authenticated` with RLS off. Any Supabase JWT holder (anon key is in the client bundle by platform design) can read/write all users' submissions. Mitigated in practice only because the frontend is forbidden direct Supabase use.
- **Decision**: user explicitly declined RLS — no action. Residual risk stands on record: the grant surface is a live authorization hole if a Supabase client ever reaches the browser; revisit if frontend direct-DB usage is ever introduced.

**H3 — DML inside a Supabase migration**
- `supabase/migrations/20260807090000_artifact_submission_idempotency_and_latest.sql:17-26`: `UPDATE ... SET is_latest = false` in a migration file — DDL-only rule violated; non-idempotent on partial re-apply; `ADD COLUMN` (`:29-30`) and `CREATE UNIQUE INDEX` (`:36-42`) also lack `IF NOT EXISTS`.
- Fix: move the backfill UPDATE to `seed/` (repo has `seed/dev`, `seed/production`); add `IF NOT EXISTS` guards.

**H4 — Fabricated evaluation data rendered as real results**
- `src/pages/level-content/ui/components/ArtifactFeedbackTab.tsx:121-133`: `selectedScore = evaluationData?.overall_score ?? 85`, feedback defaults `"Pass: No critical failures…"`, improvement text fabricated. `:52-83` `DEFAULT_RUBRIC_ROWS` renders 5 fake rubric rows with fabricated "Evidence" strings whenever no evaluation exists — including when `evaluation_status: "pending"` or after reload where `selectedAttempt.evaluation` is always undefined (see H5). Contradictory defaults (score 85 + "Revise & Resubmit" badge + "Pass:" text).
- Fix: render a genuine "Evaluation pending / not available" state; remove all mock fallbacks; gate rubric/evidence rendering on real data. Violates "No Hardcoded Values" + "Correct Error Handling (No Fallbacks)".

**H5 — Evaluation server state not owned by TanStack Query; `getSubmissionEvaluation` is dead code**
- `ArtifactPanel.tsx:33-35,118` copies mutation response into `useState` (no caching/refetch/invalidation); `:46-68` builds `submittedAttempts` from files only — evaluation never attached, so the feedback tab can never show a stored evaluation for prior attempts. New `src/features/submit-artifact/api/getSubmissionEvaluation.ts` (33 lines) is consumed by nothing but its own barrel and test (no useQuery anywhere).
- Fix: wire `useQuery` keyed by submissionId + userId (per "auth state in query key" rule) or delete the module. Fix `SubmissionEvaluationResponse` type to match backend (`decision: "pass" | "revise_and_resubmit" | "human_review"` + `confidence`).

**H6 — `decision` union type mismatch with backend wire contract**
- `src/features/submit-artifact/api/submitArtifact.ts:22` declares `"pass" | "fail" | "human_review"`; backend emits `"pass" | "revise_and_resubmit" | "human_review"` (`queries.ts:478,784`, `response-schema.ts:40`). UI renders by luck (ArtifactFeedbackTab.tsx:23 declares the correct union). Latent runtime lie in the shared contract type.
- Fix: align the frontend type to the backend union.

**H7 — Silent catch blocks in submit-time pre-parse validation**
- `functions/api/v1/artifacts/queries.ts:202-204, 222-224, 239-241`: `catch (err) { if (err instanceof ArtifactSubmissionError) throw err; }` swallows all other failures (pdfjs/jszip/SheetJS errors) with no log/metric — the 50-page/50-slide/20-sheet caps fail open on infra errors and the failure is invisible. Violates "Always log errors using logger.error".
- Fix: `apiLogger.warn`/`error` the swallowed error (with extension/fileName) + metric; optionally rethrow as `ArtifactSubmissionError` (conservative reject).

**H8 — Raw prompt + LLM response telemetry persisted and returned to learners** — **ACCEPTED FOR NOW (2026-08-09): retained.**
- `artifact-evaluator.ts:572-573,664` stores `rawPromptContent` (full learner submission + template + instructions) and `rawResponseContent` into `metadata.debug_telemetry`; `functions/api/v1/artifacts/submissions/[id]/evaluation.ts:46` returns the whole blob to the caller. Learner PII + internal rubric/prompt text exposure + payload bloat (ownership enforced, so no cross-user leak).
- **Decision**: user opted to keep raw prompt/response telemetry for now. No action. Revisit later: strip raw contents (keep counts) or restrict to admin-only access.

**H9 — 3 frontend tests relocated into the source tree**
- `src/entities/course/api/levelContentApi.test.ts`, `src/entities/course/ui/resource-content-viewer/ResourceContentViewer.test.tsx`, `src/entities/course/ui/resource-content-viewer/types.test.ts` — co-located beside source instead of `src/__tests__/<feature>/<responsibility>/` (kebab-case). Inconsistent with sibling tests left in place.
- Fix: move to `src/__tests__/entities/course/ui/resource-content-viewer/` and `src/__tests__/level-content/api/levelContentApi.test.ts`; re-run vitest.

### MEDIUM

**M1 — Env validation lazy; misconfig → generic 500; OPENROUTER_API_KEY optional degrades grading silently**
- `middleware/auth.ts:21-23` gates `validateBackendEnv` behind first-`requireAuth`; public endpoints (logout, capabilities, preview) never validate → missing `SUPABASE_URL` surfaces as runtime 500. `env.ts:32` declares `OPENROUTER_API_KEY` optional; `artifact-evaluator.ts:455-459` handles absence with info-log + deterministic fallback → every submission routes to `human_review` while API returns 200 (P0-1-safe but silent). Violates "throw a clear configuration error at startup".
- Fix: root `functions/_middleware.ts` validating at isolate init; make the key required or log `error` + startup ping check.

**M2 — Rate limiter not applied to SSO/auth endpoints**
- Limiter only invoked inline at `submit/index.ts:87-91` (10 req/60s per user). `exchange.ts` (auth-code redemption) and `refresh.ts` (refresh-token rotation) are unrate-limited — brute-force surface. Per-isolate in-memory (documented `ponytail:` ceiling).
- Fix: `_middleware.ts` on `/api/v1/auth/*` with a tighter window on refresh/exchange.

**M3 — SPA catch-all returns app shell for unversioned `/api` paths**
- `functions/[[path]].ts:13` uses `startsWith("/api/")` — `GET /api`, `/api?x=1`, `//api/x`, `/api%2Fx` fall through to index.html 200 (should be JSON 404). No auth bypass (CF route matching doesn't normalize these onto the real function routes) but inconsistent. `POST /api` exact returns plain-text 404.
- Fix: `pathname === "/api" || pathname.startsWith("/api/")`; add spa-fallback tests for these shapes.

**M4 — Prompt-injection residuals in evaluator**
- `artifact-evaluator.ts:413`: `urlResponse` not wrapped in the untrusted-data delimiters used for text/file content; static delimiters (`[END LEARNER SUBMISSION]`) can be echoed by learner content; model-controlled free-text (`notes`, `failuresFound`, `feedback`, `singleImprovementPoint`) passes to DB/UI unvalidated — cannot flip decision/XP (backend recomputes + verbatim evidence check) but can plant misleading user-facing text.
- Fix: delimit `urlResponse`; length caps + strip control markers on free-text fields; consider per-request random delimiters.

**M5 — learning_tracks unique index fails on dirty data; redundant duplicate**
- `supabase/migrations/20260808000000_add_learning_tracks_natural_key_unique.sql:20-21`: `track` is `varchar NOT NULL` — two rows with `''` tracks collide → migration fails on dirty data (header admits prerequisite, no dedup step). Dev already has constraint `uq_learning_tracks_user_assessment_track` (20260730120000) with the same name — the new `CREATE UNIQUE INDEX IF NOT EXISTS` is a no-op where applied, a second failure point where not.
- Fix: drop this migration (constraint covers it) or add dedup + handle `''` (e.g. `WHERE` clause excluding empty tracks).

**M6 — Body-size guard bypassed by chunked/JSON bodies**
- `submit/index.ts:23-38` checks `Content-Length` only when present (advisory); chunked bodies fully buffer (`request.formData()`/`readJsonObject`) before the cumulative cap runs — memory DoS surface on a ~128MB isolate. JSON path has no post-parse size check.
- Fix: stream-read with hard byte cap (`body.getReader()` aborting at `ARTIFACT_LIMITS.maxRequestBytes`) or reject undeclared-size bodies.

**M7 — Missing tests (mandatory-test rule)**
- No test for ArtifactFeedbackTab rewrite (157 lines: decision mapping, DECISION_META, rubric rendering, download-error toast). No test for the H1 idempotent-retry path, `sanitizeContentDispositionFilename`/`assertValidArtifactFileName` (CR/LF injection), `processAndSaveArtifactEvaluation` DB-error branches, submit-time pre-parse caps, `HTTPS_URL_REQUIRED`, chunked oversized body, concurrent same-key race.
- Fix: add the above; at minimum the ArtifactFeedbackTab test (required by contract).

**M8 — Hardcoded values & triplicated constants**
- 140-line `SYSTEM_PROMPT` + `EVALUATION_TEMPERATURE`/`MAX_TOKENS` inline in `artifact-evaluator.ts:224-367`; truncation limits 15k/20k/50k inline (`:402-417`); caps duplicated `artifact-extractor.ts:18-21,248` vs `queries.ts:195,215,232` (50/50/20); `?? 10` MB, `?? 60`/`?? 100` score defaults (`queries.ts:130,842-843`); criteria labels triplicated (`types.ts:1-6`, `response-schema.ts:7-13`, `artifact-evaluator.ts:29-35`); 30s timeout/500ms backoff inline (`client.ts:28,38`).
- Fix: centralize in `constants.ts`/`prompt.ts`; derive criteria labels from one source.

### LOW

- **L1** — 200 returned when evaluation persistence fails: `artifact-evaluator.ts:671,683,699-700` log-only; endpoint still returns success. Fix: surface error/`partial_persistence` flag.
- **L2** — R2 public custom domain (`wrangler.toml:44`) + `file_url` stored per row; bucket itself has no per-object auth (endpoint path is auth-bound). Confirm intent or move to private bucket + signed URLs.
- **L3** — `_middleware.ts:22` rethrows non-auth errors without structured logging (generic 500, no requestId).
- **L4** — Template URL server-side fetch (`evaluation-context.ts:112-121`) only checks `startsWith("http")` — SSRF if `artifact_templates` ever attacker-influenced. Fix: host allowlist/R2-only.
- **L5** — OpenRouter client buffers full body (`client.ts:57`) with no size cap. Fix: arrayBuffer + cap (~1MB).
- **L6** — Zip-bomb check in extractor only for xlsx/xls (`artifact-extractor.ts:131-140`); docx/pptx extraction paths skip (API path guarded at submit). Fix: hoist check to dispatch for all zip formats.
- **L7** — `functions/shared/logger.ts:40-63` has no environment level gating (debug/info emit in production). Fix: gate on NODE_ENV.
- **L8** — `scripts/eval-replay.ts:43-47` hand-rolled `requireEnv` (not zod); documented skew: file answers excluded → evidence fails on replay (`:15-18`).
- **L9** — Empty catch `refresh.ts:56-58` (XP telemetry JSON.parse). Fix: log at debug.
- **L10** — Pre-existing manual JWT decode `refresh.ts:42-46` (`atob` of payload for `sub`) on a touched file — not introduced by branch; tokens from SSO RPC. Fix: use `verifyJWT`/drop decode.
- **L11** — Untyped duck-cast RPC `lib/sso-client.ts:63-80` (`authenticateSharedSession` not in `SsoRpcService`). Fix: add to interface or remove legacy branch.
- **L12** — Deterministic AI fallback when key missing (`artifact-evaluator.ts:455-456`): silent-ish quality degradation, logged at info. Per steering, fallback logic needs explicit user decision (keep/remove/fail-closed).
- **L13** — Idempotency key cleared on error too (`useSubmitArtifact.ts:18-21`); v5 mutation `retry: 0` means no automatic retries — failed-then-manual retry gets a new key → possible duplicate submission. Fix: clear only on success.
- **L14** — Inline `animate-spin` ring (`ArtifactFeedbackTab.tsx:226`, "Staff Review" indicator) outside the 3 allowed loading states; shared `InlineSpinner` exists but unused. Fix: use shared spinner or static dot.
- **L15** — Deep import in new test (`getSubmissionEvaluation.test.ts:9`) instead of slice barrel.
- **L16** — `.codereview.yml` script contract drift: `test:property` removed (folder never existed — correct cleanup), `eval:replay` added — declare both in contract.
- **L17** — `xlsx` from CDN tarball (pinned, official SheetJS source — supply-chain note; consider vendoring); `mammoth ^1.12.0`, `pdfjs-dist ^6.2.108` caret ranges vs exact-pin rule.

### INFO

- **I1** — `_routes.json` include `/*`: every static hit outside `/assets/*` incurs a function invocation (cost/latency). Consider excluding more static roots.
- **I2** — `.env.example` carries `SUPABASE_SERVICE_ROLE_KEY` (truncated placeholder) in the frontend template — harmless, consider removing backend secret names from frontend template.
- **I3** — New tests at `src/__tests__/submit-artifact/{api,model}/` follow repo flat pattern, not the documented `__tests__/features/...` structure (non-blocking).
- **I4** — Stack version drift (react 19.2.7 vs declared 18.3.1, router 7.18.1 vs 7.9.4, zustand 5.0.14 vs 5.0.8, tanstack 5.101.2 vs 5.90.3, vitest 4.1.0 vs 1.6.1) is pre-existing on dev — flag a future contract sync.

---

## What passed clean (evidence)

- Auth migration repo-wide: all ~30 endpoints use `requireAuth` via `@functions/middleware`; zero stale `@functions/lib/auth`/`logger` imports; `verifyJWT` delegates to auth-core; artifacts route covered by `_middleware.ts:11-23`.
- SSO via typed RPC (`SsoRpcService.getJWKS` shared/types.ts:69; verified auth-core uses it for JWKS).
- IDOR: `requireOwnedFile` (`queries.ts:872-899`) + evaluation ownership filter (`queries.ts:947-967`); download uses attachment disposition + sanitized filename (`queries.ts:934-937`).
- File guards before any persistence: magic bytes (`artifact-file-guard.ts:56-99`), zip-bomb (`:202-263`), 50-page/50-slide/20-sheet caps, filename control-char sanitization.
- Zod at AI boundary: `AI_RESPONSE_SCHEMA.parse` before metrics/evidence/decision (`artifact-evaluator.ts:479-480`); backend recomputes score/tone/decision and verifies every evidence quote verbatim.
- FSD: no upward imports, no feature→feature imports, kebab-case renames fully propagated (0 stale refs repo-wide), barrels complete, no src↔functions imports (except 1 INFO-level test deep import).
- Styling/UI: 0 hex codes, 0 native `<img>`, 0 local `<Toaster>`, toast via `@/shared/ui`, no `supabase.*`, no raw `fetch()` in src.
- Secrets: no real keys in diff (placeholders only); no `VITE_`-prefixed private values; no console in backend code.
- Tests: 122 files / 1032 passing per CI gate; gold-standard regression suite; strong failure-path coverage in evaluator/extractor/guard.

---

## Follow-up required

1. Product decision: keep/remove/fail-closed the deterministic AI fallback (L12); R2 public bucket intent (L2).
2. Fix plan for H1–H9 (data-integrity, RLS, migration hygiene, UI truthfulness, contract types, test placement).
3. Contract sync: `.codereview.yml` scripts + stack versions (L16, I4).
4. After fixes: re-run `graphify update .` from `lte/` to refresh the graph.
