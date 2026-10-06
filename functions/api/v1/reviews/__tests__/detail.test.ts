import type { ReviewAssignment } from "@functions/lib/human-review/service";
import type { QueryGateway } from "@functions/lib/query-gateway";
import { describe, expect, it, vi } from "vitest";
import { getReviewDetail } from "../queries";

describe("educator evaluation reference", () => {
  it("returns original AI feedback and staff outcome without internal metadata", async () => {
    const read = vi.fn(async (policy: { table: string }) => {
      if (policy.table === "artifact_submissions") return { artifact_id: "artifact" };
      if (policy.table === "users") return { first_name: "Learner" };
      if (policy.table === "artifact_evaluation_flows")
        return [
          {
            stage: "ai",
            decision: "human_review",
            score: 0,
            feedback: "Awaiting staff",
            metadata: {
              ai_reference: { decision: "pass", score: 80, feedback: "Original explanation" },
              internal: "private",
            },
          },
          {
            stage: "staff_review",
            decision: "revise_and_resubmit",
            score: 40,
            feedback: "Provide evidence",
            metadata: { rationale: "private" },
          },
        ];
      return [];
    });
    const result = await getReviewDetail(
      { read } as unknown as QueryGateway,
      { submission_id: "submission", learner_id: "learner" } as ReviewAssignment,
    );
    expect(result.evaluations).toEqual([
      { stage: "ai", decision: "pass", score: 80, feedback: "Original explanation" },
      {
        stage: "staff_review",
        decision: "revise_and_resubmit",
        score: 40,
        feedback: "Provide evidence",
      },
    ]);
  });

  it("does not show educators a fake AI result for a human-review-only submission", async () => {
    const read = vi.fn(async (policy: { table: string }) => {
      if (policy.table === "artifact_submissions") return { artifact_id: "artifact" };
      if (policy.table === "users") return { first_name: "Learner" };
      if (policy.table === "artifact_evaluation_flows")
        return [
          {
            stage: "ai",
            decision: "human_review",
            score: 0,
            feedback: "Your artifact is awaiting staff review.",
            metadata: { evaluation_source: "human_only", provider: "none" },
          },
        ];
      return [];
    });
    const result = await getReviewDetail(
      { read } as unknown as QueryGateway,
      { submission_id: "submission", learner_id: "learner" } as ReviewAssignment,
    );
    expect(result.evaluations).toEqual([]);
  });
});
