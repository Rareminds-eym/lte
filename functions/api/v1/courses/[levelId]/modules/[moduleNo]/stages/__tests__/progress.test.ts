import { upsertStageProgress } from "@functions/api/v1/courses/queries";
import { createServiceSupabase } from "@functions/lib/supabase";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { awardXp, completeStage, getUserTotalXp } from "@functions/lib/xp-engine";
import { AuthError, requireAuth } from "@functions/middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { onRequestPost } from "../progress";

vi.mock("@functions/middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@functions/middleware")>();
  return { ...actual, requireAuth: vi.fn() };
});

vi.mock("@functions/lib/supabase", () => ({ createServiceSupabase: vi.fn() }));

vi.mock("@functions/lib/xp-engine", () => ({
  completeStage: vi.fn(),
  getUserTotalXp: vi.fn(),
  awardXp: vi.fn(),
}));

vi.mock("@functions/api/v1/courses/queries", () => ({
  upsertStageProgress: vi.fn(),
  recalculateLevelProgress: vi.fn().mockResolvedValue(undefined),
}));

interface QueryChain {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then: (resolve: (val: unknown) => unknown) => Promise<unknown>;
}

function chainFor(data: unknown, error: unknown = null): QueryChain {
  const chain: QueryChain = {
    select: vi.fn().mockImplementation(() => chain),
    eq: vi.fn().mockImplementation(() => chain),
    gte: vi.fn().mockImplementation(() => chain),
    in: vi.fn().mockImplementation(() => chain),
    range: vi.fn().mockImplementation(() => chain),
    single: vi.fn().mockResolvedValue({ data, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    // biome-ignore lint/suspicious/noThenProperty: mock promise resolution
    then: (resolve: (val: unknown) => unknown) => Promise.resolve({ data, error }).then(resolve),
  };
  return chain;
}

function supabaseWith(tables: Record<string, { data?: unknown; error?: unknown }>): SupabaseClient {
  return {
    from: vi
      .fn()
      .mockImplementation((table: string) =>
        chainFor(tables[table]?.data, tables[table]?.error ?? null),
      ),
  } as unknown as SupabaseClient;
}

const mockUser = {
  sub: "user-1",
  email: "learner@rareminds.com",
  products: ["lte"],
  roles: ["learner"],
};

const eContentId = "00000000-0000-0000-0000-000000000000";

function context(
  body: unknown,
  params: Record<string, string> = { levelId: "level-1", moduleNo: "1" },
) {
  return {
    request: new Request("http://localhost/api/v1/courses/level-1/modules/1/stages/progress", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    env: {} as LteEnv,
    params,
  } as unknown as PagesContext<LteEnv>;
}

const completedBody = { eContentId, stageName: "engage", status: "completed" };

describe("POST /api/v1/courses/:levelId/modules/:moduleNo/stages/progress", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(
      mockUser as unknown as Awaited<ReturnType<typeof requireAuth>>,
    );
    vi.mocked(completeStage).mockResolvedValue({
      success: true,
      xpAwarded: 1,
      userStageProgressId: "sp-1",
    });
    vi.mocked(awardXp).mockResolvedValue({
      success: true,
      xpAwarded: 1,
      alreadyAwarded: false,
    });
    vi.mocked(upsertStageProgress).mockResolvedValue({
      stageProgressId: "stage-1",
      stagesCompleted: 1,
      completionPercentage: 17,
    });
    vi.mocked(getUserTotalXp).mockResolvedValue(120);
  });

  it("returns 401 when requireAuth throws UNAUTHORIZED", async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new AuthError("Missing token", "UNAUTHORIZED"));
    const response = await onRequestPost(context(completedBody));
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 403 when requireAuth throws FORBIDDEN", async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new AuthError("Forbidden", "FORBIDDEN"));
    const response = await onRequestPost(context(completedBody));
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns 400 when route params are invalid", async () => {
    const response = await onRequestPost(context(completedBody, {}));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when the body is not valid JSON", async () => {
    const response = await onRequestPost(context("not-json"));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  it("returns 400 when the body fails validation", async () => {
    const response = await onRequestPost(
      context({ eContentId, stageName: "unknown-stage", status: "completed" }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 when the e_content lookup errors", async () => {
    vi.mocked(createServiceSupabase).mockReturnValueOnce(
      supabaseWith({ e_content: { error: new Error("db down") } }),
    );
    const response = await onRequestPost(context(completedBody));
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 404 when the e_content is missing", async () => {
    vi.mocked(createServiceSupabase).mockReturnValueOnce(
      supabaseWith({ e_content: { data: null } }),
    );
    const response = await onRequestPost(context(completedBody));
    expect(response.status).toBe(404);
  });

  it("completes a stage and returns updated progress plus XP", async () => {
    vi.mocked(awardXp).mockResolvedValueOnce({
      success: true,
      xpAwarded: 5,
      alreadyAwarded: false,
    });
    vi.mocked(getUserTotalXp).mockResolvedValueOnce(430);
    vi.mocked(createServiceSupabase).mockReturnValueOnce(
      supabaseWith({
        e_content: { data: { modules_content_id: "mc-1" } },
        xp_events: { data: [{ xp_amount: 430 }] },
        user_stage_progress: { data: { user_module_progress_id: "ump-1" } },
        user_module_progress: { data: { stages_completed: 2, completion_percentage: 33 } },
      }),
    );

    const response = await onRequestPost(context(completedBody));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      success: true,
      stageProgressId: "stage-1",
      stagesCompleted: 2,
      completionPercentage: 33,
      xpAwarded: 5,
      totalXp: 430,
      xpCategory: "evidence",
      levelCompleted: false,
      levelXpAwarded: 0,
    });
    expect(awardXp).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "stage_completed",
      "user_stage_progress",
      "stage-1",
      { modules_content_id: "mc-1", stage_name: "engage" },
    );
  });

  it("returns 500 when the stage progress lookup errors after completion", async () => {
    vi.mocked(createServiceSupabase).mockReturnValueOnce(
      supabaseWith({
        e_content: { data: { modules_content_id: "mc-1" } },
        user_stage_progress: { error: new Error("boom") },
      }),
    );
    const response = await onRequestPost(context(completedBody));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("SERVER_ERROR");
    expect(body.error.message).toBe("Failed to find module progress ID for returning status data");
  });

  it("returns 500 when the stage progress is missing after completion", async () => {
    vi.mocked(createServiceSupabase).mockReturnValueOnce(
      supabaseWith({
        e_content: { data: { modules_content_id: "mc-1" } },
        user_stage_progress: { data: null },
      }),
    );
    const response = await onRequestPost(context(completedBody));
    expect(response.status).toBe(500);
  });

  it("returns 500 when the module progress lookup errors after completion", async () => {
    vi.mocked(createServiceSupabase).mockReturnValueOnce(
      supabaseWith({
        e_content: { data: { modules_content_id: "mc-1" } },
        user_stage_progress: { data: { user_module_progress_id: "ump-1" } },
        user_module_progress: { error: new Error("boom") },
      }),
    );
    const response = await onRequestPost(context(completedBody));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.message).toBe("Failed to fetch updated progress counters");
  });

  it("returns 500 when the module progress is missing after completion", async () => {
    vi.mocked(createServiceSupabase).mockReturnValueOnce(
      supabaseWith({
        e_content: { data: { modules_content_id: "mc-1" } },
        user_stage_progress: { data: { user_module_progress_id: "ump-1" } },
        user_module_progress: { data: null },
      }),
    );
    const response = await onRequestPost(context(completedBody));
    expect(response.status).toBe(500);
  });

  it("records in-progress stage updates via upsertStageProgress", async () => {
    vi.mocked(upsertStageProgress).mockResolvedValueOnce({
      stageProgressId: "sp-1",
      stagesCompleted: 1,
      completionPercentage: 17,
    });
    const supabase = supabaseWith({});
    vi.mocked(createServiceSupabase).mockReturnValueOnce(supabase);

    const response = await onRequestPost(
      context({ eContentId, stageName: "engage", status: "in_progress" }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      success: true,
      stageProgressId: "sp-1",
      stagesCompleted: 1,
      completionPercentage: 17,
      xpAwarded: 0,
      totalXp: 0,
      levelCompleted: false,
      levelXpAwarded: 0,
      xpCategory: "evidence",
    });
    expect(upsertStageProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        read: expect.any(Function),
        insert: expect.any(Function),
        update: expect.any(Function),
        upsert: expect.any(Function),
        delete: expect.any(Function),
        rpc: expect.any(Function),
      }),
      "user-1",
      "level-1",
      1,
      eContentId,
      "engage",
      "in_progress",
      undefined,
    );
  });

  it("returns 500 when upsertStageProgress throws an Error", async () => {
    vi.mocked(upsertStageProgress).mockRejectedValueOnce(new Error("Something broke"));
    const response = await onRequestPost(
      context({ eContentId, stageName: "engage", status: "in_progress" }),
    );
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("SERVER_ERROR");
    expect(body.error.message).toBe("Something broke");
  });

  it("returns 500 with a generic message for non-Error throws", async () => {
    vi.mocked(awardXp).mockRejectedValueOnce("boom-string");
    vi.mocked(createServiceSupabase).mockReturnValueOnce(
      supabaseWith({ e_content: { data: { modules_content_id: "mc-1" } } }),
    );
    const response = await onRequestPost(context(completedBody));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.message).toBe("Internal server error");
  });
});
