import { REVIEW_CRITERIA } from "@functions/lib/human-review/contracts";
import type { QueryGateway } from "@functions/lib/query-gateway";
import { describe, expect, it, vi } from "vitest";
import { getSubmissionEvaluationFlow } from "../queries";

function fixture() {
  const rows = REVIEW_CRITERIA.map((c) => ({
    ...c,
    score: 2,
    evidence: "Evidence",
    feedback: "Evidence",
    tone: "success",
  }));
  const gateway = {
    read: vi
      .fn()
      .mockResolvedValueOnce({ id: "submission" })
      .mockResolvedValueOnce({
        id: "flow",
        stage: "staff_review",
        metadata: { rubric_rows: [{ stale: true }], calculated_xp: 20 },
      }),
    rpc: vi.fn().mockResolvedValue(rows),
    insert: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  };
  return { gateway, rows };
}
describe("staff evaluation ownership and normalized data", () => {
  it("uses relational scores instead of the historical JSON snapshot", async () => {
    const { gateway, rows } = fixture();
    const flow = await getSubmissionEvaluationFlow(
      gateway as unknown as QueryGateway,
      "submission",
      "learner",
    );
    expect(flow?.metadata).toEqual({ rubric_rows: rows, calculated_xp: 20 });
    expect(gateway.read).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({ auth: { userId: "learner" } }),
    );
    expect(gateway.rpc).toHaveBeenCalledWith(expect.anything(), {
      args: { p_submission_id: "submission", p_learner_id: "learner" },
    });
  });
  it("does not read scores when ownership lookup rejects the submission", async () => {
    const { gateway } = fixture();
    gateway.read.mockReset().mockResolvedValue(null);
    await expect(
      getSubmissionEvaluationFlow(gateway as unknown as QueryGateway, "submission", "other"),
    ).rejects.toMatchObject({ status: 404 });
    expect(gateway.rpc).not.toHaveBeenCalled();
  });
});
