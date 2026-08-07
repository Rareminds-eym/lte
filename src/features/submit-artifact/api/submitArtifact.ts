import { apiFetch } from "@/shared/api";

export interface ArtifactAnswerInput {
  questionId: string;
  textResponse?: string;
  urlResponse?: string;
  file?: File | null;
}

export interface SubmitArtifactInput {
  artifactId: string;
  answers: ArtifactAnswerInput[];
}

export interface SubmitArtifactResponse {
  success: true;
  submission_id: string;
  attempt_no: number;
  version_label: string;
  submitted_at: string | null;
  status: "submitted" | "accepted" | "resubmission_required" | "human_review";
  evaluation_status: "pending" | "completed";
  evaluation?: {
    overall_score: number;
    decision: "pass" | "fail" | "human_review";
    rubric_rows: Array<{
      label: string;
      score: number;
      maxScore: number;
      tone: "success" | "warning" | "error";
      feedback?: string;
    }>;
    feedback: string;
    improvements: string;
    calculated_xp: number;
  };
  files: Array<{
    file_id: string;
    question_id: string;
    file_name: string;
  }>;
}

export async function submitArtifact(input: SubmitArtifactInput): Promise<SubmitArtifactResponse> {
  const formData = new FormData();
  formData.set(
    "payload",
    JSON.stringify({
      artifact_id: input.artifactId,
      answers: input.answers.map((answer) => ({
        question_id: answer.questionId,
        text_response: answer.textResponse || undefined,
        url_response: answer.urlResponse || undefined,
      })),
    }),
  );

  for (const answer of input.answers) {
    if (answer.file) {
      formData.set(`file:${answer.questionId}`, answer.file);
    }
  }

  return apiFetch<SubmitArtifactResponse>("/api/v1/artifacts/submit", {
    method: "POST",
    body: formData,
  });
}
