import { getActiveLearningTrack } from "@functions/api/v1/learning-paths/queries";
import { syncManagedCatalog } from "@functions/lib/catalog-sync";
import { resolveActiveTrack } from "@functions/lib/learner-track";
import type { QueryGateway } from "@functions/lib/query-gateway";
import { callSkill } from "@functions/lib/skill-gateway";
import type { LteEnv } from "@functions/lib/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@functions/api/v1/learning-paths/queries", () => ({ getActiveLearningTrack: vi.fn() }));
vi.mock("@functions/lib/catalog-sync", () => ({ syncManagedCatalog: vi.fn() }));
vi.mock("@functions/lib/skill-gateway", () => ({ callSkill: vi.fn() }));
const read = vi.fn(),
  rpc = vi.fn(),
  update = vi.fn();
const qb = {
  read,
  rpc,
  update,
  insert: vi.fn(),
  upsert: vi.fn(),
  delete: vi.fn(),
} as unknown as QueryGateway;
const env = {} as LteEnv;
const local = {
  learningTrackId: "track-1",
  track: "Medium",
  fit: "Medium",
  matchScore: 80,
  whyItFits: "Fit",
  roles: [],
  tracks: [],
  overallProgress: 0,
  completionCount: 0,
};
const tracks = ["High", "Medium", "Explore"].map((name) => ({
  attemptId: "attempt-1",
  roleId: `role-${name}`,
  roleName: name,
  trackName: name,
  fit: name,
  matchScore: 80,
  whyItFits: "Fit",
}));
describe("learner track resolution", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    read.mockResolvedValue(null);
    rpc.mockResolvedValue(null);
    vi.mocked(getActiveLearningTrack).mockResolvedValue(null);
    vi.mocked(callSkill).mockResolvedValue({ found: true, tracks });
  });
  it("uses the local selection without calling upstream", async () => {
    vi.mocked(getActiveLearningTrack).mockResolvedValue(local);
    expect(await resolveActiveTrack(qb, env, "learner")).toEqual({
      data: local,
      needsAssessment: false,
    });
    expect(callSkill).not.toHaveBeenCalled();
  });
  it("imports all recommended tracks in one transaction and preserves the selection", async () => {
    vi.mocked(getActiveLearningTrack).mockResolvedValue(local);
    await resolveActiveTrack(qb, env, "learner", { refresh: true });
    expect(rpc).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ functionName: "import_learner_tracks" }),
      { args: { p_user_id: "learner", p_tracks: tracks, p_primary_track: "Medium" } },
    );
    expect(update).not.toHaveBeenCalled();
  });
  it("does not deactivate tracks separately when the atomic import fails", async () => {
    vi.mocked(getActiveLearningTrack).mockResolvedValue(local);
    rpc.mockRejectedValue(new Error("transaction failed"));
    await expect(resolveActiveTrack(qb, env, "learner", { refresh: true })).rejects.toThrow(
      "transaction failed",
    );
    expect(update).not.toHaveBeenCalled();
  });
  it("retains local progress when upstream confirms no assessment", async () => {
    vi.mocked(getActiveLearningTrack).mockResolvedValue(local);
    vi.mocked(callSkill).mockResolvedValue({ found: false });
    expect(await resolveActiveTrack(qb, env, "learner", { refresh: true })).toEqual({
      data: local,
      needsAssessment: false,
    });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("prompts assessment only after a successful absent response", async () => {
    vi.mocked(callSkill).mockResolvedValue({ found: false });
    expect(await resolveActiveTrack(qb, env, "learner")).toEqual({
      data: null,
      needsAssessment: true,
    });
  });
  it.each([
    { bad: true },
    { found: true, tracks: [] },
  ])("rejects incomplete upstream contracts", async (response) => {
    vi.mocked(callSkill).mockResolvedValue(response);
    await expect(resolveActiveTrack(qb, env, "learner")).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("propagates upstream outages", async () => {
    vi.mocked(callSkill).mockRejectedValue(new Error("offline"));
    await expect(resolveActiveTrack(qb, env, "learner")).rejects.toThrow("offline");
  });
  it("keeps the existing catalog-unavailable behavior", async () => {
    vi.mocked(getActiveLearningTrack).mockResolvedValueOnce(null).mockResolvedValue(local);
    vi.mocked(syncManagedCatalog).mockRejectedValue(
      Object.assign(new Error("unavailable"), { code: "CATALOGUE_UNAVAILABLE" }),
    );
    expect((await resolveActiveTrack(qb, env, "learner")).data).toEqual(local);
  });
  it("resolves legacy role names before performing any import writes", async () => {
    vi.mocked(callSkill).mockResolvedValue({
      found: true,
      tracks: [{ ...tracks[0], roleId: undefined, roleName: "A_%" }],
    });
    vi.mocked(getActiveLearningTrack).mockResolvedValueOnce(null).mockResolvedValue(local);
    read
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "matched-role" });
    await resolveActiveTrack(qb, env, "learner");
    expect(rpc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        args: expect.objectContaining({
          p_tracks: [expect.objectContaining({ roleId: "matched-role" })],
        }),
      }),
    );
  });
  it("reactivates an inactive track before contacting upstream", async () => {
    read.mockResolvedValueOnce({ id: "inactive" });
    vi.mocked(getActiveLearningTrack).mockResolvedValueOnce(null).mockResolvedValueOnce(local);
    expect((await resolveActiveTrack(qb, env, "learner")).data).toEqual(local);
    expect(update).toHaveBeenCalled();
    expect(callSkill).not.toHaveBeenCalled();
  });
  it("continues to the gateway when inactive-track lookup fails", async () => {
    read.mockRejectedValueOnce(new Error("lookup failed"));
    vi.mocked(callSkill).mockResolvedValue({ found: false });
    expect((await resolveActiveTrack(qb, env, "learner")).needsAssessment).toBe(true);
  });
  it("surfaces a missing post-import track as a failure", async () => {
    await expect(resolveActiveTrack(qb, env, "learner")).rejects.toThrow("could not be loaded");
  });
});
