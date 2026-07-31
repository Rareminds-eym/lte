import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  awardXp,
  completeStage,
  evaluateArtifact,
  evaluateFallback,
  XP_AMOUNTS,
  XP_CATEGORIES,
} from "../xp-engine";

// Mock Supabase Client
const mockSingle = vi.fn();
const mockMaybeSingle = vi.fn();
const mockLimit = vi.fn();
const mockEq = vi.fn();
const mockIn = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockInsert = vi.fn();

const mockSupabase = {
  from: vi.fn().mockImplementation(() => ({
    insert: mockInsert,
    update: mockUpdate,
    select: mockSelect,
    eq: mockEq,
    in: mockIn,
    limit: mockLimit,
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
  })),
} as any;

describe("XP Engine Core logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockReturnValue({ error: null });
    mockUpdate.mockReturnValue({ error: null });
    mockSelect.mockReturnValue({
      eq: mockEq,
      in: mockIn,
      limit: mockLimit,
      single: mockSingle,
      maybeSingle: mockMaybeSingle,
    });
    mockEq.mockReturnValue({
      eq: mockEq,
      single: mockSingle,
      maybeSingle: mockMaybeSingle,
      limit: mockLimit,
    });
    mockIn.mockReturnValue({ eq: mockEq, single: mockSingle });
    mockLimit.mockReturnValue({ maybeSingle: mockMaybeSingle });
  });

  describe("awardXp", () => {
    it("should successfully insert an XP event", async () => {
      const result = await awardXp(
        mockSupabase,
        "user-1",
        "stage_completed",
        "user_stage_progress",
        "progress-1",
      );

      expect(result.success).toBe(true);
      expect(result.xpAwarded).toBe(1);
      expect(result.alreadyAwarded).toBe(false);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "user-1",
          event_type: "stage_completed",
          xp_category: "evidence",
          xp_amount: 1,
          source_type: "user_stage_progress",
          source_id: "progress-1",
          idempotency_key: "stage:user-1:progress-1",
        }),
      );
    });

    it("should swallow unique constraint key errors gracefully", async () => {
      mockInsert.mockReturnValue({
        error: { code: "23505", message: "duplicate key value violates unique constraint" },
      });

      const result = await awardXp(
        mockSupabase,
        "user-1",
        "stage_completed",
        "user_stage_progress",
        "progress-1",
      );

      expect(result.success).toBe(true);
      expect(result.xpAwarded).toBe(0);
      expect(result.alreadyAwarded).toBe(true);
    });
  });

  describe("completeStage", () => {
    it("should award +1 Evidence XP and upsert stage progress record", async () => {
      // Mock modules_content lookup
      mockSingle.mockReturnValueOnce({
        data: { module_id: "mod-1", stage_name: "engage", stage_order: 1 },
        error: null,
      });

      // Mock e_content lookup
      mockMaybeSingle.mockReturnValueOnce({
        data: { id: "content-1" },
        error: null,
      });

      // Mock user_module_progress lookup (already exists)
      mockSelect.mockReturnValueOnce({
        eq: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce([
            { id: "mod-progress-1", stages_completed: 1, module_status: "in_progress" },
          ]),
        }),
      });

      // Mock user_stage_progress lookup (not completed yet)
      mockMaybeSingle.mockReturnValueOnce({
        data: null,
        error: null,
      });

      // Mock insert of user_stage_progress
      mockSingle.mockReturnValueOnce({
        data: { id: "stage-progress-1" },
        error: null,
      });

      // Mock insert of xp_event (awardXp call)
      mockInsert.mockReturnValueOnce({ error: null });

      // Mock update of user_module_progress
      mockEq.mockReturnValueOnce({ error: null });

      const result = await completeStage(mockSupabase, "user-1", "content-stage-1");

      expect(result.success).toBe(true);
      expect(result.xpAwarded).toBe(1);
      expect(result.userStageProgressId).toBe("stage-progress-1");
    });
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
  });
});
