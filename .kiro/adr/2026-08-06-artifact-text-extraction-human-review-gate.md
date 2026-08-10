# ADR-006: Artifact Text Extraction Pipeline & Human-Review Gate

**Status**: Accepted
**Date**: 2026-08-06
**Area**: Artifact evaluation (AI engine)

## Context

The artifact evaluation flow graded file-based submissions **without their content**: the
LLM prompt received `fileName` only, so it hallucinated spreadsheet structure (production
evidence: `rawPromptContent` shows `fileContentSnippet: null`, fabricated column names).
Learner files (XLSX per DB, all 40+ questions) must be extracted to text and passed to the
LLM; unreadable files must not be graded blind.

## Decision

- **Extraction in-process** (`functions/lib/ai-engine/artifact-extractor.ts`): SheetJS
  (`xlsx@0.20.3`, CDN-pinned) for xlsx/xls/csv, `pdfjs-dist` legacy for PDF, `mammoth` for
  DOCX, `TextDecoder` for txt/md. Caps: 50,000 chars total (hard `slice` + truncated
  marker), 15 PDF pages, 20 sheets, 2,000 rows × 256 cols per sheet. Parsers load via
  dynamic `import()` so only the submit path pays bundle weight.
- **Deterministic assessability gate** (pre-LLM, in `artifact-evaluator.ts`): any
  file answer without extracted content → `human_review` with score 0, `modelUsed:
  "file-extraction-gate"`, **no LLM call**, **no XP event** (neutral — a pending review is
  not a failure). Fallback engine now also requires a real snippet (≥10 chars), not a
  filename.
- **Prompt construction** (P1): `instructions` (the actual grading criteria JSON from
  `artifact_questions`) forwarded per question; learner content wrapped in isolation
  delimiters; system prompt declares content untrusted data and evidence-only scoring;
  caps (`fileName` 255, `textResponse` 20k); `max_tokens: 4096`.
- **Telemetry**: `debug_telemetry` persisted in `artifact_evaluation_flows.metadata`
  (provider, latencyMs, modelUsed, rawPromptContent, rawResponseContent, validatedDecision,
  wasDecisionOverridden, extractionCharCounts, promptCharCount) — backported to match the
  production shape; exposed via the evaluation endpoint; retention bounded by TRD §9.6
  (30-day purge), unchanged.
- **OpenRouter hardening**: `AbortSignal.timeout(30_000)` + one retry on 5xx/429/network
  failure; 4xx fails fast.

## Consequences

- Unreadable/scanned/image submissions route to `human_review` (user-visible behavior
  change — no more blind grading or name-only passes).
- `human_review` submissions are stored and visible but not consumed: no reviewer
  endpoint/UI exists (`evaluateFallback` in `xp-engine.ts` has zero callers). Logged and
  tracked separately — reviewer workflow is out of scope.
- Parser attack surface bounded by the existing 10 MB upload cap + page/row/sheet caps;
  xlsx bumped 0.18.5 → 0.20.3 (CVE fixes).
- Extracted content (may contain PII) enters prompts/metadata — governed by the existing
  30-day metadata retention; never logged at `info` level.

## Alternatives Considered

- **Pandoc sidecar**: rejected — cannot run in Workers; no XLSX input; would require a
  container.
- **Client-side extraction**: rejected — grading must be server-side; frontend upload only.
- **DB column for extracted text**: rejected — no schema change; content lives in memory +
  metadata JSONB only.
- **Vision/OCR (multimodal)**: rejected (D2) — no Workers AI; images and scanned PDFs →
  `human_review`.
