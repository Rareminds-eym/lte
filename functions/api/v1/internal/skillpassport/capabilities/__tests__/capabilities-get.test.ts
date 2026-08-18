import { getUserCapabilitiesForRoles } from "@functions/api/v1/capabilities/queries";
import type { UserCapability } from "@functions/api/v1/capabilities/types";
import type { ActiveTrackDetail } from "@functions/api/v1/learning-paths/queries";
import { getActiveLearningTrack } from "@functions/api/v1/learning-paths/queries";
import type { LteEnv } from "@functions/lib/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GatewayContext } from "../../core/types";
import { handleCapabilitiesGet } from "../actions/capabilities-get";
import { getCapabilityModuleSummaries } from "../queries/module-summaries";
import { computeFingerprint } from "../sync/fingerprint";

vi.mock("@functions/api/v1/learning-paths/queries", () => ({
  getActiveLearningTrack: vi.fn(),
}));

vi.mock("@functions/api/v1/capabilities/queries", () => ({
  getUserCapabilitiesForRoles: vi.fn(),
}));

vi.mock("../queries/module-summaries", () => ({
  getCapabilityModuleSummaries: vi.fn(),
}));

vi.mock("@functions/lib/supabase", () => ({
  createServiceSupabase: vi.fn(() => ({ mockClient: true })),
}));

const USER_ID = "11111111-1111-4111-8111-111111111111";

const ctx = {
  env: {
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  } as unknown as LteEnv,
  request: new Request("http://lte.test/api/internal/skillpassport"),
  requestId: "req-1",
  userId: USER_ID,
  origin: "http://lte.test",
} as unknown as GatewayContext;

const track = {
  id: "track-1",
  roles: [{ roleId: "role-1", roleName: "AI Engineer" }],
} as unknown as ActiveTrackDetail;

const capabilities: UserCapability[] = [
  {
    id: "cap-1",
    name: "Voice AI",
    description: "Build voice agents",
    code: "voice-ai",
    status: "in_progress",
    currentLevel: 2,
    totalLevels: 5,
    progress: 40,
    durationHours: 12,
    roleName: "AI Engineer",
  },
];

