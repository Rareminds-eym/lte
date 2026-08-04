import { beforeEach, describe, expect, it, vi } from "vitest";
import { awardXp, completeStage, evaluateArtifact, evaluateFallback } from "../xp-engine";

// Mock Supabase Client
const mockSingle = vi.fn();
const mockMaybeSingle = vi.fn();
const mockLimit = vi.fn();
const mockEq = vi.fn();
const mockIn = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockInsert = vi.fn();
const mockOrder = vi.fn();

function createMockQueryChain(resolveVal: unknown, errorVal: unknown = null) {
  // biome-ignore lint/suspicious/noExplicitAny: mock chain requires dynamic method assignment
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: Record<string, any> = {
    select: vi.fn().mockImplementation(() => chain),
    update: vi.fn().mockImplementation(() => chain),
    insert: vi.fn().mockImplementation(() => chain),
    upsert: vi.fn().mockImplementation(() => chain),
    eq: vi.fn().mockImplementation(() => chain),
    in: vi.fn().mockImplementation(() => chain),
    limit: vi.fn().mockImplementation(() => chain),
    maybeSingle: vi.fn().mockResolvedValue({ data: resolveVal, error: errorVal }),
    single: vi.fn().mockResolvedValue({ data: resolveVal, error: errorVal }),
    order: vi.fn().mockImplementation(() => chain),
    // biome-ignore lint/suspicious/noThenProperty: mock promise resolution
    then: (resolve: (val: unknown) => unknown) =>
      Promise.resolve({ data: resolveVal, error: errorVal }).then(resolve),
  };
  return chain;
}

function createChain() {
  // biome-ignore lint/suspicious/noExplicitAny: mock chain requires dynamic method assignment
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: Record<string, any> = {
    select: (...args: unknown[]) => mockSelect(...args) ?? chain,
    update: (...args: unknown[]) => mockUpdate(...args) ?? chain,
    insert: mockInsert,
    eq: (...args: unknown[]) => mockEq(...args) ?? chain,
    in: (...args: unknown[]) => mockIn(...args) ?? chain,
    limit: (...args: unknown[]) => mockLimit(...args) ?? chain,
    order: (...args: unknown[]) => mockOrder(...args) ?? chain,
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
  };
  return chain;
}

const mockSupabase = {
  from: vi.fn().mockImplementation(() => createChain()),
} as unknown as Parameters<typeof awardXp>[0];

describe("XP Engine Core logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockReturnValue({ error: null });
    mockUpdate.mockReturnValue(null);
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
      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "modules_content") {
            return createMockQueryChain({
              module_id: "mod-1",
              stage_name: "engage",
              stage_order: 1,
            });
          }
          if (table === "e_content") {
            return createMockQueryChain({ id: "content-1" });
          }
          if (table === "user_module_progress") {
            return createMockQueryChain([
              { id: "mod-progress-1", stages_completed: 1, module_status: "in_progress" },
            ]);
          }
          if (table === "user_stage_progress") {
            const chain = createMockQueryChain(null);
            // biome-ignore lint/complexity/useLiteralKeys: TS noPropertyAccessFromIndexSignature requires bracket notation
            chain["insert"] = vi
              .fn()
              .mockImplementation(() => createMockQueryChain({ id: "stage-progress-1" }));
            return chain;
          }
          return createMockQueryChain(null);
        }),
      } as unknown as Parameters<typeof awardXp>[0];

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
