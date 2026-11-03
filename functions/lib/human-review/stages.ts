import type { QueryGateway } from "@functions/lib/query-gateway";
import { assignmentPolicy } from "./service";

/** Caller must first verify learner ownership of the submission. */
export async function getEvaluationStages(
  qb: QueryGateway,
  submissionId: string,
  learnerId: string,
) {
  const [flows, assignment] = await Promise.all([
    qb.read(
      {
        table: "artifact_evaluation_flows",
        operation: "read",
        columns: [
          "stage",
          "status",
          "score",
          "decision",
          "feedback",
          "improvements",
          "completed_at",
          "evaluated_by",
          "metadata",
        ],
        filters: ["submission_id"],
        sorts: ["stage_order"],
      },
      {
        filters: [{ column: "submission_id", op: "eq", value: submissionId }],
        sort: [{ column: "stage_order", ascending: true }],
      },
    ),
    qb.read(assignmentPolicy, {
      filters: [
        { column: "submission_id", op: "eq", value: submissionId },
        { column: "learner_id", op: "eq", value: learnerId },
      ],
      result: "maybeSingle",
    }),
  ]);
  const stages = flows as Array<Record<string, unknown>>;
  const review = assignment as {
    status: string;
    reviewer_id: string | null;
    due_by: string | null;
  } | null;
  if (
    (review || stages.some((stage) => stage["decision"] === "human_review")) &&
    !stages.some((stage) => stage["stage"] === "staff_review")
  ) {
    stages.push({
      stage: "staff_review",
      status: review?.status ?? "unassigned",
      score: null,
      decision: null,
      feedback: null,
      improvements: null,
      completed_at: null,
      evaluated_by: review?.reviewer_id ?? null,
      due_by: review?.due_by ?? null,
    });
  }
  // A human-review-only scope never ran the AI. Its placeholder "ai" row must
  // not be shown to the learner as a completed AI review.
  return stages.filter((stage) => !isHumanOnlyPlaceholder(stage)).map(projectEvaluationReference);
}

export function isHumanOnlyPlaceholder(stage: Record<string, unknown>) {
  const metadata = stage["metadata"];
  return (
    stage["stage"] === "ai" &&
    !!metadata &&
    typeof metadata === "object" &&
    (metadata as Record<string, unknown>)["evaluation_source"] === "human_only"
  );
}

/** Expose only reference fields, never evaluator metadata or internal telemetry. */
export function projectEvaluationReference(stage: Record<string, unknown>) {
  const { metadata, ...visible } = stage;
  const reference =
    metadata && typeof metadata === "object" && "ai_reference" in metadata
      ? metadata.ai_reference
      : null;
  if (visible["stage"] === "ai" && reference && typeof reference === "object") {
    const value = reference as Record<string, unknown>;
    return {
      ...visible,
      feedback: typeof value["feedback"] === "string" ? value["feedback"] : visible["feedback"],
      score: typeof value["score"] === "number" ? value["score"] : visible["score"],
      decision: typeof value["decision"] === "string" ? value["decision"] : visible["decision"],
    };
  }
  return visible;
}
