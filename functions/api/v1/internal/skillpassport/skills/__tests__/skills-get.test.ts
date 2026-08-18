import { getCapabilitiesByRoleId } from "@functions/api/v1/capabilities/queries";
import type { ActiveTrackDetail } from "@functions/api/v1/learning-paths/queries";
import { getActiveLearningTrack } from "@functions/api/v1/learning-paths/queries";
import type { LteEnv } from "@functions/lib/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GatewayContext } from "../../../core/types";
import { handleSkillsGet } from "../actions/skills-get";
import { getSkillsForUser, type SkillWithContext } from "../queries/get-skills";

vi.mock("@functions/api/v1/learning-paths/queries", () => ({
  getActiveLearningTrack: vi.fn(),
}));

vi.mock("@functions/api/v1/capabilities/queries", () => ({
  getCapabilitiesByRoleId: vi.fn(),
}));

vi.mock("../queries/get-skills", () => ({
  getSkillsForUser: vi.fn(),
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

const skills: SkillWithContext[] = [
  {
    id: "skill-1",
    code: "SK-001",
    name: "Classify Work Objects",
    description: "Classify GenAI workflow objects",
    tags: ["classify"],
    levelId: "lvl-1",
    levelCode: "CAP-L1",
    levelTitle: "Foundation",
    capabilityId: "cap-1",
    capabilityCode: "CAP",
    capabilityName: "Capability One",
    levelStatus: "completed",
    completedAt: "2026-08-13T05:11:42Z",
  },
];

describe("handleSkillsGet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCapabilitiesByRoleId).mockResolvedValue([{ id: "cap-1" } as never]);
    vi.mocked(getSkillsForUser).mockResolvedValue(skills);
  });

  it("returns an empty list when the learner has no active track", async () => {
    vi.mocked(getActiveLearningTrack).mockResolvedValue(null);

    const result = await handleSkillsGet(ctx, { userId: USER_ID });

    expect(result).toEqual({ ok: true, data: { skills: [] } });
    expect(getSkillsForUser).not.toHaveBeenCalled();
  });

  it("returns an empty list when the active track has no roles", async () => {
    vi.mocked(getActiveLearningTrack).mockResolvedValue({
      ...track,
      roles: [],
    } as never);

    const result = await handleSkillsGet(ctx, { userId: USER_ID });

    expect(result).toEqual({ ok: true, data: { skills: [] } });
    expect(getSkillsForUser).not.toHaveBeenCalled();
  });

  it("fetches skills for the track roles' capability ids and sync-maps them", async () => {
    vi.mocked(getActiveLearningTrack).mockResolvedValue(track);

    const result = await handleSkillsGet(ctx, { userId: USER_ID });

    expect(result.ok).toBe(true);
    const synced = (result as { data?: { skills?: unknown[] } }).data?.skills ?? [];
    expect(synced).toHaveLength(1);
    expect(synced[0]).toMatchObject({ id: "skill-1", name: "Classify Work Objects" });
    expect(getCapabilitiesByRoleId).toHaveBeenCalledWith(
      expect.objectContaining({ mockClient: true }),
      "role-1",
    );
    expect(getSkillsForUser).toHaveBeenCalledWith(
      expect.objectContaining({ mockClient: true }),
      USER_ID,
      ["cap-1"],
    );
  });

  it("returns an empty list when no capabilities resolve for the roles", async () => {
    vi.mocked(getActiveLearningTrack).mockResolvedValue(track);
    vi.mocked(getCapabilitiesByRoleId).mockResolvedValue([]);

    const result = await handleSkillsGet(ctx, { userId: USER_ID });

    expect(result).toEqual({ ok: true, data: { skills: [] } });
    expect(getSkillsForUser).not.toHaveBeenCalled();
  });

  it("maps query failures to an INTERNAL_ERROR envelope for the dispatcher", async () => {
    vi.mocked(getActiveLearningTrack).mockRejectedValue(new Error("track query failed"));

    const result = await handleSkillsGet(ctx, { userId: USER_ID });

    expect(result).toEqual({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "track query failed" },
    });
  });
});
