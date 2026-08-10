# Artifact Evaluation Production Hardening (Phase 3)

**Status**: implemented
**Date**: 2026-08-07
**Scope**: `functions/api/v1/artifacts/**`, `functions/lib/{ai-engine,artifact-limits,rate-limiter,metrics,drift-stats}.ts`, `scripts/eval-replay.ts`

## Overview

Hardens the artifact submission/evaluation pipeline for production: deterministic, enforceable evaluation outcomes; strict input/size/rate controls at the edge; structured metrics; single-pass file handling; and a replay tool to detect model drift over time.

## Key design decisions

### 1. Backend is the source of truth for evaluation outcomes

The LLM response is validated against `AI_RESPONSE_SCHEMA` (zod) before anything is persisted:

- `overallScore` is **recomputed** from rubric rows (`ROUND(sum/15*100)`); model arithmetic is never trusted.
- Every evidence quote must appear **verbatim** in the submission text/snippet; fabricated quotes are blanked, the row score zeroed, and the row flagged `evidenceValid: false`.
- The final decision is enforced by rules, in order: any criterion < 2 → `revise_and_resubmit`; critical failure → `revise_and_resubmit`; confidence < 60 → `human_review`; unassessable → `human_review`; evidence validation failed → `revise_and_resubmit`.
- A schema/parse failure (or missing API key) routes to the deterministic `generateFallbackEvaluation` (0 score, `human_review`, 0 XP) — never to a 500.

This is pinned by the gold-standard regression suite (`functions/lib/artifact-evaluator/__tests__/fixtures/gold-standard.ts` + `.test.ts`), which asserts the validated end-to-end output for four adversarial model responses (correct pass, sub-par criterion, fabricated evidence, low confidence). Any prompt/template/validation change that shifts an outcome must update the fixtures deliberately.

### 2. Single-pass file handling

`submitArtifactSubmission` reads each file's bytes **once** (`file.arrayBuffer()`), then reuses the buffer for signature-based content validation (`validateArtifactFileContent`) and text extraction (`extractArtifactContent(file, preReadBuffer)`). Previously the same file was buffered 2–3 times per submission (validation + extraction). `buildArtifactEvaluationInput` accepts `preReadBuffers` and never re-reads.

### 3. Edge hardening (before/without buffering the body)

`request.formData()` buffers the entire multipart body, so guards run first:

- `Content-Length` precheck against `maxRequestBytes` (advisory; chunked bodies skip).
- File count and cumulative size caps after parsing (`maxFilesPerSubmission`, `maxRequestBytes`) → 413.
- Malformed multipart / invalid payload JSON → 400 with structured codes, not 500.
- All caps live in `functions/lib/constants.ts` (`ARTIFACT_LIMITS`, single source of truth shared by the zod schema, the endpoint and the prompt builder). Build-time constants only — fixed, reviewable caps; a misconfigured runtime var cannot widen a validation limit.
- Sliding-window rate limiter keyed by authenticated user (`functions/lib/rate-limiter.ts`), 429 + `Retry-After`. In-memory per isolate — adequate against single-user abuse; a DB-backed limiter is the upgrade path for multi-isolate accuracy.
- `Content-Disposition` filenames are sanitized on both upload and download (`sanitizeContentDispositionFilename`) to block header injection; filename length capped (255) and control characters rejected (`assertValidArtifactFileName`).

### 4. Structured metrics (no PII)

`functions/lib/metrics.ts` exposes counters (`submission_received`, `validation_failed`, `extraction_failed`, `human_review`, `fallback_used`, `retry_count`, `schema_validation_failures`, `decision_overrides`, `evidence_validation_failures`, `rate_limit_hits`) and histograms (`evaluation_duration`, `openrouter_latency`). Each submit request logs a cumulative snapshot in `context.waitUntil` (`logMetricsSnapshot`), then resets. Per-isolate memory only; a queue/analytics sink is the documented upgrade path.

### 5. Failure-path context

Error messages at DB failure sites in `queries.ts` now carry `artifact_id`, `user_id`, `submission_id`, `attempt_no`; the evaluator catch blocks log `submissionId`/`artifactId`/`attemptNo`; OpenRouter retries increment `retry_count` and per-attempt latency is observed.

### 6. Drift replay tool

`scripts/eval-replay.ts` (run via `npm run eval:replay -- --submission-id <uuid>`) rebuilds the evaluation input for stored submissions from Supabase, re-runs the evaluation with today's model, and reports per-submission stored-vs-replayed decision/score/confidence plus aggregate drift (`computeDriftStats`: decision flip rate, avg/p50/p95 score & confidence deltas). Text/URL answers replay faithfully; file answers are excluded (content lives in R2).

## Trade-offs / known limits (deliberate)

- **Rate limiter and metrics are per-isolate**, not global. Documented upgrade: Cloudflare Queues sink for metrics; DB-backed limiter for rate limits.
- **Replay cannot re-extract file content** from R2 — file-grounded evidence is excluded from drift comparisons.
- **No dynamic rubrics**: the 5-criterion rubric and decision rules are constants in code; changing them requires a gold-standard review.
- **No review workflow**: `human_review` sets status and awards no XP; manual handling is out of scope.

## Verification

- `npx tsc --noEmit -p tsconfig.app.json` — clean
- `npx eslint` on touched files — clean
- `npx vitest run` — full suite green, including gold-standard (4 fixtures), rate-limiter (6), artifact-limits (5), metrics (7), drift-stats (4)
- Coverage: `functions/lib/artifact-evaluator/**` ≥ 90% statements/lines (existing thresholds 80/75)
