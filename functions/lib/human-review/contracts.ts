import { LTE_CRITERIA_LABELS } from "@functions/lib/artifact-evaluator/response-schema";
import { z } from "zod";

export const REVIEW_CRITERIA = [
  { id: "completeness", label: LTE_CRITERIA_LABELS[0], maxScore: 3 },
  { id: "accuracy", label: LTE_CRITERIA_LABELS[1], maxScore: 3 },
  { id: "evidence-use", label: LTE_CRITERIA_LABELS[2], maxScore: 3 },
  { id: "judgement", label: LTE_CRITERIA_LABELS[3], maxScore: 3 },
  { id: "next-action", label: LTE_CRITERIA_LABELS[4], maxScore: 3 },
] as const;

const criterionId = z.enum([
  "completeness",
  "accuracy",
  "evidence-use",
  "judgement",
  "next-action",
]);
export const completionSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    decision: z.enum(["pass", "revise_and_resubmit"]),
    criteria: z
      .array(
        z
          .object({
            id: criterionId,
            score: z.number().int().min(0).max(3),
            evidence: z.string().trim().max(4000),
          })
          .strict(),
      )
      .length(5),
    feedback: z.string().trim().min(1).max(10000),
    actionItems: z.array(z.string().trim().min(1).max(1000)).max(20),
    rationale: z.string().trim().min(1).max(4000),
    hasCriticalFailure: z.boolean(),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.criteria.map((row) => row.id)).size !== 5) {
      context.addIssue({
        code: "custom",
        path: ["criteria"],
        message: "Score each criterion exactly once.",
      });
    }
    if (
      value.decision === "pass" &&
      (value.hasCriticalFailure || value.criteria.some((row) => row.score < 2 || !row.evidence))
    ) {
      context.addIssue({
        code: "custom",
        path: ["decision"],
        message:
          "Pass requires evidence and scores of at least 2 for every criterion, without a critical failure.",
      });
    }
    if (value.decision === "revise_and_resubmit" && value.actionItems.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["actionItems"],
        message: "Revision requires at least one action item.",
      });
    }
  });
export type CompletionCommand = z.infer<typeof completionSchema>;
export const startSchema = z.object({ expectedVersion: z.number().int().positive() }).strict();
export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[\x21-\x7e]+$/);
export const reviewScopeSchema = z.object({
  scopeId: z.uuid(),
  organizationId: z.uuid(),
  scopeType: z.enum(["college_program", "school_class"]),
  enabled: z.boolean(),
  slaDays: z.number().int().min(1).max(30),
  timeZone: z.string().min(1).max(100),
  loadCap: z.number().int().min(1).max(100),
  threshold: z.number().min(0).max(100),
  reviewerIds: z.array(z.uuid()).max(100),
});
export type ReviewScope = z.infer<typeof reviewScopeSchema>;

export function normalizeCompletion(command: CompletionCommand) {
  const criteria = REVIEW_CRITERIA.map((criterion) => {
    const row = command.criteria.find((item) => item.id === criterion.id);
    if (!row) throw new Error("Missing required criterion");
    return {
      ...row,
      feedback: row.evidence,
      label: criterion.label,
      maxScore: criterion.maxScore,
      tone: row.score >= 2 ? "success" : row.score === 0 ? "error" : "warning",
    };
  });
  return {
    ...command,
    criteria,
    score: Math.round((criteria.reduce((sum, row) => sum + row.score, 0) / 15) * 100),
  };
}

/** Stable canonical command order makes a retry insensitive to criterion ordering. */
export async function completionHash(command: CompletionCommand): Promise<string> {
  const normalized = normalizeCompletion(command);
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(normalized)),
  );
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
