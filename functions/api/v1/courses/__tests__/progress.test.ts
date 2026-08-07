import { AuthError, requireAuth } from "@functions/lib/auth";
import { StageSequenceError } from "@functions/lib/stage-sequence";
import { createServiceSupabase } from "@functions/lib/supabase";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { completeStage } from "@functions/lib/xp-engine";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { onRequestPost as onModuleProgressPost } from "../[levelId]/modules/[moduleNo]/progress";
import { onRequestPost as onStageProgressPost } from "../[levelId]/modules/[moduleNo]/stages/progress";
import { onRequestPost as onLevelProgressPost } from "../[levelId]/progress";

vi.mock("@functions/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@functions/lib/auth")>();
  return {
    ...actual,
    requireAuth: vi.fn(),
  };
});

vi.mock("@functions/lib/supabase", () => ({
  createServiceSupabase: vi.fn(),
}));

vi.mock("@functions/api/v1/courses/queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@functions/api/v1/courses/queries")>();
  return {
    ...actual,
    recalculateLevelProgress: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("@functions/lib/xp-engine", () => ({
  completeStage: vi.fn().mockResolvedValue({
    success: true,
    xpAwarded: 0,
    userStageProgressId: "stage-progress-123",
  }),
  getUserTotalXp: vi.fn().mockResolvedValue(0),
}));

interface MockQueryChain {
  select: () => MockQueryChain;
  update: (payload?: unknown) => MockQueryChain;
  insert: (payload?: unknown) => MockQueryChain;
  upsert: (rows: unknown) => MockQueryChain;
  eq: (col: string, val: unknown) => MockQueryChain;
  in: (col: string, val: unknown) => MockQueryChain;
  limit: (count: number) => MockQueryChain;
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
  single: () => Promise<{ data: unknown; error: unknown }>;
  order: (col: string, options?: unknown) => MockQueryChain;
  toPromise?: () => Promise<{ data: unknown; error: unknown }>;
  then?: (resolve: (value: unknown) => unknown) => Promise<unknown>;
}

function createMockQueryChain(resolveVal: unknown, errorVal: unknown = null): MockQueryChain {
  const chain: MockQueryChain = {
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
    toPromise() {
      return Promise.resolve({ data: resolveVal, error: errorVal });
    },
    // biome-ignore lint/suspicious/noThenProperty: mock promise resolution
    then(resolve) {
      return Promise.resolve({ data: resolveVal, error: errorVal }).then(resolve);
    },
  };
  return chain as unknown as MockQueryChain;
}

describe("Progress API Endpoints", () => {
  const mockUser = {
    sub: "user-uuid-123",
    email: "learner@rareminds.com",
    products: ["lte"],
    roles: ["learner"],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("POST /api/v1/courses/:levelId/progress", () => {
    it("should successfully track level progress", async () => {
      vi.mocked(requireAuth).mockResolvedValueOnce(
        mockUser as unknown as Awaited<ReturnType<typeof requireAuth>>,
      );

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "learning_tracks") {
            return createMockQueryChain({ id: "track-123" });
          }
          if (table === "learning_paths") {
            return createMockQueryChain([{ id: "path-123", role_id: "role-123" }]);
          }
          if (table === "levels") {
            return createMockQueryChain({
              id: "level-123",
              level_code: "RCP-L1",
              capability_id: "cap-123",
            });
          }
          if (table === "user_capability_level_progress") {
            const chain = createMockQueryChain(null);
            chain.insert = vi
              .fn()
              .mockImplementation(() => createMockQueryChain({ id: "progress-123" }));
            return chain;
          }
          if (table === "role_capability_sequence") {
            const chain = createMockQueryChain([{ role_id: "role-123" }]);
            chain.maybeSingle = vi.fn().mockResolvedValue({
              data: {
                id: "seq-123",
                required_level: "L3",
                capability_priority: "core",
              },
              error: null,
            });
            return chain;
          }
          if (table === "user_capabilities") {
            return createMockQueryChain({ current_level: 1 });
          }
          return createMockQueryChain(null);
        }),
      };

      vi.mocked(createServiceSupabase).mockReturnValueOnce(
        mockSupabase as unknown as ReturnType<typeof createServiceSupabase>,
      );

      const request = new Request("http://localhost/api/v1/courses/level-123/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "in_progress" }),
      });

      const context = {
        request,
        env: {} as LteEnv,
        params: { levelId: "level-123" },
      } as unknown as PagesContext<LteEnv>;

      const response = await onLevelProgressPost(context);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.levelProgressId).toBe("progress-123");
    });

    it("should initialize user capability if it is missing when tracking level progress", async () => {
      vi.mocked(requireAuth).mockResolvedValueOnce(
        mockUser as unknown as Awaited<ReturnType<typeof requireAuth>>,
      );

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "learning_tracks") {
            return createMockQueryChain({ id: "track-123" });
          }
          if (table === "learning_paths") {
            return createMockQueryChain([{ id: "path-123", role_id: "role-123" }]);
          }
          if (table === "levels") {
            return createMockQueryChain({
              id: "level-123",
              level_code: "RCP-L1",
              capability_id: "cap-123",
            });
          }
          if (table === "user_capability_level_progress") {
            const chain = createMockQueryChain(null);
            chain.insert = vi
              .fn()
              .mockImplementation(() => createMockQueryChain({ id: "progress-123" }));
            return chain;
          }
          if (table === "role_capability_sequence") {
            const chain = createMockQueryChain([{ role_id: "role-123" }]);
            chain.maybeSingle = vi.fn().mockResolvedValue({
              data: {
                id: "seq-123",
                required_level: "L3",
                capability_priority: "core",
              },
              error: null,
            });
            return chain;
          }
          if (table === "user_capabilities") {
            const chain = createMockQueryChain(null);
            chain.insert = vi
              .fn()
              .mockImplementation(() => createMockQueryChain({ id: "cap-insert-123" }));
            return chain;
          }
          return createMockQueryChain(null);
        }),
      };

      vi.mocked(createServiceSupabase).mockReturnValueOnce(
        mockSupabase as unknown as ReturnType<typeof createServiceSupabase>,
      );

      const request = new Request("http://localhost/api/v1/courses/level-123/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "in_progress" }),
      });

      const context = {
        request,
        env: {} as LteEnv,
        params: { levelId: "level-123" },
      } as unknown as PagesContext<LteEnv>;

      const response = await onLevelProgressPost(context);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.levelProgressId).toBe("progress-123");

      expect(mockSupabase.from).toHaveBeenCalledWith("user_capabilities");
    });

    it("should return 400 when levelId route parameter is invalid", async () => {
      vi.mocked(requireAuth).mockResolvedValueOnce(
        mockUser as unknown as Awaited<ReturnType<typeof requireAuth>>,
      );

      const request = new Request("http://localhost/api/v1/courses//progress", {
        method: "POST",
      });

      const context = {
        request,
        env: {} as LteEnv,
        params: { levelId: "" },
      } as unknown as PagesContext<LteEnv>;

      const response = await onLevelProgressPost(context);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should return 403 Forbidden when requireAuth throws a FORBIDDEN error", async () => {
      vi.mocked(requireAuth).mockRejectedValueOnce(new AuthError("Forbidden action", "FORBIDDEN"));

      const request = new Request("http://localhost/api/v1/courses/level-123/progress", {
        method: "POST",
      });

      const context = {
        request,
        env: {} as LteEnv,
        params: { levelId: "level-123" },
      } as unknown as PagesContext<LteEnv>;

      const response = await onLevelProgressPost(context);
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("should return 500 when upsertLevelProgress throws database error", async () => {
      vi.mocked(requireAuth).mockResolvedValueOnce(
        mockUser as unknown as Awaited<ReturnType<typeof requireAuth>>,
      );

      const mockSupabase = {
        from: vi.fn().mockImplementation(() => {
          return createMockQueryChain(null, { message: "DB Connection timeout" });
        }),
      };

      vi.mocked(createServiceSupabase).mockReturnValueOnce(
        mockSupabase as unknown as ReturnType<typeof createServiceSupabase>,
      );

      const request = new Request("http://localhost/api/v1/courses/level-123/progress", {
        method: "POST",
      });

      const context = {
        request,
        env: {} as LteEnv,
        params: { levelId: "level-123" },
      } as unknown as PagesContext<LteEnv>;

      const response = await onLevelProgressPost(context);
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("SERVER_ERROR");
    });
  });

  describe("POST /api/v1/courses/:levelId/modules/:moduleNo/progress", () => {
    it("should successfully track module progress", async () => {
      vi.mocked(requireAuth).mockResolvedValueOnce(
        mockUser as unknown as Awaited<ReturnType<typeof requireAuth>>,
      );

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "learning_tracks") {
            return createMockQueryChain({ id: "track-123" });
          }
          if (table === "learning_paths") {
            return createMockQueryChain([{ id: "path-123", role_id: "role-123" }]);
          }
          if (table === "levels") {
            return createMockQueryChain({
              id: "level-123",
              level_code: "RCP-L1",
              capability_id: "cap-123",
            });
          }
          if (table === "user_capability_level_progress") {
            return createMockQueryChain({ id: "progress-123" });
          }
          if (table === "role_capability_sequence") {
            const chain = createMockQueryChain([{ role_id: "role-123" }]);
            chain.maybeSingle = vi.fn().mockResolvedValue({
              data: {
                id: "seq-123",
                required_level: "L3",
                capability_priority: "core",
              },
              error: null,
            });
            return chain;
          }
          if (table === "modules") {
            return createMockQueryChain({ id: "module-123" });
          }
          if (table === "user_module_progress") {
            const chain = createMockQueryChain(null);
            chain.insert = vi
              .fn()
              .mockImplementation(() => createMockQueryChain({ id: "mod-progress-123" }));
            return chain;
          }
          return createMockQueryChain(null);
        }),
      };

      vi.mocked(createServiceSupabase).mockReturnValueOnce(
        mockSupabase as unknown as ReturnType<typeof createServiceSupabase>,
      );

      const request = new Request("http://localhost/api/v1/courses/level-123/modules/1/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "in_progress" }),
      });

      const context = {
        request,
        env: {} as LteEnv,
        params: { levelId: "level-123", moduleNo: "1" },
      } as unknown as PagesContext<LteEnv>;

      const response = await onModuleProgressPost(context);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.moduleProgressId).toBe("mod-progress-123");
    });

    it("should return 400 when route parameters are invalid", async () => {
      vi.mocked(requireAuth).mockResolvedValueOnce(
        mockUser as unknown as Awaited<ReturnType<typeof requireAuth>>,
      );

      const request = new Request(
        "http://localhost/api/v1/courses/level-123/modules/invalid-no/progress",
        {
          method: "POST",
        },
      );

      const context = {
        request,
        env: {} as LteEnv,
        params: { levelId: "level-123", moduleNo: "invalid-no" },
      } as unknown as PagesContext<LteEnv>;

      const response = await onModuleProgressPost(context);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should return 500 when upsertModuleProgress throws database error", async () => {
      vi.mocked(requireAuth).mockResolvedValueOnce(
        mockUser as unknown as Awaited<ReturnType<typeof requireAuth>>,
      );

      const mockSupabase = {
        from: vi.fn().mockImplementation(() => {
          return createMockQueryChain(null, { message: "DB Connection timeout" });
        }),
      };

      vi.mocked(createServiceSupabase).mockReturnValueOnce(
        mockSupabase as unknown as ReturnType<typeof createServiceSupabase>,
      );

      const request = new Request("http://localhost/api/v1/courses/level-123/modules/1/progress", {
        method: "POST",
      });

      const context = {
        request,
        env: {} as LteEnv,
        params: { levelId: "level-123", moduleNo: "1" },
      } as unknown as PagesContext<LteEnv>;

      const response = await onModuleProgressPost(context);
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("SERVER_ERROR");
    });
  });

  describe("POST /api/v1/courses/:levelId/modules/:moduleNo/stages/progress", () => {
    it("should successfully track stage progress", async () => {
      vi.mocked(requireAuth).mockResolvedValueOnce(
        mockUser as unknown as Awaited<ReturnType<typeof requireAuth>>,
      );

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "e_content") {
            return createMockQueryChain({ id: "econtent-123", modules_content_id: "mc-123" });
          }
          if (table === "modules_content") {
            return createMockQueryChain({
              module_id: "module-123",
              stage_name: "engage",
              stage_order: 1,
            });
          }
          if (table === "learning_tracks") {
            return createMockQueryChain({ id: "track-123" });
          }
          if (table === "learning_paths") {
            return createMockQueryChain([{ id: "path-123", role_id: "role-123" }]);
          }
          if (table === "levels") {
            return createMockQueryChain({
              id: "level-123",
              level_code: "RCP-L1",
              capability_id: "cap-123",
            });
          }
          if (table === "user_capability_level_progress") {
            return createMockQueryChain({ id: "progress-123" });
          }
          if (table === "role_capability_sequence") {
            const chain = createMockQueryChain([{ role_id: "role-123" }]);
            chain.maybeSingle = vi.fn().mockResolvedValue({
              data: {
                id: "seq-123",
                required_level: "L3",
                capability_priority: "core",
              },
              error: null,
            });
            return chain;
          }
          if (table === "modules") {
            return createMockQueryChain({ id: "module-123" });
          }
          if (table === "user_module_progress") {
            return createMockQueryChain({
              id: "mod-progress-123",
              stages_completed: 2,
              completion_percentage: 33,
            });
          }
          if (table === "user_stage_progress") {
            const chain = createMockQueryChain([
              {
                id: "stage-progress-123",
                user_module_progress_id: "mod-progress-123",
                stage_name: "engage",
              },
            ]);
            chain.maybeSingle = vi.fn().mockResolvedValue({
              data: null,
              error: null,
            });
            chain.single = vi.fn().mockResolvedValue({
              data: {
                id: "stage-progress-123",
                user_module_progress_id: "mod-progress-123",
                stage_name: "engage",
              },
              error: null,
            });
            chain.insert = vi
              .fn()
              .mockImplementation(() => createMockQueryChain({ id: "stage-progress-123" }));
            return chain;
          }
          return createMockQueryChain(null);
        }),
      };

      vi.mocked(createServiceSupabase).mockReturnValueOnce(
        mockSupabase as unknown as ReturnType<typeof createServiceSupabase>,
      );

      const request = new Request(
        "http://localhost/api/v1/courses/level-123/modules/1/stages/progress",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eContentId: "00000000-0000-0000-0000-000000000000",
            stageName: "engage",
            status: "completed",
          }),
        },
      );

      const context = {
        request,
        env: {} as LteEnv,
        params: { levelId: "level-123", moduleNo: "1" },
      } as unknown as PagesContext<LteEnv>;

      const response = await onStageProgressPost(context);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.stageProgressId).toBe("stage-progress-123");
      expect(body.stagesCompleted).toBe(2);
    });

    it("should return 409 Conflict when stage sequence is violated", async () => {
      vi.mocked(requireAuth).mockResolvedValueOnce(
        mockUser as unknown as Awaited<ReturnType<typeof requireAuth>>,
      );
      vi.mocked(completeStage).mockRejectedValueOnce(
        new StageSequenceError("Stage locked", "STAGE_SEQUENCE_LOCKED"),
      );

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "e_content") {
            return createMockQueryChain({ id: "econtent-123", modules_content_id: "mc-123" });
          }
          if (table === "modules_content") {
            return createMockQueryChain({
              module_id: "module-123",
              stage_name: "express",
              stage_order: 4,
            });
          }
          if (table === "learning_tracks") {
            return createMockQueryChain({ id: "track-123" });
          }
          if (table === "learning_paths") {
            return createMockQueryChain([{ id: "path-123", role_id: "role-123" }]);
          }
          if (table === "levels") {
            return createMockQueryChain({
              id: "level-123",
              level_code: "RCP-L1",
              capability_id: "cap-123",
            });
          }
          if (table === "user_capability_level_progress") {
            return createMockQueryChain({ id: "progress-123" });
          }
          if (table === "role_capability_sequence") {
            const chain = createMockQueryChain([{ role_id: "role-123" }]);
            chain.maybeSingle = vi.fn().mockResolvedValue({
              data: {
                id: "seq-123",
                required_level: "L3",
                capability_priority: "core",
              },
              error: null,
            });
            return chain;
          }
          if (table === "modules") {
            return createMockQueryChain({ id: "module-123" });
          }
          if (table === "e_content") {
            return createMockQueryChain({ modules_content_id: "content-123" });
          }
          if (table === "modules_content") {
            return createMockQueryChain({
              id: "content-123",
              stage_name: "express",
              module_id: "module-123",
            });
          }
          if (table === "user_module_progress") {
            return createMockQueryChain({
              id: "mod-progress-123",
              stages_completed: 0,
              completion_percentage: 0,
            });
          }
          if (table === "user_stage_progress") {
            // First query: SELECT for completed stages - should return empty []
            // Second query: maybeSingle for existing stage progress - should return null
            const chain = createMockQueryChain([]);
            let callCount = 0;
            const originalEq = chain.eq;
            chain.eq = vi.fn((...args) => {
              callCount++;
              if (callCount === 1) {
                // First call is for completed stages query - return empty array
                return {
                  ...chain,
                  data: [],
                  error: null,
                };
              }
              // Subsequent calls use normal mock chain
              return originalEq.apply(chain, args);
            });
            chain.maybeSingle = vi.fn().mockResolvedValue({
              data: null,
              error: null,
            });
            return chain;
          }
          return createMockQueryChain(null);
        }),
      };

      vi.mocked(createServiceSupabase).mockReturnValueOnce(
        mockSupabase as unknown as ReturnType<typeof createServiceSupabase>,
      );

      const request = new Request(
        "http://localhost/api/v1/courses/level-123/modules/1/stages/progress",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eContentId: "00000000-0000-0000-0000-000000000000",
            stageName: "express",
            status: "completed",
          }),
        },
      );

      const context = {
        request,
        env: {} as LteEnv,
        params: { levelId: "level-123", moduleNo: "1" },
      } as unknown as PagesContext<LteEnv>;

      const response = await onStageProgressPost(context);
      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("STAGE_SEQUENCE_LOCKED");
    });
  });
});
