# Artifact Evaluation Audit & Fix Log

**Date**: 2026-08-06
**Scope**: Post-P1 deep audit (4 subagents + direct verification) of the artifact extraction/evaluation pipeline, and the P2 remediation that followed.
**Related**: `.kiro/plans/2026-08-06_artifact-content-extraction-fix_plan.md`, `.kiro/adr/2026-08-06-artifact-text-extraction-human-review-gate.md`

---

## 1. Audit Findings

### 1.1 Bugs Fixed (P2)

| # | Finding | Evidence | Fix |
|---|---------|----------|-----|
| 1 | **Scanned/image-only PDFs bypass the human-review gate.** `parsePdf` pushed `[Page N]` markers even for empty pages, so an image-only PDF became `"[Page 1]"` — assessable garbage. | `artifact-extractor.ts:73` | Skip pages whose text line is empty; empty-pages-only PDFs now return `isReadable: false` → gate routes to `human_review`. Test added: "marks scanned/image-only pdfs as unreadable". |
| 2 | **`calculatedXp` mismatch for LLM-returned `human_review`.** Telemetry/metadata recorded `calculatedXp: 1` (failure XP) while the award path correctly granted 0. | audit of LLM path in `artifact-evaluator.ts` | `calculatedXp` is now `0` for `human_review` (neutral), matching the XP guard. Test added: "treats LLM-returned human_review as XP-neutral". |
| 3 | **`awardXp` failure → 500 to learner after evaluation was already persisted.** Non-23505 errors rethrew out of `processAndSaveArtifactEvaluation`. | `artifact-evaluator.ts` step 4 | Wrapped in try/catch: log + let the idempotent upsert retry; learner still gets their result. |
| 4 | **Silent module-progress update failure.** The `update(user_module_progress)` result was discarded while every other step logs. | `artifact-evaluator.ts` step 3 | Error is now captured and logged. |
| 5 | **Gate keyed on `answers[].fileName`, not `questions[].responseType`** (plan deviation). A stray upload without a matching file question passed the gate. Masked today only by required-question 400s. | `checkArtifactAssessability` | Gate now iterates file-typed `questions`, looks up each answer by `questionId`, and flags missing/empty content. |
| 6 | **windows-1252 (latin1) text fallback unimplemented** — explicit plan item. Loose utf-8 decoding turned latin1 files into U+FFFD garbage. | `parseText` | Strict `utf-8` (`fatal: true`) decode; on failure, `windows-1252` decode (plus BOM strips for both). Test added. |
| 7 | **Truncation warning log missing** (plan nit); marker constant was a literal `50_000`. | `finish()` | `apiLogger.warn` on cap hit; `TRUNCATION_MARKER` already a constant, cap referenced by name. |

### 1.2 Pre-Existing Issues Fixed (P3)

| # | Finding | Evidence | Fix |
|---|---------|----------|-----|
| 8 | `getSubmittedFilesByArtifactId` filtered `status="submitted"`, but the evaluator mutates status immediately → **file list empty after refresh**. | `artifact-helpers.ts:90` | Filter is now `status IN (submitted, resubmission_required, human_review)`. |
| 9 | **Frontend type drift**: `submitArtifact.ts` status/decision unions missed `human_review` (runtime-safe only via `DECISION_META` fallback). | `src/features/submit-artifact/api/submitArtifact.ts` | Unions now include `"human_review"`. |
| 10 | `wrangler.toml` `pages_build_output_dir = "build"` but Vite outputs `dist` → **deploy would serve an empty site**. | `wrangler.toml`, `vite.config.ts` | Changed to `"dist"`. |
| 11 | Static `import * as XLSX from "xlsx/xlsx.mjs"` — SheetJS executed at worker startup; part of the 7.4 MB flattened single chunk. | `artifact-extractor.ts:1` | Removed; dynamic `import("xlsx/xlsx.mjs")` inside `parseSpreadsheet`, mirroring the mammoth pattern. |
| 12 | **Empty/bogus xlsx marked readable.** SheetJS `read()` on empty bytes returns a phantom `Sheet1` (with `!ref: "A1"`), so an empty file extracted as a header-only `--- Sheet: Sheet1 ---` string. Caught by the new empty-file test. | `parseSpreadsheet` | Sheets whose `sheet_to_csv` output is empty are skipped — header-only markers never count as content. |
| 13 | **pdfjs fake-worker bleed (test env only).** In the vitest environment, a corrupt PDF processed after a valid one resolves with the *previous* document's content (deterministic cross-document bleed through the shared fake worker). In plain Node the corrupt input throws ("Invalid PDF structure" / "Cannot transfer object of unsupported type") → caught → unreadable, so production semantics are safe — but this must be re-verified under `wrangler dev`. | `artifact-extractor.test.ts` | Corrupt-PDF test moved first in the pdf group with a comment; `loadingTask.destroy()` was already in place. Deploy-time `wrangler dev` check added to open items. |

### 1.3 Test Gaps Closed

