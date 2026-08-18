import type { UserCapability } from "@functions/api/v1/capabilities/types";
import { describe, expect, it } from "vitest";
import { mapCapabilitiesToSyncPayload } from "../sync/payload";
import type { SyncCapability, UserLevelProgress } from "../types";

type CapabilityInput = UserCapability & {
  totalModules?: number;
  completedModules?: number;
  levels?: UserLevelProgress[];
};

const capability = (overrides: Partial<CapabilityInput> = {}): CapabilityInput => ({
  id: "cap-1",
  name: "Voice AI",
  description: "Build voice agents",
  code: "voice-ai",
  status: "in_progress",
  currentLevel: 2,
  totalLevels: 5,
  durationHours: 12,
  progress: 40,
  level: "b2",
  roleName: "AI Engineer",
  ...overrides,
});

const mapOne = async (source: UserCapability, url?: string): Promise<SyncCapability> => {
  const [mapped] = await mapCapabilitiesToSyncPayload([source], url);
  if (!mapped) throw new Error("expected at least one mapped capability");
  return mapped;
};

describe("mapCapabilitiesToSyncPayload", () => {
  it("maps every field onto the sync payload shape", async () => {
    const mapped = await mapOne(capability(), "https://lte.test");
    expect(mapped).toMatchObject({
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
      resumeUrl: "https://lte.test/my-courses/voice-ai",
    });
    expect(mapped.fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it("carries module totals and the per-level progress ladder", async () => {
    const mapped = await mapOne(
      capability({
        totalModules: 12,
        completedModules: 4,
        levels: [
          {
            id: "lvl-1",
            code: "L1",
            title: "Foundation",
            status: "completed",
            completionPercentage: 100,
            totalModules: 2,
            completedModules: 2,
            modules: [
              {
                id: "mod-1",
                title: "Intro to Evidence",
                status: "completed",
                completionPercentage: 100,
              },
            ],
          },
          {
            id: "lvl-2",
            code: "L2",
            title: "Advanced",
            status: "in_progress",
            completionPercentage: 50,
            totalModules: 2,
            completedModules: 1,
            modules: [
              {
                id: "mod-2",
                title: "Surveillance Review",
                status: "in_progress",
                completionPercentage: 50,
              },
            ],
          },
        ],
      }),
      "https://lte.test",
    );
    expect(mapped.totalModules).toBe(12);
    expect(mapped.completedModules).toBe(4);
    expect(mapped.levels).toEqual([
      {
        id: "lvl-1",
        code: "L1",
        title: "Foundation",
        status: "completed",
        completionPercentage: 100,
        totalModules: 2,
        completedModules: 2,
        modules: [
          {
            id: "mod-1",
            title: "Intro to Evidence",
            status: "completed",
            completionPercentage: 100,
          },
        ],
      },
      {
        id: "lvl-2",
        code: "L2",
        title: "Advanced",
        status: "in_progress",
        completionPercentage: 50,
        totalModules: 2,
        completedModules: 1,
        modules: [
          {
            id: "mod-2",
            title: "Surveillance Review",
            status: "in_progress",
            completionPercentage: 50,
          },
        ],
      },
    ]);
  });

  it("maps xp, target level (from required level) and priority when present", async () => {
    const mapped = await mapOne(
      capability({ xp: 2400, level: "L4", priority: "Core" }),
      "https://lte.test",
    );
    expect(mapped.xp).toBe(2400);
    expect(mapped.targetLevel).toBe("L4");
    expect(mapped.priority).toBe("Core");
  });

  it("leaves xp, target level and priority undefined when absent", async () => {
    const mapped = await mapOne(
      capability({ xp: undefined, level: undefined, priority: undefined }),
    );
    expect(mapped.xp).toBeUndefined();
    expect(mapped.targetLevel).toBeUndefined();
    expect(mapped.priority).toBeUndefined();
  });

  it("omits levels when the capability has no published levels", async () => {
    const mapped = await mapOne(capability({ levels: undefined }));
    expect(mapped.levels).toBeUndefined();
    expect(mapped.totalModules).toBe(0);
    expect(mapped.completedModules).toBe(0);
  });

  it("strips trailing slashes from the public base URL", async () => {
    expect((await mapOne(capability(), "https://lte.test///")).resumeUrl).toBe(
      "https://lte.test/my-courses/voice-ai",
    );
  });

  it("URL-encodes the capability code inside the deep link", async () => {
    expect((await mapOne(capability({ code: "voice ai" }), "https://lte.test")).resumeUrl).toBe(
      "https://lte.test/my-courses/voice%20ai",
    );
  });

  it("falls back to the capability id when code is missing", async () => {
    const mapped = await mapOne(capability({ code: undefined }), "https://lte.test");
    expect(mapped.resumeUrl).toBe("https://lte.test/my-courses/cap-1");
    expect(mapped.code).toBeUndefined();
  });

  it("omits resumeUrl when no public URL is configured", async () => {
    expect((await mapOne(capability())).resumeUrl).toBeUndefined();
  });

  it("omits resumeUrl when the base URL is only slashes", async () => {
    expect((await mapOne(capability(), "///")).resumeUrl).toBeUndefined();
  });

  it("handles an empty capabilities list", async () => {
    expect(await mapCapabilitiesToSyncPayload([])).toEqual([]);
  });

  it("leaves optional fields undefined when absent on the source", async () => {
    const mapped = await mapOne(capability({ code: undefined, roleName: undefined }));
    expect(mapped.code).toBeUndefined();
    expect(mapped.roleName).toBeUndefined();
  });

  it("returns the exact SyncCapability shape for every entry", async () => {
    const results = await mapCapabilitiesToSyncPayload(
      [capability(), capability({ id: "cap-2", name: "RAG", code: "rag" })],
      "https://lte.test",
    );
    expect(results).toHaveLength(2);
    expect(results[1]?.id).toBe("cap-2");
    expect(results[1]?.resumeUrl).toBe("https://lte.test/my-courses/rag");
    expect(results[1]?.fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });
});
