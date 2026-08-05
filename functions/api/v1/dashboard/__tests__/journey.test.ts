import {
  getCapabilitiesByRoleId,
  getLevelsForCapability,
} from "@functions/api/v1/capabilities/queries";
import { getLevelWithModules } from "@functions/api/v1/courses/queries";
import { getActiveLearningTrack } from "@functions/api/v1/learning-paths/queries";
import { AuthError, requireAuth } from "@functions/lib/auth";
import { createServiceSupabase } from "@functions/lib/supabase";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import type { AuthUser } from "@rareminds-eym/auth-core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { onRequestGet } from "../journey";

vi.mock("@functions/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@functions/lib/auth")>();
  return { ...actual, requireAuth: vi.fn() };
});

vi.mock("@functions/lib/supabase", () => ({ createServiceSupabase: vi.fn() }));

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

const MOCK_TRACK = {
  learningTrackId: "track-1",
  track: "Backend",
  fit: "high",
  matchScore: 80,
  whyItFits: "",
  roles: [{ roleId: "role-1", roleName: "Developer", learningPathId: "path-1" }],
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

function chainable(data: unknown) {
  const chain = {
    select: vi.fn().mockImplementation(() => chain),
    eq: vi.fn().mockImplementation(() => chain),
    in: vi.fn().mockImplementation(() => chain),
    order: vi.fn().mockImplementation(() => chain),
    limit: vi.fn().mockImplementation(() => chain),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
    // biome-ignore lint/suspicious/noThenProperty: thenable mock so awaited builder chains resolve
    then: vi
      .fn()
      .mockImplementation((resolve) => Promise.resolve({ data, error: null }).then(resolve)),
  };
  return chain;
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

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when requireAuth throws", async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new AuthError("Missing token", "UNAUTHORIZED"));
    const response = await onRequestGet({
      request: new Request("http://localhost"),
      env: {} as LteEnv,
    } as PagesContext<LteEnv>);
    expect(response.status).toBe(401);
  });

  it("returns data: null when the user has no active track", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser);
    vi.mocked(getActiveLearningTrack).mockResolvedValueOnce(null);
    vi.mocked(createServiceSupabase).mockReturnValueOnce({} as SupabaseClient);
    const response = await onRequestGet({
      request: new Request("http://localhost"),
      env: {} as LteEnv,
    } as PagesContext<LteEnv>);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, data: null });
  });

  it("returns the current module journey from the first open level", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser);
    vi.mocked(getActiveLearningTrack).mockResolvedValueOnce(MOCK_TRACK);
    vi.mocked(getLevelWithModules).mockResolvedValueOnce(MOCK_DETAILS);
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "user_capability_level_progress") {
          return chainable([{ level_id: "lvl-1", status: "in_progress" }]);
        }
        if (table === "modules_content") return chainable([{ id: "mc-1" }]);
        if (table === "module_artifacts") return chainable([{ id: "art-1" }]);
        if (table === "artifact_questions")
          return chainable({ id: "q-1", title: "Root-cause analysis artifact" });
        return chainable(null);
      }),
    };
    vi.mocked(createServiceSupabase).mockReturnValueOnce(mockSupabase as unknown as SupabaseClient);

    const response = await onRequestGet({
      request: new Request("http://localhost"),
      env: {} as LteEnv,
    } as PagesContext<LteEnv>);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual({
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
    });
  });

  it("falls back to module description and level description when no artifact question exists", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser);
    vi.mocked(getActiveLearningTrack).mockResolvedValueOnce(MOCK_TRACK);
    vi.mocked(getLevelWithModules).mockResolvedValueOnce({
      ...MOCK_DETAILS,
      modules: MOCK_DETAILS.modules.map((m) =>
        m.moduleNo === 0 ? { ...m, industry_challenge: null } : m,
      ),
    });
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "user_capability_level_progress") {
          return chainable([{ level_id: "lvl-1", status: "in_progress" }]);
        }
        return chainable(null);
      }),
    };
    vi.mocked(createServiceSupabase).mockReturnValueOnce(mockSupabase as unknown as SupabaseClient);

    const response = await onRequestGet({
      request: new Request("http://localhost"),
      env: {} as LteEnv,
    } as PagesContext<LteEnv>);
    const body = await response.json();
    expect(body.data.output).toBe("Module description");
    expect(body.data.whyItMatters).toBe("Level description");
  });

  it("points at the first level when nothing has been started", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser);
    vi.mocked(getActiveLearningTrack).mockResolvedValueOnce(MOCK_TRACK);
    vi.mocked(getCapabilitiesByRoleId).mockResolvedValueOnce([
      { id: "cap-1", name: "Cap", code: "CAP037", description: "Capability description" },
    ]);
    vi.mocked(getLevelsForCapability).mockResolvedValueOnce([{ id: "lvl-1" }] as never);
    vi.mocked(getLevelWithModules).mockResolvedValueOnce(MOCK_DETAILS);
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "user_capability_level_progress") return chainable([]);
        if (table === "modules_content") return chainable(null);
        return chainable(null);
      }),
    };
    vi.mocked(createServiceSupabase).mockReturnValueOnce(mockSupabase as unknown as SupabaseClient);

    const response = await onRequestGet({
      request: new Request("http://localhost"),
      env: {} as LteEnv,
    } as PagesContext<LteEnv>);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.levelId).toBe("lvl-1");
    expect(getLevelsForCapability).toHaveBeenCalledWith(expect.anything(), "cap-1");
  });

  it("returns data: null when all levels are completed", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser);
    vi.mocked(getActiveLearningTrack).mockResolvedValueOnce(MOCK_TRACK);
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "user_capability_level_progress") {
          return chainable([{ level_id: "lvl-1", status: "completed" }]);
        }
        return chainable(null);
      }),
    };
    vi.mocked(createServiceSupabase).mockReturnValueOnce(mockSupabase as unknown as SupabaseClient);

    const response = await onRequestGet({
      request: new Request("http://localhost"),
      env: {} as LteEnv,
    } as PagesContext<LteEnv>);
    const body = await response.json();
    expect(body).toEqual({ success: true, data: null });
  });
});
