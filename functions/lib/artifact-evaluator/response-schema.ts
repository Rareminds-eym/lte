import { z } from "zod";
import type { ArtifactEvaluationInput, LteDecisionResult, RubricCriterionResult } from "./types";

/** Confidence below this value routes the submission to human review (Part 6). */
export const MIN_AI_CONFIDENCE = 60;

export const LTE_CRITERIA_LABELS = [
  "Completeness",
  "Accuracy",
  "Evidence use",
  "Judgement",
  "Next action",
] as const;

export const LTE_PERFORMANCE_LEVELS = [
  "Not demonstrated",
  "Partially demonstrated",
  "Demonstrated",
  "Strongly demonstrated",
] as const;

const rubricRowSchema = z.object({
  label: z.enum(LTE_CRITERIA_LABELS),
  score: z.number().int().min(0).max(3),
  maxScore: z.literal(3),
  level: z.enum(LTE_PERFORMANCE_LEVELS),
  evidence: z.string(),
  tone: z.enum(["success", "warning", "error"]),
  feedback: z.string().optional(),
});

/**
 * Strict schema for the LLM response (Part 5). Unknown keys are stripped;
 * every declared field is validated. Any violation triggers the deterministic
 * fallback, never partial acceptance.
 */
export const AI_RESPONSE_SCHEMA = z.object({
  overallScore: z.number().min(0).max(100),
  confidence: z.number().min(0).max(100),
  decision: z.enum(["pass", "revise_and_resubmit", "human_review"]),
  stage1SubmissionCheck: z.object({ isAssessable: z.boolean(), notes: z.string() }),
  stage2CriticalFailures: z.object({ hasFailure: z.boolean(), failuresFound: z.array(z.string()) }),
  rubricRows: z
    .array(rubricRowSchema)
    .length(5)
    .refine((rows) => new Set(rows.map((r) => r.label)).size === 5, {
      message: "rubric rows must cover all five criteria exactly once",
    }),
  feedback: z.string(),
  singleImprovementPoint: z.string(),
});

export type ParsedAIResponse = z.infer<typeof AI_RESPONSE_SCHEMA>;
export type ParsedRubricRow = z.infer<typeof rubricRowSchema>;

/**
 * Recalculates overallScore from rubric rows (Part 3). Model arithmetic is
 * never trusted; the caller always overwrites with this value.
 */
export function recomputeOverallScore(rows: RubricCriterionResult[]): number {
  const sum = rows.reduce((acc, row) => acc + row.score, 0);
  return Math.round((sum / 15) * 100);
}

const BANNED_EVIDENCE = new Set(["", "e", "n/a", "na", "none"]);

/**
 * Verifies every rubric row's evidence against the submission (Part 4):
 * the exact string must appear verbatim inside a textResponse or
 * fileContentSnippet. Unverifiable rows are blanked, zeroed and flagged.
 */
export function validateRubricEvidence(
  rows: ParsedRubricRow[],
  answers: ArtifactEvaluationInput["answers"],
): { rows: RubricCriterionResult[]; failed: boolean } {
  const haystacks = answers.flatMap((a) => [a.textResponse ?? "", a.fileContentSnippet ?? ""]);
  let failed = false;

  const validated = rows.map((row) => {
    const evidence = row.evidence ?? "";
    const normalized = evidence.trim().toLowerCase();
    const isBanned = BANNED_EVIDENCE.has(normalized);
    const isVerbatim = !isBanned && haystacks.some((h) => h.includes(evidence));
    if (!isVerbatim) {
      failed = true;
      return { ...row, evidence: "", score: 0, evidenceValid: false } as RubricCriterionResult;
    }
    return { ...row, evidenceValid: true } as RubricCriterionResult;
  });

  return { rows: validated, failed };
}

/**
 * Deterministic tone from score (prompt-defined mapping):
 * 0 -> "error", 1 -> "warning", >=2 -> "success". Model tone is discarded.
 */
export function deriveTone(score: number): "success" | "warning" | "error" {
  if (score === 0) return "error";
  if (score === 1) return "warning";
  return "success";
}

/**
 * Backend is the source of truth for the decision (Part 6). Rules are applied
 * in spec order; later rules override earlier ones:
 * score<2 -> revise; critical -> revise; confidence<60 -> human_review;
 * unassessable -> human_review; evidence-failed -> revise.
 */
export function enforceValidatedDecision(params: {
  llmDecision: LteDecisionResult;
  confidence: number;
  evidenceFailed: boolean;
  hasCriticalFailure: boolean;
  hasSubparCriterion: boolean;
  isAssessable: boolean;
}): LteDecisionResult {
  let decision = params.llmDecision;
  if (params.hasSubparCriterion) decision = "revise_and_resubmit";
  if (params.hasCriticalFailure) decision = "revise_and_resubmit";
  if (params.confidence < MIN_AI_CONFIDENCE) decision = "human_review";
  if (!params.isAssessable) decision = "human_review";
  if (params.evidenceFailed) decision = "revise_and_resubmit";
  return decision;
}
