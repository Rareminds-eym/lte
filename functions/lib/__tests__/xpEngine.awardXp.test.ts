import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it } from "vitest";
import { awardXp, completeStage } from "../xp-engine";
import { createMockQueryChain, mockInsert, mockSupabase, resetMocks } from "./xpEngine.helpers";

describe("XP Engine Core logic", () => {
  beforeEach(() => {
    resetMocks();
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

    it("should use a custom XP amount when provided", async () => {
      mockInsert.mockReturnValueOnce({ error: null });

      const result = await awardXp(
        mockSupabase,
        "user-1",
        "capstone_completed",
        "user_capabilities",
        "cap-1",
        {},
        42,
      );

      expect(result.success).toBe(true);
      expect(result.xpAwarded).toBe(42);
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ xp_amount: 42 }));
    });

    it("should fall back to 0 XP and engagement category for unknown events", async () => {
      mockInsert.mockReturnValueOnce({ error: null });

      const result = await awardXp(
        mockSupabase,
        "user-1",
        "mystery_event",
        "unknown_source",
        "src-1",
      );

      expect(result.success).toBe(true);
      expect(result.xpAwarded).toBe(0);
      expect(result.alreadyAwarded).toBe(false);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          xp_amount: 0,
          xp_category: "engagement",
          idempotency_key: "generic:user-1:mystery_event:src-1",
        }),
      );
    });

    it("should re-throw non-unique insert errors after logging", async () => {
      mockInsert.mockReturnValueOnce({
        error: { code: "PGRST301", message: "connection failure" },
      });

      await expect(
        awardXp(mockSupabase, "user-1", "stage_completed", "user_stage_progress", "progress-1"),
      ).rejects.toMatchObject({
        code: "QUERY_GATEWAY_DATABASE_ERROR",
        cause: expect.objectContaining({ code: "PGRST301" }),
      });
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
            chain.insert = vi
              .fn()
              .mockImplementation(() => createMockQueryChain({ id: "stage-progress-1" }));
            return chain;
          }
          return createMockQueryChain(null);
        }),
      } as unknown as SupabaseClient;

      const result = await completeStage(mockSupabase, "user-1", "content-stage-1");

      expect(result.success).toBe(true);
      expect(result.xpAwarded).toBe(1);
      expect(result.userStageProgressId).toBe("stage-progress-1");
    });

    it("should throw when modules_content stage is missing", async () => {
      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "modules_content") {
            return createMockQueryChain(null, { message: "not found" });
          }
          return createMockQueryChain(null);
        }),
      } as unknown as Parameters<typeof completeStage>[0];

      await expect(completeStage(mockSupabase, "user-1", "stage-1")).rejects.toThrow(
        "Modules content stage not found: stage-1",
      );
    });

    it("should throw when modules_content returns no data", async () => {
      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "modules_content") {
            return createMockQueryChain(null);
          }
          return createMockQueryChain(null);
        }),
      } as unknown as Parameters<typeof completeStage>[0];

      await expect(completeStage(mockSupabase, "user-1", "stage-1")).rejects.toThrow(
        "Modules content stage not found: stage-1",
      );
    });

    it("should throw when associated e_content item is missing", async () => {
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
            return createMockQueryChain(null, { message: "not found" });
          }
          return createMockQueryChain(null);
        }),
      } as unknown as Parameters<typeof completeStage>[0];

      await expect(completeStage(mockSupabase, "user-1", "stage-1")).rejects.toThrow(
        "Associated e_content item not found for stage: stage-1",
      );
    });

    it("should throw when e_content returns no data", async () => {
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
            return createMockQueryChain(null);
          }
          return createMockQueryChain(null);
        }),
      } as unknown as Parameters<typeof completeStage>[0];

      await expect(completeStage(mockSupabase, "user-1", "stage-1")).rejects.toThrow(
        "Associated e_content item not found for stage: stage-1",
      );
    });

    it("should throw when the module progress query fails", async () => {
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
            return createMockQueryChain(null, { message: "query failed" });
          }
          return createMockQueryChain(null);
        }),
      } as unknown as Parameters<typeof completeStage>[0];

      await expect(completeStage(mockSupabase, "user-1", "stage-1")).rejects.toMatchObject({
        message: "query failed",
      });
    });

    it("should create module progress from scratch when none exists", async () => {
      const moduleProgressCalls = { n: 0 };
      const stageProgressCalls = { n: 0 };
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
            moduleProgressCalls.n++;
            if (moduleProgressCalls.n === 1) {
              return createMockQueryChain([]);
            }
            if (moduleProgressCalls.n === 2) {
              const inner = createMockQueryChain({ id: "mod-progress-1" });
              return { insert: vi.fn().mockImplementation(() => inner) };
            }
            return createMockQueryChain(null);
          }
          if (table === "modules") {
            return createMockQueryChain({ level_id: "level-1" });
          }
          if (table === "user_capability_level_progress") {
            return createMockQueryChain({ id: "lvl-progress-1" });
          }
          if (table === "user_stage_progress") {
            stageProgressCalls.n++;
            if (stageProgressCalls.n === 1) {
              return createMockQueryChain([]);
            }
            if (stageProgressCalls.n === 2) {
              return createMockQueryChain(null);
            }
            const inner = createMockQueryChain({ id: "stage-progress-1" });
            return { insert: vi.fn().mockImplementation(() => inner) };
          }
          return createMockQueryChain(null);
        }),
      } as unknown as Parameters<typeof completeStage>[0];

      const result = await completeStage(mockSupabase, "user-1", "stage-1");

      expect(result.success).toBe(true);
      expect(result.xpAwarded).toBe(1);
      expect(result.userStageProgressId).toBe("stage-progress-1");
    });

    it("should throw when module is not found while creating progress", async () => {
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
            return createMockQueryChain([]);
          }
          if (table === "modules") {
            return createMockQueryChain(null);
          }
          return createMockQueryChain(null);
        }),
      } as unknown as Parameters<typeof completeStage>[0];

      await expect(completeStage(mockSupabase, "user-1", "stage-1")).rejects.toThrow(
        "Module not found",
      );
    });

    it("should throw when level progress is not found while creating progress", async () => {
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
            return createMockQueryChain([]);
          }
          if (table === "modules") {
            return createMockQueryChain({ level_id: "level-1" });
          }
          if (table === "user_capability_level_progress") {
            return createMockQueryChain(null);
          }
          return createMockQueryChain(null);
        }),
      } as unknown as Parameters<typeof completeStage>[0];

      await expect(completeStage(mockSupabase, "user-1", "stage-1")).rejects.toThrow(
        "Level progress not found for level: level-1",
      );
    });

    it("should throw when creating module progress fails", async () => {
      const moduleProgressCalls = { n: 0 };
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
            moduleProgressCalls.n++;
            if (moduleProgressCalls.n === 1) {
              return createMockQueryChain([]);
            }
            const inner = createMockQueryChain(null, { message: "insert failed" });
            return { insert: vi.fn().mockImplementation(() => inner) };
          }
          if (table === "modules") {
            return createMockQueryChain({ level_id: "level-1" });
          }
          if (table === "user_capability_level_progress") {
            return createMockQueryChain({ id: "lvl-progress-1" });
          }
          return createMockQueryChain(null);
        }),
      } as unknown as Parameters<typeof completeStage>[0];

      await expect(completeStage(mockSupabase, "user-1", "stage-1")).rejects.toMatchObject({
        message: "insert failed",
      });
    });

    it("should throw when created module progress comes back empty", async () => {
      const moduleProgressCalls = { n: 0 };
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
            moduleProgressCalls.n++;
            if (moduleProgressCalls.n === 1) {
              return createMockQueryChain([]);
            }
            const inner = createMockQueryChain(null);
            return { insert: vi.fn().mockImplementation(() => inner) };
          }
          if (table === "modules") {
            return createMockQueryChain({ level_id: "level-1" });
          }
          if (table === "user_capability_level_progress") {
            return createMockQueryChain({ id: "lvl-progress-1" });
          }
          return createMockQueryChain(null);
        }),
      } as unknown as Parameters<typeof completeStage>[0];

      await expect(completeStage(mockSupabase, "user-1", "stage-1")).rejects.toThrow(
        "Failed to create or retrieve module progress",
      );
    });

    it("should throw when the stage progress query fails", async () => {
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
            return createMockQueryChain(null, { message: "query failed" });
          }
          return createMockQueryChain(null);
        }),
      } as unknown as Parameters<typeof completeStage>[0];

      await expect(completeStage(mockSupabase, "user-1", "stage-1")).rejects.toMatchObject({
        message: "query failed",
      });
    });

    it("should throw when creating stage progress fails", async () => {
      const stageProgressCalls = { n: 0 };
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
            stageProgressCalls.n++;
            if (stageProgressCalls.n === 1) {
              return createMockQueryChain([]);
            }
            if (stageProgressCalls.n === 2) {
              return createMockQueryChain(null);
            }
            const inner = createMockQueryChain(null, { message: "insert failed" });
            return { insert: vi.fn().mockImplementation(() => inner) };
          }
          return createMockQueryChain(null);
        }),
      } as unknown as Parameters<typeof completeStage>[0];

      await expect(completeStage(mockSupabase, "user-1", "stage-1")).rejects.toMatchObject({
        message: "insert failed",
      });
    });

    it("should update an existing incomplete stage progress record", async () => {
      const stageProgressCalls = { n: 0 };
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
            stageProgressCalls.n++;
            if (stageProgressCalls.n === 1) {
              return createMockQueryChain([]);
            }
            if (stageProgressCalls.n === 2) {
              return createMockQueryChain({ id: "stage-progress-1", status: "in_progress" });
            }
            return createMockQueryChain(null);
          }
          return createMockQueryChain(null);
        }),
      } as unknown as Parameters<typeof completeStage>[0];

      const result = await completeStage(mockSupabase, "user-1", "stage-1");

      expect(result.success).toBe(true);
      expect(result.xpAwarded).toBe(1);
      expect(result.userStageProgressId).toBe("stage-progress-1");
    });

    it("should throw when updating an existing stage progress record fails", async () => {
      const stageProgressCalls = { n: 0 };
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
            stageProgressCalls.n++;
            if (stageProgressCalls.n === 1) {
              return createMockQueryChain([]);
            }
            if (stageProgressCalls.n === 2) {
              return createMockQueryChain({ id: "stage-progress-1", status: "in_progress" });
            }
            return createMockQueryChain(null, { message: "update failed" });
          }
          return createMockQueryChain(null);
        }),
      } as unknown as Parameters<typeof completeStage>[0];

      await expect(completeStage(mockSupabase, "user-1", "stage-1")).rejects.toMatchObject({
        message: "update failed",
      });
    });

    it("should skip updates when stage is already completed", async () => {
      const stageProgressCalls = { n: 0 };
      const moduleProgressCalls = { n: 0 };
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
            moduleProgressCalls.n++;
            if (moduleProgressCalls.n === 1) {
              return createMockQueryChain([
                { id: "mod-progress-1", stages_completed: 6, module_status: "in_progress" },
              ]);
            }
            return createMockQueryChain(null);
          }
          if (table === "user_stage_progress") {
            stageProgressCalls.n++;
            if (stageProgressCalls.n === 1) {
              return createMockQueryChain([]);
            }
            if (stageProgressCalls.n === 2) {
              return createMockQueryChain({ id: "stage-progress-1", status: "completed" });
            }
            return createMockQueryChain(null);
          }
          return createMockQueryChain(null);
        }),
      } as unknown as Parameters<typeof completeStage>[0];

      const result = await completeStage(mockSupabase, "user-1", "stage-1");

      expect(result.success).toBe(true);
      expect(result.userStageProgressId).toBe("stage-progress-1");
    });

    it("should finalize module status to completed when the 6th stage is done", async () => {
      const stageProgressCalls = { n: 0 };
      const moduleChain = createMockQueryChain([
        { id: "mod-progress-1", stages_completed: 5, module_status: "in_progress" },
      ]);
      const moduleUpdate = vi.spyOn(moduleChain, "update").mockImplementation(() => moduleChain);
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
            return moduleChain;
          }
          if (table === "user_stage_progress") {
            stageProgressCalls.n++;
            if (stageProgressCalls.n === 1) {
              return createMockQueryChain([]);
            }
            if (stageProgressCalls.n === 2) {
              return createMockQueryChain({ id: "stage-progress-1", status: "in_progress" });
            }
            return createMockQueryChain(null);
          }
          return createMockQueryChain(null);
        }),
      } as unknown as Parameters<typeof completeStage>[0];

      const result = await completeStage(mockSupabase, "user-1", "stage-1");

      expect(result.success).toBe(true);
      expect(moduleUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          stages_completed: 6,
          completion_percentage: 100,
          module_status: "completed",
        }),
      );
    });

    it("should throw when updating module progress counters fails", async () => {
      const stageProgressCalls = { n: 0 };
      const moduleProgressCalls = { n: 0 };
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
            moduleProgressCalls.n++;
            if (moduleProgressCalls.n === 1) {
              return createMockQueryChain([
                { id: "mod-progress-1", stages_completed: 1, module_status: "in_progress" },
              ]);
            }
            if (moduleProgressCalls.n === 2) {
              return createMockQueryChain(null, { message: "update failed" });
            }
            return createMockQueryChain(null);
          }
          if (table === "user_stage_progress") {
            stageProgressCalls.n++;
            if (stageProgressCalls.n === 1) {
              return createMockQueryChain([]);
            }
            if (stageProgressCalls.n === 2) {
              return createMockQueryChain({ id: "stage-progress-1", status: "in_progress" });
            }
            return createMockQueryChain(null);
          }
          return createMockQueryChain(null);
        }),
      } as unknown as Parameters<typeof completeStage>[0];

      await expect(completeStage(mockSupabase, "user-1", "stage-1")).rejects.toMatchObject({
        message: "update failed",
      });
    });

    it("should skip module progress counter update when XP was already awarded", async () => {
      const stageProgressCalls = { n: 0 };
      const moduleProgressCalls = { n: 0 };
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
            moduleProgressCalls.n++;
            if (moduleProgressCalls.n === 1) {
              return createMockQueryChain([
                { id: "mod-progress-1", stages_completed: 1, module_status: "in_progress" },
              ]);
            }
            return createMockQueryChain(null);
          }
          if (table === "user_stage_progress") {
            stageProgressCalls.n++;
            if (stageProgressCalls.n === 1) {
              return createMockQueryChain([]);
            }
            if (stageProgressCalls.n === 2) {
              return createMockQueryChain({ id: "stage-progress-1", status: "in_progress" });
            }
            return createMockQueryChain(null);
          }
          if (table === "xp_events") {
            return createMockQueryChain(null, { code: "23505" });
          }
          return createMockQueryChain(null);
        }),
      } as unknown as Parameters<typeof completeStage>[0];

      const result = await completeStage(mockSupabase, "user-1", "stage-1");

      expect(result.success).toBe(true);
      expect(result.xpAwarded).toBe(0);
      expect(result.userStageProgressId).toBe("stage-progress-1");
    });
  });
});
