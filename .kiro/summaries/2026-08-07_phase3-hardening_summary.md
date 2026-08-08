# Phase 3 — Artifact Evaluation Production Hardening: Implementation Summary

**Date**: 2026-08-07
**Status**: complete
**Branch base**: f67f521 (investigation WIP, committed)

## What was built

| Area | Change |
|---|---|
| Determinism & validation | (already committed in f67f521) zod `AI_RESPONSE_SCHEMA`, `recomputeOverallScore`, `validateRubricEvidence` (verbatim evidence grounding), `enforceValidatedDecision` (confidence < 60 → human_review, criterion < 2 → revise), `MIN_AI_CONFIDENCE = 60` |
| Gold-standard regression | `functions/lib/ai-engine/__tests__/fixtures/gold-standard.ts` + `gold-standard.test.ts` — 4 adversarial fixtures (pass, sub-par criterion, fabricated evidence, low confidence) pinning validated end-to-end output |
| Input/edge hardening | `functions/lib/constants.ts` — `ARTIFACT_LIMITS`, single source of truth caps (text 20k, URL 2k, filename 255, 20 answers, 10 files, 25 MB body); build-time constants, no env overrides (removed) |
| Rate limiting | `functions/lib/rate-limiter.ts` — sliding-window per-user limiter; submit endpoint returns 429 + `Retry-After` |
| Multipart guards | `submit/index.ts` — `Content-Length` precheck (413), file-count/cumulative-size caps (413), malformed multipart / bad JSON → 400 structured codes (was 500), `Idempotency-Key` length check |
| Single-pass files | `queries.ts` — one `arrayBuffer()` per file, reused for signature validation and extraction via `fileContexts` map + `preReadBuffers` in `buildArtifactEvaluationInput` (was 2–3 buffered reads) |
| Header injection | `sanitizeContentDispositionFilename` + `assertValidArtifactFileName` (control chars, 255 cap) applied at upload **and** download; filename signature validation now runs on bytes (`validateArtifactFileContent(buffer, extension, fileName)`) |
| Observability | `functions/lib/metrics.ts` — 12 counters/histograms; emitted per request via `waitUntil(logMetricsSnapshot)`; latency/retry metrics in `openrouter/client.ts`; `evaluation_duration` in evaluator; `extraction_failed` on unreadable files |
| Failure context | DB error messages carry `artifact_id`/`user_id`/`submission_id`/`attempt_no`; evaluator catch logs include submission/artifact/attempt |
| Drift replay | `scripts/eval-replay.ts` + `npm run eval:replay -- --submission-id <uuid>` — rebuilds inputs from Supabase, re-runs evaluation, reports stored-vs-replayed per submission + aggregate drift (`functions/lib/ai-engine/drift-stats.ts`); text/URL answers replayable (file content is in R2) |
| Cleanup | removed dead `test:property` script (pointed at nonexistent `src/__tests__/property/`); added `eval:replay` script |

## Verification (all green)

- `npx tsc --noEmit -p tsconfig.app.json` — clean
- `npx eslint functions/ scripts/` — 0 errors (5 `no-console` warnings, repo baseline for scripts)
- `npx vitest run` — **996 passed / 1 skipped (115 files)**
- Coverage (full run):
  - ai-engine: **96.11% stmts / 78.05% branch / 100% funcs / 97.35% lines** (target >90%)
  - artifact-evaluator.ts 93.4% stmts, response-schema.ts 100%, artifact-extractor.ts 97.5%, artifact-limits.ts 100%, rate-limiter.ts 95%, metrics.ts 97.2%, schemas.ts 100%
- New tests: gold-standard (4), rate-limiter (6), artifact-limits (5), metrics (7), drift-stats (4); updated queries.test.ts error-message matchers (2)

## Known limits (deliberate)

- Rate limiter + metrics are per-isolate (documented upgrade path: DB-backed limiter, Queues sink)
- Replay excludes file-answer evidence (content in R2)
- No dynamic rubrics / review workflow / DB schema changes — out of scope by design

## Files touched

New: `functions/lib/{constants,rate-limiter,metrics}.ts`, `functions/lib/ai-engine/drift-stats.ts`, `functions/lib/__tests__/{constants,rate-limiter,metrics,drift-stats}.test.ts`, `functions/lib/ai-engine/__tests__/fixtures/{gold-standard.ts,gold-standard.test.ts}`, `scripts/eval-replay.ts`, `docs/architecture/artifact-evaluation-production-hardening.md`

Modified: `functions/api/v1/artifacts/{queries.ts,schemas.ts}`, `functions/api/v1/artifacts/submit/index.ts`, `functions/lib/artifact-file-guard.ts`, `functions/lib/ai-engine/{artifact-evaluator.ts,artifact-extractor.ts}`, `functions/lib/openrouter/client.ts`, `functions/shared/types.ts`, `functions/lib/env.ts`, `functions/api/v1/artifacts/__tests__/queries.test.ts`, `package.json`
