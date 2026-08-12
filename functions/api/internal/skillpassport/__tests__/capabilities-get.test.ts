import { getUserCapabilitiesForRoles } from "@functions/api/v1/capabilities/queries";
import type { UserCapability } from "@functions/api/v1/capabilities/types";
import type { ActiveTrackDetail } from "@functions/api/v1/learning-paths/queries";
import { getActiveLearningTrack } from "@functions/api/v1/learning-paths/queries";
import type { LteEnv } from "@functions/lib/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleCapabilitiesGet } from "../actions/capabilities-get";
import type { GatewayContext } from "../types";

vi.mock("@functions/api/v1/learning-paths/queries", () => ({
  getActiveLearningTrack: vi.fn(),
}));

vi.mock("@functions/api/v1/capabilities/queries", () => ({
  getUserCapabilitiesForRoles: vi.fn(),
}));

vi.mock("@functions/lib/supabase", () => ({
  createServiceSupabase: vi.fn(() => ({ mockClient: true })),
}));

const USER_ID = "11111111-1111-4111-8111-111111111111";

const ctx = {
  env: {
    LTE_PUBLIC_URL: "https://lte.test/",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  } as unknown as LteEnv,
  request: new Request("http://lte.test/api/internal/skillpassport"),
  requestId: "req-1",
  userId: USER_ID,
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
            roleName: "AI Engineer",
            resumeUrl: "https://lte.test/my-courses/voice-ai",
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

  it("propagates query failures so the dispatcher can map them to 500", async () => {
    vi.mocked(getActiveLearningTrack).mockRejectedValue(new Error("track query failed"));

    await expect(handleCapabilitiesGet(ctx, { userId: USER_ID })).rejects.toThrow(
      "track query failed",
    );
  });
});
