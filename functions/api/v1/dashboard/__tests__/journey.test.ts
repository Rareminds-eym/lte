import {
  getCapabilitiesByRoleId,
  getLevelsForCapability,
} from "@functions/api/v1/capabilities/queries";
import { getLevelWithModules } from "@functions/api/v1/courses/queries";
import type { ActiveTrackDetail } from "@functions/api/v1/learning-paths/queries";
import { getActiveLearningTrack } from "@functions/api/v1/learning-paths/queries";
import { createQueryGateway, createServiceQueryGateway } from "@functions/lib/query-gateway";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { AuthError, requireAuth } from "@functions/middleware";
import type { AuthUser } from "@rareminds-eym/auth-core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { onRequestGet } from "../journey";

vi.mock("@functions/middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@functions/middleware")>();
  return { ...actual, requireAuth: vi.fn() };
});

vi.mock("@functions/lib/query-gateway", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@functions/lib/query-gateway")>();
  return { ...actual, createServiceQueryGateway: vi.fn() };
});

vi.mock("@functions/api/v1/learning-paths/queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@functions/api/v1/learning-paths/queries")>();
  return { ...actual, getActiveLearningTrack: vi.fn() };
});

vi.mock("@functions/api/v1/capabilities/queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@functions/api/v1/capabilities/queries")>();
  return { ...actual, getCapabilitiesByRoleId: vi.fn(), getLevelsForCapability: vi.fn() };
});

vi.mock("@functions/api/v1/courses/queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@functions/api/v1/courses/queries")>();
  return { ...actual, getLevelWithModules: vi.fn() };
});

const MOCK_TRACK: ActiveTrackDetail = {
  learningTrackId: "track-1",
  track: "Backend",
  fit: "high",
  matchScore: 80,
  whyItFits: "",
  roles: [
    {
      roleId: "role-1",
      roleName: "Developer",
      learningPathId: "path-1",
      readinessScore: 0,
      status: "not_started",
      updatedAt: null,
    },
  ],
  tracks: [],
  overallProgress: 0,
  completionCount: 0,
};

const MOCK_DETAILS = {
  id: "lvl-1",
  levelCode: "CAP037_L1",
  capabilityCode: "CAP037",
  capabilityName: "Support exchange handoffs",
  title: "Recognise and Safely Inspect GenAI Workflows",
  description: "Level description",
  levelProblemStatement: { title: "", description: "" },
  observableBehavior: null,
  exampleOutputs: null,
  durationMinutes: 120,
  levelLabel: "Foundation",
  difficultyLevel: "foundation",
  levelStatus: "published",
  versionNo: 1,
  artifactsCount: 1,
  modules: [
    {
      id: "mod-1",
      moduleNo: 0,
      title: "Before You Trust the Answer",
      description: "Module description",
      isPublished: true,
      progressPercentage: 67,
      isCompleted: false,
      completedStages: ["engage", "explore", "explain", "express"],
      industry_challenge: "Northstar Retail needs a safe review handoff.",
    },
    {
      id: "mod-2",
      moduleNo: 1,
      title: "The Next Module",
      description: "Next module description",
      isPublished: true,
      progressPercentage: 0,
      isCompleted: false,
      completedStages: [],
      industry_challenge: null,
    },
  ],
};

/**
 * Chainable supabase mock resolving queued `{ data }` results in call order:
 * findOpenLevel's level query (then), its module query (maybeSingle),
 * then findArtifactOutput's modules_content query (then).
 * Queue `{ data: null }` for queries that should find nothing.
 */
function queuedSupabase(results: unknown[]) {
  const queue = [...results];
  const chain = {
    select: vi.fn().mockImplementation(() => chain),
    eq: vi.fn().mockImplementation(() => chain),
    in: vi.fn().mockImplementation(() => chain),
    not: vi.fn().mockImplementation(() => chain),
    order: vi.fn().mockImplementation(() => chain),
    limit: vi.fn().mockImplementation(() => chain),
    maybeSingle: vi
      .fn()
      .mockImplementation(() => Promise.resolve(queue.shift() ?? { data: null, error: null })),
    // biome-ignore lint/suspicious/noThenProperty: thenable mock so awaited builder chains resolve
    then: vi
      .fn()
      .mockImplementation((resolve) =>
        Promise.resolve(queue.shift() ?? { data: null, error: null }).then(resolve),
      ),
  };
  return { from: vi.fn().mockImplementation(() => chain) };
}

