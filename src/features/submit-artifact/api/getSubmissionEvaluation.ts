import { z } from "zod";
import { apiFetch } from "@/shared/api";

export const EvaluationStageSchema = z.object({
  stage: z.string(),
  status: z.string(),
  score: z.number().nullable(),
  decision: z.string().nullable(),
  feedback: z.string().nullable(),
  improvements: z.string().nullable(),
  completed_at: z.string().nullable(),
  evaluated_by: z.string().nullable(),
  due_by: z.string().nullable().optional(),
});
export type EvaluationStage = z.infer<typeof EvaluationStageSchema>;
export const SubmissionEvaluationResponseSchema = z.object({
  success: z.literal(true),
  stages: z.array(EvaluationStageSchema).optional(),
  evaluation: z
    .object({
      id: z.string(),
      submission_id: z.string(),
      stage: z.string(),
      status: z.string(),
      score: z.number().nullable(),
      confidence: z.number().nullable(),
      decision: z.enum(["pass", "revise_and_resubmit", "human_review"]).nullable(),
      feedback: z.string().nullable(),
      improvements: z.string().nullable(),
      completed_at: z.string().nullable(),
      rubric_rows: z.array(
        z.object({
          label: z.string(),
          score: z.number(),
          maxScore: z.number(),
          tone: z.enum(["success", "warning", "error"]),
          feedback: z.string().optional(),
        }),
      ),
      calculated_xp: z.number(),
      debug_telemetry: z.unknown().optional(),
    })
    .nullable(),
});
export type SubmissionEvaluationResponse = z.infer<typeof SubmissionEvaluationResponseSchema>;
export async function getSubmissionEvaluation(
  submissionId: string,
  signal?: AbortSignal,
): Promise<SubmissionEvaluationResponse> {
  const path = `/api/v1/artifacts/submissions/${encodeURIComponent(submissionId)}/evaluation`;
  const raw = signal ? await apiFetch(path, { signal }) : await apiFetch(path);
  return SubmissionEvaluationResponseSchema.parse(raw);
}
