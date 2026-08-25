import { beforeEach, describe, expect, it } from "vitest";
import { evaluateArtifact, evaluateFallback } from "../xp-engine";
import { mockInsert, mockSingle, mockSupabase, resetMocks } from "./xpEngine.helpers";

describe("XP Engine Core logic", () => {
  beforeEach(() => {
    resetMocks();
  });

  describe("evaluateArtifact", () => {
    it("should award tiered XP for final artifact pass (Attempt 1: +20)", async () => {
      // Mock evaluation flow lookup (decision: 'pass')
      mockSingle.mockReturnValueOnce({
        data: { decision: "pass", evaluated_by: null },
        error: null,
      });

      // Mock submission lookup
      mockSingle.mockReturnValueOnce({
        data: {
          id: "sub-1",
          artifact_id: "art-1",
          user_id: "user-1",
          attempt_no: 1,
          user_module_progress_id: "mod-progress-1",
          module_artifacts: {
            id: "art-1",
            artifact_type: "final",
          },
        },
        error: null,
      });

      // Mock awardXp insert
      mockInsert.mockReturnValueOnce({ error: null });

      const result = await evaluateArtifact(mockSupabase, "sub-1");

      expect(result.success).toBe(true);
      expect(result.evidenceXpAwarded).toBe(20);
    });

    it("should award tiered XP for final artifact pass (Attempt 2: +15)", async () => {
      mockSingle.mockReturnValueOnce({
        data: { decision: "pass", evaluated_by: null },
        error: null,
      });

      mockSingle.mockReturnValueOnce({
        data: {
          id: "sub-1",
          artifact_id: "art-1",
          user_id: "user-1",
          attempt_no: 2,
          user_module_progress_id: "mod-progress-1",
          module_artifacts: {
            id: "art-1",
            artifact_type: "final",
          },
        },
        error: null,
      });

      mockInsert.mockReturnValueOnce({ error: null });

      const result = await evaluateArtifact(mockSupabase, "sub-1");

      expect(result.success).toBe(true);
      expect(result.evidenceXpAwarded).toBe(15);
    });

    it("should award tiered XP for final artifact pass (Attempt 3+: +10)", async () => {
      mockSingle.mockReturnValueOnce({
        data: { decision: "pass", evaluated_by: null },
        error: null,
      });

      mockSingle.mockReturnValueOnce({
        data: {
          id: "sub-1",
          artifact_id: "art-1",
          user_id: "user-1",
          attempt_no: 4,
          user_module_progress_id: "mod-progress-1",
          module_artifacts: {
            id: "art-1",
            artifact_type: "final",
          },
        },
        error: null,
      });

      mockInsert.mockReturnValueOnce({ error: null });

      const result = await evaluateArtifact(mockSupabase, "sub-1");

      expect(result.success).toBe(true);
      expect(result.evidenceXpAwarded).toBe(10);
    });

    it("should award +1 Evidence XP for failed final artifacts", async () => {
      // Mock evaluation flow lookup (decision: 'fail')
      mockSingle.mockReturnValueOnce({
        data: { decision: "fail", evaluated_by: null },
        error: null,
      });

      mockSingle.mockReturnValueOnce({
        data: {
          id: "sub-1",
          artifact_id: "art-1",
          user_id: "user-1",
          attempt_no: 1,
          user_module_progress_id: "mod-progress-1",
          module_artifacts: {
            id: "art-1",
            artifact_type: "final",
          },
        },
        error: null,
      });

      mockInsert.mockReturnValueOnce({ error: null });

      const result = await evaluateArtifact(mockSupabase, "sub-1");

      expect(result.success).toBe(true);
      expect(result.evidenceXpAwarded).toBe(0);
      expect(result.engagementXpAwarded).toBe(1);
    });

    it("should award +5 manual review engagement XP for human reviews on passes", async () => {
      // Mock evaluation flow lookup (decision: 'pass', human review)
      mockSingle.mockReturnValueOnce({
        data: { decision: "pass", evaluated_by: "reviewer-1" },
        error: null,
      });

      mockSingle.mockReturnValueOnce({
        data: {
          id: "sub-1",
          artifact_id: "art-1",
          user_id: "user-1",
          attempt_no: 1,
          user_module_progress_id: "mod-progress-1",
          module_artifacts: {
            id: "art-1",
            artifact_type: "final",
          },
        },
        error: null,
      });

      // First awardXp (final_artifact_accepted_1)
      mockInsert.mockReturnValueOnce({ error: null });
      // Second awardXp (manual_eval_accepted)
      mockInsert.mockReturnValueOnce({ error: null });

      const result = await evaluateArtifact(mockSupabase, "sub-1");

      expect(result.success).toBe(true);
      expect(result.evidenceXpAwarded).toBe(20);
      expect(result.engagementXpAwarded).toBe(5);
    });

    it("should award +2 Evidence XP for accepted practice artifacts", async () => {
      mockSingle.mockReturnValueOnce({
        data: { decision: "pass", evaluated_by: null },
        error: null,
      });

      mockSingle.mockReturnValueOnce({
        data: {
          id: "sub-1",
          artifact_id: "art-1",
          user_id: "user-1",
          attempt_no: 1,
          user_module_progress_id: "mod-progress-1",
          module_artifacts: {
            id: "art-1",
            artifact_type: "practice",
          },
        },
        error: null,
      });

      mockInsert.mockReturnValueOnce({ error: null });

      const result = await evaluateArtifact(mockSupabase, "sub-1");

      expect(result.success).toBe(true);
      expect(result.evidenceXpAwarded).toBe(2);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ event_type: "practice_artifact_accepted" }),
      );
    });

    it("should award +1 engagement XP for failed practice artifacts", async () => {
      mockSingle.mockReturnValueOnce({
        data: { decision: "fail", evaluated_by: null },
        error: null,
      });

      mockSingle.mockReturnValueOnce({
        data: {
          id: "sub-1",
          artifact_id: "art-1",
          user_id: "user-1",
          attempt_no: 1,
          user_module_progress_id: "mod-progress-1",
          module_artifacts: {
            id: "art-1",
            artifact_type: "practice",
          },
        },
        error: null,
      });

      mockInsert.mockReturnValueOnce({ error: null });

      const result = await evaluateArtifact(mockSupabase, "sub-1");

      expect(result.success).toBe(true);
      expect(result.engagementXpAwarded).toBe(1);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ event_type: "practice_artifact_failed" }),
      );
    });

    it("should award +1 engagement XP for returned final artifacts", async () => {
      mockSingle.mockReturnValueOnce({
        data: { decision: "return", evaluated_by: null },
        error: null,
      });

      mockSingle.mockReturnValueOnce({
        data: {
          id: "sub-1",
          artifact_id: "art-1",
          user_id: "user-1",
          attempt_no: 1,
          user_module_progress_id: "mod-progress-1",
          module_artifacts: {
            id: "art-1",
            artifact_type: "final",
          },
        },
        error: null,
      });

      mockInsert.mockReturnValueOnce({ error: null });

      const result = await evaluateArtifact(mockSupabase, "sub-1");

      expect(result.success).toBe(true);
      expect(result.engagementXpAwarded).toBe(1);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ event_type: "final_artifact_failed" }),
      );
    });

    it("should award no XP for unrecognized decisions", async () => {
      mockSingle.mockReturnValueOnce({
        data: { decision: "pending", evaluated_by: null },
        error: null,
      });

      mockSingle.mockReturnValueOnce({
        data: {
          id: "sub-1",
          artifact_id: "art-1",
          user_id: "user-1",
          attempt_no: 1,
          user_module_progress_id: "mod-progress-1",
          module_artifacts: {
            id: "art-1",
            artifact_type: "final",
          },
        },
        error: null,
      });

      const result = await evaluateArtifact(mockSupabase, "sub-1");

      expect(result.success).toBe(true);
      expect(result.evidenceXpAwarded).toBe(0);
      expect(result.engagementXpAwarded).toBe(0);
    });

    it("should handle module_artifacts returned as an array", async () => {
      mockSingle.mockReturnValueOnce({
        data: { decision: "pass", evaluated_by: null },
        error: null,
      });

      mockSingle.mockReturnValueOnce({
        data: {
          id: "sub-1",
          artifact_id: "art-1",
          user_id: "user-1",
          attempt_no: 1,
          user_module_progress_id: "mod-progress-1",
          module_artifacts: [{ id: "art-1", artifact_type: "final" }],
        },
        error: null,
      });

      mockInsert.mockReturnValueOnce({ error: null });

      const result = await evaluateArtifact(mockSupabase, "sub-1");

      expect(result.success).toBe(true);
      expect(result.evidenceXpAwarded).toBe(20);
    });

    it("should throw when the evaluation flow is missing", async () => {
      mockSingle.mockReturnValueOnce({
        data: null,
        error: { message: "not found" },
      });

      await expect(evaluateArtifact(mockSupabase, "sub-1")).rejects.toThrow(
        "Current evaluation flow not found for submission: sub-1",
      );
    });

    it("should throw when the evaluation flow has no data", async () => {
      mockSingle.mockReturnValueOnce({
        data: null,
        error: null,
      });

      await expect(evaluateArtifact(mockSupabase, "sub-1")).rejects.toThrow(
        "Current evaluation flow not found for submission: sub-1",
      );
    });

    it("should throw when the submission is missing", async () => {
      mockSingle.mockReturnValueOnce({
        data: { decision: "pass", evaluated_by: null },
        error: null,
      });

      mockSingle.mockReturnValueOnce({
        data: null,
        error: { message: "not found" },
      });

      await expect(evaluateArtifact(mockSupabase, "sub-1")).rejects.toThrow(
        "Submission not found: sub-1",
      );
    });

    it("should throw when the submission has no data", async () => {
      mockSingle.mockReturnValueOnce({
        data: { decision: "pass", evaluated_by: null },
        error: null,
      });

      mockSingle.mockReturnValueOnce({
        data: null,
        error: null,
      });

      await expect(evaluateArtifact(mockSupabase, "sub-1")).rejects.toThrow(
        "Submission not found: sub-1",
      );
    });
  });

  describe("evaluateFallback", () => {
    it("should award +5 Evidence XP for fallback evaluation passes (manual_eval_accepted)", async () => {
      mockSingle.mockReturnValueOnce({
        data: { decision: "pass", evaluated_by: "reviewer-1" },
        error: null,
      });

      mockSingle.mockReturnValueOnce({
        data: { user_id: "user-1" },
        error: null,
      });

      mockInsert.mockReturnValueOnce({ error: null });

      const result = await evaluateFallback(mockSupabase, "sub-1");

      expect(result.success).toBe(true);
      expect(result.xpAwarded).toBe(5);
    });

    it("should award +1 Evidence XP for fallback evaluation failures (fallback_eval_failed)", async () => {
      mockSingle.mockReturnValueOnce({
        data: { decision: "fail", evaluated_by: "reviewer-1" },
        error: null,
      });

      mockSingle.mockReturnValueOnce({
        data: { user_id: "user-1" },
        error: null,
      });

      mockInsert.mockReturnValueOnce({ error: null });

      const result = await evaluateFallback(mockSupabase, "sub-1");

      expect(result.success).toBe(true);
      expect(result.xpAwarded).toBe(1);
    });

    it("should throw when the evaluation flow is missing", async () => {
      mockSingle.mockReturnValueOnce({
        data: null,
        error: { message: "not found" },
      });

      await expect(evaluateFallback(mockSupabase, "sub-1")).rejects.toThrow(
        "Current evaluation flow not found for submission: sub-1",
      );
    });

    it("should throw when the evaluation flow has no data", async () => {
      mockSingle.mockReturnValueOnce({
        data: null,
        error: null,
      });

      await expect(evaluateFallback(mockSupabase, "sub-1")).rejects.toThrow(
        "Current evaluation flow not found for submission: sub-1",
      );
    });

    it("should throw when the submission is missing", async () => {
      mockSingle.mockReturnValueOnce({
        data: { decision: "pass", evaluated_by: null },
        error: null,
      });

      mockSingle.mockReturnValueOnce({
        data: null,
        error: { message: "not found" },
      });

      await expect(evaluateFallback(mockSupabase, "sub-1")).rejects.toThrow(
        "Submission not found: sub-1",
      );
    });

    it("should throw when the submission has no data", async () => {
      mockSingle.mockReturnValueOnce({
        data: { decision: "pass", evaluated_by: null },
        error: null,
      });

      mockSingle.mockReturnValueOnce({
        data: null,
        error: null,
      });

      await expect(evaluateFallback(mockSupabase, "sub-1")).rejects.toThrow(
        "Submission not found: sub-1",
      );
    });
  });
});
