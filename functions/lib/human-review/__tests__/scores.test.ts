import type { QueryGateway } from "@functions/lib/query-gateway";
import { describe, expect, it, vi } from "vitest";
import { REVIEW_CRITERIA } from "../contracts";
import { readStaffRubricRows } from "../scores";

describe("normalized staff rubric read", () => {
  it("passes the verified submission owner and preserves the existing rubric DTO", async () => {
    const rows = REVIEW_CRITERIA.map((c) => ({
      ...c,
      score: 2,
      evidence: "Page 3",
      feedback: "Page 3",
      tone: "success",
    }));
    const rpc = vi.fn().mockResolvedValue(rows);
    expect(
      await readStaffRubricRows({ rpc } as unknown as QueryGateway, "submission", "learner"),
    ).toEqual(rows);
    expect(rpc).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "read_review_criterion_scores" }),
      {
        args: { p_submission_id: "submission", p_learner_id: "learner" },
      },
    );
  });
  it("fails visibly instead of falling back to stale JSON when scores are incomplete", async () => {
    const rpc = vi.fn().mockResolvedValue([]);
    await expect(
      readStaffRubricRows({ rpc } as unknown as QueryGateway, "submission", "learner"),
    ).rejects.toThrow();
  });
});