describe("handleCapabilitiesGet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUserCapabilitiesForRoles).mockResolvedValue(capabilities);
    vi.mocked(getCapabilityModuleSummaries).mockResolvedValue({});
  });

  it("returns an empty list when the learner has no active track", async () => {
    vi.mocked(getActiveLearningTrack).mockResolvedValue(null);

    const result = await handleCapabilitiesGet(ctx, { userId: USER_ID });

    expect(result).toEqual({ ok: true, data: { capabilities: [] } });
    expect(getUserCapabilitiesForRoles).not.toHaveBeenCalled();
  });

  it("returns an empty list when the active track has no roles", async () => {
    vi.mocked(getActiveLearningTrack).mockResolvedValue({
      ...track,
      roles: [],
    });

    const result = await handleCapabilitiesGet(ctx, { userId: USER_ID });

    expect(result).toEqual({ ok: true, data: { capabilities: [] } });
    expect(getUserCapabilitiesForRoles).not.toHaveBeenCalled();
  });

  it("fetches capabilities for the track roles and sync-maps them", async () => {
    vi.mocked(getActiveLearningTrack).mockResolvedValue(track);

    const result = await handleCapabilitiesGet(ctx, { userId: USER_ID });

    const expectedFingerprint = await computeFingerprint(capabilities[0] as UserCapability);
    expect(result).toEqual({
      ok: true,
      data: {
        capabilities: [
          {
            id: "cap-1",
            code: "voice-ai",
            name: "Voice AI",
            description: "Build voice agents",
            status: "in_progress",
            currentLevel: 2,
            totalLevels: 5,
            durationHours: 12,
            totalModules: 0,
            completedModules: 0,
            roleName: "AI Engineer",
            resumeUrl: "http://lte.test/my-courses/voice-ai",
            fingerprint: expectedFingerprint,
          },
        ],
      },
    });
    expect(getActiveLearningTrack).toHaveBeenCalledWith(
      expect.objectContaining({ mockClient: true }),
      USER_ID,
    );
    expect(getUserCapabilitiesForRoles).toHaveBeenCalledWith(
      expect.objectContaining({ mockClient: true }),
      USER_ID,
      ["role-1"],
      [{ roleId: "role-1", roleName: "AI Engineer" }],
    );
  });

  it("deduplicates a capability that maps to multiple roles into one sync entry", async () => {
    vi.mocked(getActiveLearningTrack).mockResolvedValue({
      ...track,
      roles: [
        { roleId: "role-a", roleName: "Role A" },
        { roleId: "role-b", roleName: "Role B" },
      ] as ActiveTrackDetail["roles"],
    });
    // Same capability id, but returned once per role with a different roleName.
    vi.mocked(getUserCapabilitiesForRoles).mockResolvedValue([
      {
        id: "cap-shared",
        name: "Shared Capability",
        description: "shared",
        code: "shared",
        status: "not_started",
        currentLevel: 0,
        totalLevels: 5,
        progress: 0,
        durationHours: 0,
        level: "L2",
        roleName: "Role A",
      },
      {
        id: "cap-shared",
        name: "Shared Capability",
        description: "shared",
        code: "shared",
        status: "not_started",
        currentLevel: 0,
        totalLevels: 5,
        progress: 0,
        durationHours: 0,
        level: "L3",
        roleName: "Role B",
      },
    ]);
    vi.mocked(getCapabilityModuleSummaries).mockResolvedValue({});

    const result = await handleCapabilitiesGet(ctx, { userId: USER_ID });

    expect(result.ok).toBe(true);
    const syncedCaps = (result as { data?: { capabilities?: unknown[] } }).data?.capabilities ?? [];
    expect(syncedCaps).toHaveLength(1); // one row per course, not one per role
    // The higher required-level role wins as the representative.
    expect(syncedCaps[0]).toMatchObject({ id: "cap-shared", roleName: "Role B" });
  });

  it("builds the resumeUrl from the request origin", async () => {
    vi.mocked(getActiveLearningTrack).mockResolvedValue(track);

    const result = await handleCapabilitiesGet(ctx, { userId: USER_ID });

    expect(result).toMatchObject({
      ok: true,
      data: {
        capabilities: [{ resumeUrl: "http://lte.test/my-courses/voice-ai" }],
      },
    });
  });

  it("enriches the capability with the module summary ladder when one exists", async () => {
    vi.mocked(getActiveLearningTrack).mockResolvedValue(track);
    vi.mocked(getCapabilityModuleSummaries).mockResolvedValue({
      "cap-1": {
        totalModules: 5,
        completedModules: 2,
        levels: [
          {
            id: "lvl-1",
            code: "CAP-L1",
            title: "Foundation",
            status: "completed",
            completionPercentage: 100,
            totalModules: 3,
            completedModules: 2,
            modules: [
              { id: "m-1", title: "Intro", status: "completed", completionPercentage: 100 },
            ],
          },
        ],
      },
    });

    const result = await handleCapabilitiesGet(ctx, { userId: USER_ID });

    expect(result.ok).toBe(true);
    const syncedCaps = (result as { data?: { capabilities?: unknown[] } }).data?.capabilities ?? [];
    expect(syncedCaps).toHaveLength(1);
    expect(syncedCaps[0]).toMatchObject({
      id: "cap-1",
      totalModules: 5,
      completedModules: 2,
      levels: [
        {
          id: "lvl-1",
          code: "CAP-L1",
          title: "Foundation",
          status: "completed",
          completionPercentage: 100,
          totalModules: 3,
          completedModules: 2,
          modules: [{ id: "m-1", title: "Intro", status: "completed", completionPercentage: 100 }],
        },
      ],
    });
  });

  it("omits the levels ladder when the capability summary has no levels", async () => {
    vi.mocked(getActiveLearningTrack).mockResolvedValue(track);
    vi.mocked(getCapabilityModuleSummaries).mockResolvedValue({
      "cap-1": { totalModules: 0, completedModules: 0, levels: [] },
    });

    const result = await handleCapabilitiesGet(ctx, { userId: USER_ID });

    expect(result.ok).toBe(true);
    const syncedCaps = (result as { data?: { capabilities?: unknown[] } }).data?.capabilities ?? [];
    expect(syncedCaps).toHaveLength(1);
    expect(syncedCaps[0]).toMatchObject({ id: "cap-1", totalModules: 0, completedModules: 0 });
    // The empty ladder maps to `levels: undefined` in the sync payload.
    expect((syncedCaps[0] as Record<string, unknown>)["levels"]).toBeUndefined();
  });

  it("maps query failures to an INTERNAL_ERROR envelope for the dispatcher", async () => {
    vi.mocked(getActiveLearningTrack).mockRejectedValue(new Error("track query failed"));

    const result = await handleCapabilitiesGet(ctx, { userId: USER_ID });

    expect(result).toEqual({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "track query failed" },
    });
  });
});
