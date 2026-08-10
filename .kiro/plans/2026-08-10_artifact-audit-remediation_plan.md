# Artifact AI Evaluation Branch — Corrected Remediation Plan

**Date**: 2026-08-10
**Branch**: `feat/artifact-ai-evaluation` (HEAD `3db5191`) vs `dev`
**Standards**: `lte/.codereview.yml` (verified against source; false positives removed)

All findings below were re-verified by direct read after the initial 8-subagent audit. Findings marked **pre-existing** were NOT introduced by this branch and must not block its merge.

---

## P0 — Data-integrity blockers (must fix before merge)

### P0.1 Broken migration: comment swallows CREATE UNIQUE INDEX
- `supabase/migrations/20260807090000_artifact_submission_idempotency_and_latest.sql:53`
- `-- 4. Duplicate submission request deduplication (P0-2).CREATE UNIQUE INDEX IF NOT EXISTS uq_artifact_submissions_idempotency` — statement merged onto comment line; lines 54-55 orphaned `ON ... WHERE ...` → syntax error → whole migration (and the next one) roll back; idempotency feature dead at DB layer.
- **Fix**: newline after comment. Also fix header phase (`Phase: 1 of 1` vs seed's `Phase: 2 of 3`).
- **Verify**: `supabase db reset` locally applies cleanly; `supabase migration list` shows applied.

### P0.2 Stuck-pending submissions: rollback gaps + no re-trigger path
- `functions/api/v1/artifacts/queries.ts:446-455` (answers upsert) and `:525-568` (artifact meta / question details / evaluation) throw OUTSIDE the rollback `try` at `:460-522`.
- Failure after row+files persist → retried `Idempotency-Key` returns `evaluation_status: "pending"` forever; no mechanism re-runs evaluation on an existing submission.
- **Fix**: extend rollback to cover answers + post-upload steps (single outer try), and add a duplicate-without-flow re-evaluation path (if `evaluation_status` pending and no flow row → re-run `processAndSaveArtifactEvaluation`).
- **Verify**: new test in `functions/api/v1/artifacts/__tests__/queries.test.ts` — simulate answer-upsert failure and evaluation failure; assert retry returns full submission or re-evaluates, never hollow/pending-dead.

---

## P1 — Branch correctness & security

| # | Finding | Location | Fix |
|---|---------|----------|-----|
| P1.1 | Persistence errors logged but swallowed — 200 "accepted" with no DB record | `artifact-evaluator.ts:671,683,699-700` | Throw after logging for flow/submission/progress upsert failures (idempotent retry makes this safe); keep the documented XP-insert swallow |
| P1.2 | Unbounded aggregate prompt (~900k chars) — silent fallback + token cost | `artifact-evaluator.ts:415-417` | Truncate `fileContentSnippet` (e.g. 20k) + total prompt-size guard before API call |
| P1.3 | `debug_telemetry` persists raw prompt + raw response, returned to client | `artifact-evaluator.ts:572-573`, `evaluation.ts:46` | Strip raw content from telemetry (keep latency/charCount/model); remove `debug_telemetry` from GET response or redact |
| P1.4 | `OPENROUTER_API_KEY` optional + `""` passes schema → silent human_review degradation | `env.ts:32` | `z.string().trim().min(1)`; make required (feature hard-requires it); log degradation at `warn` |
| P1.5 | `fetchEvaluationContext` swallows DB errors silently (no log); levels query unchecked | `evaluation-context.ts:17,25,35,37-41` | Log `warn` on each error branch; check `lvlError` |
| P1.6 | Template fetch accepts `http://` (internal-network fetch risk) | `evaluation-context.ts:112` | Require `https:` prefix |
| P1.7 | Missing test files for new modules | `evaluation-context.ts` (140 lines), `file-validation.ts` | Add `__tests__/evaluation-context.test.ts`, `__tests__/file-validation.test.ts` |
| P1.8 | `ArtifactPanel.tsx` new logic untested | `src/pages/level-content/ui/components/ArtifactPanel.tsx:28-158` | Add `src/__tests__/level-content/components/ArtifactPanel.test.tsx` (mapper branches, selection→query key, `handleSubmitted`) |
| P1.9 | `processAndSaveArtifactEvaluation` untested (XP award, status transitions, P0-1 override) | `artifact-evaluator.ts:599-744` | Add persistence test mocking SupabaseClient: fallback→human_review/0 XP; pass awards by attempt; human_review neutral |
| P1.10 | SPA fallback: `/api%2F...` and `/API/...` get 200 HTML shell; `/manifest.webmanifest` shell; dotted client routes 404 | `functions/[[path]].ts:4,13,24` | Decode+case-fold before `/api` check; tighten asset heuristic (shell only for known route prefixes; 404 for anything file-like) + tests |

---

## P2 — Polish (non-blocking)

- **P2.1** Prompt/rule mismatch: `evidenceFailed → revise_and_resubmit` overrides `confidence<60 → human_review` (`response-schema.ts:126-132` vs prompt lines 293/301). Deliberate per code comment — align prompt text with actual rule order.
- **P2.2** OpenRouter client: centralize retry/timeout in `constants.ts`; exponential backoff + jitter + Retry-After; wrap `response.json()` in try (client.ts:25,28,38,57).
- **P2.3** Duplicated structural caps (50/50/20) — move into `ARTIFACT_LIMITS` and consume in `artifact-extractor.ts` + `file-validation.ts`.
- **P2.4** `esbuild` undeclared in `eval:replay` script → add to devDependencies.
- **P2.5** `scripts/**/*.ts` added to root tsconfig but not `tsconfig.app.json` → typecheck gate misses it.
- **P2.6** Dev/prod seed files byte-identical — production backfill needs review notes/runbook.
- **P2.7** Doc drift: `ARCHITECTURE.md:199` says 15-page cap (code = 50); README references removed `test:property`.
- **P2.8** Hardcoded labels/scale in `ArtifactFeedbackTab.tsx` (project-wide pattern; `/3` display is safe due to `z.literal(3)`).
- **P2.9** Zip-expansion defense-in-depth: post-decompression output cap for pptx/docx in module; declared-sizes forgeability noted (bounded by 25MB body cap).

---

## P3 — Pre-existing issues (NOT branch; separate task, do not block merge)

- **P3.1** Unvalidated `status` body on level/module progress endpoints → completion forgery (`[levelId]/progress.ts:25-33`, `modules/[moduleNo]/progress.ts:26-34`; no DB CHECK constraint on `status`/`module_status`). Add zod enum + CHECK constraints.
- **P3.2** Stage completion not bound to URL `levelId`/`moduleNo` (`stages/progress.ts:70-99`) — bind via modules join, 404 on mismatch.
- **P3.3** `sync-shadow.ts` logs full emails; `shared/logger.ts` doesn't gate levels by environment (logger rename is in-branch — fold hygiene into this branch only if cheap, else backlog).
- **P3.4** Weak route-param schemas (`levelId: z.string().min(1)`, optional `capabilityCode`, unbounded `moduleNo`) in `courses/schemas.ts`.

---

## Execution order

1. P0.1 → P0.2 → P1.1 (data integrity + error handling core)
2. P1.2–P1.6 (boundaries: prompt cap, telemetry, env, context)
3. P1.7–P1.9 (test debt)
4. P1.10, P2 (fallback routing + polish)
5. Run: `npm run typecheck`, `npm run lint`, `npx vitest run --coverage`, `npm run db:reset:dev` (local, after approval), `graphify update .`
