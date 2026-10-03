import type { ReviewAssignment } from "@functions/lib/human-review/service";
import { projectEvaluationReference } from "@functions/lib/human-review/stages";
import type { QueryGateway } from "@functions/lib/query-gateway";

export async function getReviewDetail(qb: QueryGateway, review: ReviewAssignment) {
  const submission = (await qb.read(
    {
      table: "artifact_submissions",
      operation: "read",
      columns: ["id", "artifact_id", "user_id", "attempt_no", "submitted_at", "status"],
      filters: ["id"],
    },
    {
      filters: [{ column: "id", op: "eq", value: review.submission_id }],
      result: "single",
    },
  )) as { artifact_id: string };
  const [questions, answers, files, evaluations, learner, templates] = await Promise.all([
    qb.read(
      {
        table: "artifact_questions",
        operation: "read",
        columns: ["id", "title", "description", "instructions", "response_type"],
        filters: ["artifact_id"],
        maxPageSize: 100,
      },
      { filters: [{ column: "artifact_id", op: "eq", value: submission.artifact_id }] },
    ),
    qb.read(
      {
        table: "artifact_submission_answers",
        operation: "read",
        columns: ["question_id", "text_response", "url_response"],
        filters: ["submission_id"],
        maxPageSize: 100,
      },
      { filters: [{ column: "submission_id", op: "eq", value: review.submission_id }] },
    ),
    qb.read(
      {
        table: "artifact_submission_files",
        operation: "read",
        columns: ["id", "question_id", "file_name", "file_type", "file_size_bytes"],
        filters: ["submission_id"],
        maxPageSize: 100,
      },
      { filters: [{ column: "submission_id", op: "eq", value: review.submission_id }] },
    ),
    qb.read(
      {
        table: "artifact_evaluation_flows",
        operation: "read",
        columns: [
          "stage",
          "score",
          "decision",
          "feedback",
          "improvements",
          "completed_at",
          "metadata",
        ],
        filters: ["submission_id"],
        sorts: ["stage_order"],
      },
      {
        filters: [{ column: "submission_id", op: "eq", value: review.submission_id }],
        sort: [{ column: "stage_order", ascending: true }],
      },
    ),
    qb.read(
      { table: "users", operation: "read", columns: ["first_name", "last_name"], filters: ["id"] },
      { filters: [{ column: "id", op: "eq", value: review.learner_id }], result: "single" },
    ),
    qb.read(
      {
        table: "artifact_templates",
        operation: "read",
        columns: ["id", "question_id", "file_name", "file_url", "version"],
        filters: ["artifact_id"],
        maxPageSize: 100,
      },
      { filters: [{ column: "artifact_id", op: "eq", value: submission.artifact_id }] },
    ),
  ]);
  return {
    review,
    submission,
    questions,
    answers,
    files,
    evaluations: (evaluations as Array<Record<string, unknown>>).map(projectEvaluationReference),
    learner,
    templates,
  };
}
