import type { QueryGateway } from "@functions/lib/query-gateway";
import { describe, expect, it, vi } from "vitest";
import { getEvaluationStages } from "../stages";

describe("learner review stage projection", () => {
  it("shows staff backlog while assignment reconciliation is pending", async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce([{ stage: "ai", status: "completed", decision: "human_review" }])
      .mockResolvedValueOnce(null);
    const stages = await getEvaluationStages(
      { read } as unknown as QueryGateway,
      "submission",
      "learner",
    );
    expect(stages).toContainEqual(
      expect.objectContaining({ stage: "staff_review", status: "unassigned", evaluated_by: null }),
    );
  });
  it("preserves AI reference feedback without leaking internal metadata", async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce([
        {
          stage: "ai",
          status: "completed",
          decision: "human_review",
          feedback: "Awaiting staff",
          metadata: {
            internal: "private",
            ai_reference: { decision: "pass", score: 80, feedback: "Original AI explanation" },
          },
        },
      ])
      .mockResolvedValueOnce({ status: "pending", reviewer_id: "reviewer", due_by: null });
    const stages = await getEvaluationStages(
      { read } as unknown as QueryGateway,
      "submission",
      "learner",
    );
    expect(stages[0]).toMatchObject({
      decision: "pass",
      score: 80,
      feedback: "Original AI explanation",
    });
    expect(stages[0]).not.toHaveProperty("metadata");
    expect(stages[1]).toMatchObject({ stage: "staff_review", status: "pending" });
  });
});