- Extractor: scanned PDF (empty pages → unreadable), windows-1252 fallback, **empty file (caught bug #12)**, password-protected workbook (OLE magic → unreadable), multi-sheet separators, hidden sheets included (per plan's `SheetNames` iteration), multi-page PDF markers, PDF 15-page cap, corrupt PDF (order-pinned for the fake-worker artifact), xlsx-path truncation. (Note: the audit's "marker hardcodes 50000" nit was a false alarm — `TRUNCATION_MARKER` interpolates `ARTIFACT_TEXT_CAP` at `artifact-extractor.ts:16`; the missing warning log was the real part and is fixed.)
- Evaluator: LLM-returned `human_review` → `calculatedXp: 0` + telemetry alignment; hallucinated-pass override (`wasDecisionOverridden`); LLM-throw → deterministic fallback; LLM-returned `revise_and_resubmit` flow; 20k `textResponse` + 255 `fileName` prompt caps.
- OpenRouter client: `data.error` body branch, 30s timeout value, persistent-5xx retry exhaustion.
- Submit flow: `debug_telemetry` persistence into `artifact_evaluation_flows.metadata` (asserted on the human_review path).

### 1.4 Verified Correct (No Action)

- Gate runs before the `OPENROUTER_API_KEY` check; no LLM call on the gate path.
- Fallback requires snippet ≥ 10 chars. Status semantics (`accepted`/`human_review`/`resubmission_required`, `sealed_at` only on pass). Ownership checks on evaluation endpoint + file download.
- 13/13 `debug_telemetry` keys match production rows (e.g. 2026-08-06T12:01:16Z submission, model `google/gemini-2.5-flash`, latencyMs 7483).
- `eval(obj)` in the bundle is dead code (bluebird `util.js:201`, after `return obj;`); `new Function` sites are lazy and never hit by the mammoth extraction path. `enable_unsafe_eval` not needed.
- No `node:fs` in bundle; no info-level content logging.

### 1.5 Open Items (Not Yet Decided)

- **Telemetry exposure (RESOLVED 2026-08-07)**: decision taken — store the exact `messages` array (system prompt + user message) as `rawPromptContent` so the AI Inspector tab shows the full input passed to the LLM. Rubric/grading key is therefore learner-visible; accepted tradeoff. Catch path also captures `rawPromptContent`/`promptCharCount` (failed LLM calls show the attempted input).
- `request.formData()` reads the body once — real-multipart behavior not yet validated under `wrangler dev`.
- Bundle size (7.4 MB single functions chunk, dynamic imports flattened) still pending the deploy-time optimization.
- pdfjs corrupt-PDF behavior under the Workers runtime (Node throws → unreadable; vitest fake worker bleeds) must be confirmed in `wrangler dev`.

---

## 2. Fix Log

| File | Change |
|------|--------|
| `functions/lib/ai-engine/artifact-extractor.ts` | Static XLSX import → dynamic; empty-page PDF skip; strict utf-8 → windows-1252 fallback; truncation `apiLogger.warn`. |
| `functions/lib/ai-engine/artifact-evaluator.ts` | `calculatedXp: 0` for `human_review`; LLM-completed info log (latency/prompt chars); `awardXp` try/catch; module-progress error log; questions-based gate. |
| `functions/api/v1/courses/artifact-helpers.ts` | `status` filter widened to `IN (submitted, resubmission_required, human_review)`. |
| `src/features/submit-artifact/api/submitArtifact.ts` | `status` and `decision` unions gain `"human_review"`. |
| `wrangler.toml` | `pages_build_output_dir` → `"dist"`. |
| `functions/lib/ai-engine/__tests__/artifact-extractor.test.ts` | `buildPdfFileFromPageContents` helper; scanned-PDF test; windows-1252 test. |
| `functions/lib/ai-engine/__tests__/artifact-evaluator.test.ts` | LLM human_review XP-neutrality, override, throw→fallback, LLM-revise, and 20k/255 prompt-cap tests. |
| `functions/lib/openrouter/__tests__/client.test.ts` | `data.error` branch, 30s timeout value, persistent-5xx exhaustion tests. |
| `functions/api/v1/artifacts/__tests__/queries.test.ts` | `debug_telemetry` persistence assert on the human_review flow. |

---

## 3. Verification

- **Unit/integration**: `npm run test:ci` — **108 files / 867 passed / 1 skipped** (859 before this round; +8 extractor tests incl. the empty-file test that caught bug #12, minus 1 duplicate removed).
- **Typecheck**: `tsc --noEmit -p tsconfig.app.json` — clean.
- **Lint**: `npm run lint:biome` — clean (410 files); `npm run lint` (eslint + stylelint) — clean.
- **Coverage (re-run)**: All files 89.34% stmts / 79.48% branch / 87% funcs / 90.5% lines; ai-engine 99.39% lines; openrouter 100%.
- **Production sanity**: P1 verification #2 already passed against real prod data (13-key telemetry, instruction forwarding, delimiters, gate scoring blank register 0). No schema change in P2 — safe to deploy.
