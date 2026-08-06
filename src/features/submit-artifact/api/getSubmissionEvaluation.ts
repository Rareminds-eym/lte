import { apiFetch } from "@/shared/api";

export interface SubmissionEvaluationResponse {
  success: true;
  evaluation: {
    id: string;
    submission_id: string;
    stage: string;
    status: string;
    score: number | null;
    decision: "pass" | "fail" | null;
    feedback: string | null;
    improvements: string | null;
    completed_at: string | null;
    rubric_rows: Array<{
      label: string;
      score: number;
      maxScore: number;
      tone: "success" | "warning" | "error";
      feedback?: string;
    }>;
    calculated_xp: number;
  } | null;
}

export async function getSubmissionEvaluation(
  submissionId: string,
): Promise<SubmissionEvaluationResponse> {
  return apiFetch<SubmissionEvaluationResponse>(
    `/api/v1/artifacts/submissions/${encodeURIComponent(submissionId)}/evaluation`,
  );
}