function queuedGateway(results: unknown[]) {
  return createQueryGateway(queuedSupabase(results) as unknown as SupabaseClient);
}

describe("GET /api/v1/dashboard/journey", () => {
  const mockUser: AuthUser = {
    sub: "user-uuid-1234",
    email: "learner@rareminds.com",
    org_id: "org-1",
    roles: ["learner"],
    products: ["lte"],
    membership_status: "active",
    is_email_verified: true,
  };

  const makeContext = () =>
    ({
      request: new Request("http://localhost/api/v1/dashboard/journey"),
      params: {},
      env: {} as LteEnv,
    }) as PagesContext<LteEnv>;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(createServiceQueryGateway).mockReturnValue(queuedGateway([]));
  });

  it("returns 401 when requireAuth throws", async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new AuthError("Missing token", "UNAUTHORIZED"));
    const response = await onRequestGet(makeContext());
    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns no_track when the user has no active track", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser);
    vi.mocked(getActiveLearningTrack).mockResolvedValueOnce(null);
    const response = await onRequestGet(makeContext());
    const body = (await response.json()) as {
      success: boolean;
      data: null;
      state: string;
    };
    expect(body).toEqual({ success: true, data: null, state: "no_track" });
  });

  it("returns the most recently active module of the most recent level", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser);
    vi.mocked(getActiveLearningTrack).mockResolvedValueOnce(MOCK_TRACK);
    vi.mocked(createServiceQueryGateway).mockReturnValue(
      queuedGateway([
        {
          data: [
            {
              id: "lvlp-1",
              level_id: "lvl-1",
              status: "in_progress",
              updated_at: "2026-08-05T11:35:35Z",
            },
            {
              id: "lvlp-2",
              level_id: "lvl-2",
              status: "in_progress",
              updated_at: "2026-08-06T04:03:16Z",
            },
          ],
        },
        { data: { module_id: "mod-1", user_capability_level_progress_id: "lvlp-1" } },
        {
          data: [
            {
              id: "content-1",
              module_artifacts: [
                {
                  artifact_questions: [
                    { title: "Root-cause analysis artifact", question_order: 0 },
                  ],
                },
              ],
            },
          ],
        },
      ]),
    );
    vi.mocked(getLevelWithModules).mockResolvedValueOnce(MOCK_DETAILS);

    const response = await onRequestGet(makeContext());
    const body = (await response.json()) as {
      success: boolean;
      state: string;
      data: {
        levelId: string;
        capabilityCode: string;
        capability: string;
        title: string;
        moduleInfo: string;
        output: string;
        whyItMatters: string;
        progressPercentage: number;
        completedCount: number;
        inProgressCount: number;
        remainingCount: number;
        moduleNo: number;
      };
    };

    // lvl-2 was updated later, but the user's last activity lives in lvl-1's module
    expect(body).toEqual({
      success: true,
      state: "active",
      data: {
        levelId: "lvl-1",
        capabilityCode: "CAP037",
        capability: "Support exchange handoffs",
        title: "Before You Trust the Answer",
        moduleInfo: "Module 1 of 2",
        output: "Root-cause analysis artifact",
        whyItMatters: "Northstar Retail needs a safe review handoff.",
        progressPercentage: 34,
        completedCount: 0,
        inProgressCount: 1,
        remainingCount: 1,
        moduleNo: 0,
      },
    });
    expect(getLevelWithModules).toHaveBeenCalledWith(
      expect.anything(),
      "lvl-1",
      mockUser.sub,
      false,
    );
  });

  it("ignores module activity outside the track's levels", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser);
    vi.mocked(getActiveLearningTrack).mockResolvedValueOnce(MOCK_TRACK);
    vi.mocked(createServiceQueryGateway).mockReturnValue(
      queuedGateway([
        {
          data: [
            {
              id: "lvlp-1",
              level_id: "lvl-1",
              status: "in_progress",
              updated_at: "2026-08-05T11:35:35Z",
            },
          ],
        },
        // module row references a progress id that is NOT among the open levels
        { data: { module_id: "mod-x", user_capability_level_progress_id: "other-path-lvlp" } },
        { data: null },
      ]),
    );
    vi.mocked(getLevelWithModules).mockResolvedValueOnce(MOCK_DETAILS);

    const response = await onRequestGet(makeContext());
    const body = (await response.json()) as { data: { levelId: string } };
    expect(body.data.levelId).toBe("lvl-1");
  });

  it("falls back to the most recently updated level when no module is in progress", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser);
    vi.mocked(getActiveLearningTrack).mockResolvedValueOnce(MOCK_TRACK);
    vi.mocked(createServiceQueryGateway).mockReturnValue(
      queuedGateway([
        {
          data: [
            {
              id: "lvlp-1",
              level_id: "lvl-1",
              status: "in_progress",
              updated_at: "2026-08-05T11:35:35Z",
            },
            {
              id: "lvlp-2",
              level_id: "lvl-2",
              status: "in_progress",
              updated_at: "2026-08-06T04:03:16Z",
            },
          ],
        },
        { data: null },
        { data: null },
      ]),
    );
    vi.mocked(getLevelWithModules).mockResolvedValueOnce({
      ...MOCK_DETAILS,
      id: "lvl-2",
      modules: MOCK_DETAILS.modules,
    });

    const response = await onRequestGet(makeContext());
    const body = (await response.json()) as { data: { levelId: string } };
    expect(body.data.levelId).toBe("lvl-2");
  });

  it("points at the first level of the track's first capability when nothing is started", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser);
    vi.mocked(getActiveLearningTrack).mockResolvedValueOnce(MOCK_TRACK);
    vi.mocked(createServiceQueryGateway).mockReturnValue(
      queuedGateway([{ data: [] }, { data: null }]),
    );
    vi.mocked(getCapabilitiesByRoleId).mockResolvedValueOnce([
      { id: "cap-1", name: "Cap", code: "CAP037", description: "Capability description" },
    ]);
    vi.mocked(getLevelsForCapability).mockResolvedValueOnce([
      { id: "lvl-1", levelCode: "CAP037_L1", levelNumber: 1 },
    ] as never);
    vi.mocked(getLevelWithModules).mockResolvedValueOnce(MOCK_DETAILS);

    const response = await onRequestGet(makeContext());
    const body = (await response.json()) as { data: { levelId: string } };
    expect(body.data.levelId).toBe("lvl-1");
    expect(getLevelsForCapability).toHaveBeenCalledWith(expect.anything(), "cap-1");
  });

  it("returns completed when every level row in the track is completed", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser);
    vi.mocked(getActiveLearningTrack).mockResolvedValueOnce(MOCK_TRACK);
    vi.mocked(createServiceQueryGateway).mockReturnValue(
      queuedGateway([
        {
          data: [
            {
              id: "lvlp-1",
              level_id: "lvl-1",
              status: "completed",
              updated_at: "2026-08-05T11:35:35Z",
            },
          ],
        },
      ]),
    );

    const response = await onRequestGet(makeContext());
    const body = (await response.json()) as { success: boolean; data: null; state: string };
    expect(body).toEqual({ success: true, data: null, state: "completed" });
  });

  it("falls back to module description and level description when no artifact question exists", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser);
    vi.mocked(getActiveLearningTrack).mockResolvedValueOnce(MOCK_TRACK);
    vi.mocked(createServiceQueryGateway).mockReturnValue(
      queuedGateway([
        {
          data: [
            {
              id: "lvlp-1",
              level_id: "lvl-1",
              status: "in_progress",
              updated_at: "2026-08-06T04:03:16Z",
            },
          ],
        },
        { data: null },
        { data: null },
      ]),
    );
    vi.mocked(getLevelWithModules).mockResolvedValueOnce({
      ...MOCK_DETAILS,
      modules: MOCK_DETAILS.modules.map((m) =>
        m.moduleNo === 0 ? { ...m, industry_challenge: null } : m,
      ),
    });

    const response = await onRequestGet(makeContext());
    const body = (await response.json()) as {
      data: { output: string; whyItMatters: string };
    };
    expect(body.data.output).toBe("Module description");
    expect(body.data.whyItMatters).toBe("Level description");
  });
});
