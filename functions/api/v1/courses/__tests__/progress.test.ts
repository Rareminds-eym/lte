import { AuthError, requireAuth } from "@functions/lib/auth";
import { createServiceSupabase } from "@functions/lib/supabase";
import type { LteEnv, PagesContext } from "@functions/lib/types";
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

interface MockQueryChain {
  select: () => MockQueryChain;
  update: (payload?: unknown) => MockQueryChain;
  insert: (payload?: unknown) => MockQueryChain;
  upsert: (rows: unknown) => MockQueryChain;
  eq: (col: string, val: unknown) => MockQueryChain;
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
  single: () => Promise<{ data: unknown; error: unknown }>;
  order: (col: string, options?: unknown) => MockQueryChain;
  then: typeof Promise.prototype.then;
}

function createMockQueryChain(resolveVal: unknown, errorVal: unknown = null): MockQueryChain {
  const chain: MockQueryChain = {
    select: vi.fn().mockImplementation(() => chain),
    update: vi.fn().mockImplementation(() => chain),
    insert: vi.fn().mockImplementation(() => chain),
    upsert: vi.fn().mockImplementation(() => chain),
    eq: vi.fn().mockImplementation(() => chain),
    maybeSingle: vi.fn().mockResolvedValue({ data: resolveVal, error: errorVal }),
    single: vi.fn().mockResolvedValue({ data: resolveVal, error: errorVal }),
    order: vi.fn().mockImplementation(() => chain),
    then(onfulfilled) {
      return Promise.resolve({ data: resolveVal, error: errorVal }).then(onfulfilled);
    },
  };
  return chain;
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
          if (table === "learning_paths") {
            return createMockQueryChain({ id: "path-123", role_id: "role-123" });
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
            return createMockQueryChain({
              id: "seq-123",
              required_level: "L3",
              capability_priority: "core",
            });
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
  });

  describe("POST /api/v1/courses/:levelId/modules/:moduleNo/progress", () => {
    it("should successfully track module progress", async () => {
      vi.mocked(requireAuth).mockResolvedValueOnce(
        mockUser as unknown as Awaited<ReturnType<typeof requireAuth>>,
      );

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "learning_paths") {
            return createMockQueryChain({ id: "path-123", role_id: "role-123" });
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
  });

  describe("POST /api/v1/courses/:levelId/modules/:moduleNo/stages/progress", () => {
    it("should successfully track stage progress", async () => {
      vi.mocked(requireAuth).mockResolvedValueOnce(
        mockUser as unknown as Awaited<ReturnType<typeof requireAuth>>,
      );

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "learning_paths") {
            return createMockQueryChain({ id: "path-123", role_id: "role-123" });
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
          if (table === "modules") {
            return createMockQueryChain({ id: "module-123" });
          }
          if (table === "user_module_progress") {
            return createMockQueryChain({ id: "mod-progress-123" });
          }
          if (table === "user_stage_progress") {
            const chain = createMockQueryChain(null);
            chain.insert = vi
              .fn()
              .mockImplementation(() => createMockQueryChain({ id: "stage-progress-123" }));
            chain.select = vi
              .fn()
              .mockImplementation(() =>
                createMockQueryChain([{ stage_name: "engage" }, { stage_name: "explore" }]),
              );
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
  });
});
