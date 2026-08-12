import type { UserCapability } from "@functions/api/v1/capabilities/types";
import { describe, expect, it } from "vitest";
import { mapCapabilitiesToSyncPayload, type SyncCapability } from "../payload";

const capability = (overrides: Partial<UserCapability> = {}): UserCapability => ({
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

const mapOne = (source: UserCapability, url?: string): SyncCapability => {
  const [mapped] = mapCapabilitiesToSyncPayload([source], url);
  if (!mapped) throw new Error("expected at least one mapped capability");
  return mapped;
};

describe("mapCapabilitiesToSyncPayload", () => {
  it("maps every field onto the sync payload shape", () => {
    const mapped = mapOne(capability(), "https://lte.test");
    expect(mapped).toEqual({
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
    });
  });

  it("strips trailing slashes from the public base URL", () => {
    expect(mapOne(capability(), "https://lte.test///").resumeUrl).toBe(
      "https://lte.test/my-courses/voice-ai",
    );
  });

  it("URL-encodes the capability code inside the deep link", () => {
    expect(mapOne(capability({ code: "voice ai" }), "https://lte.test").resumeUrl).toBe(
      "https://lte.test/my-courses/voice%20ai",
    );
  });

  it("falls back to the capability id when code is missing", () => {
    const mapped = mapOne(capability({ code: undefined }), "https://lte.test");
    expect(mapped.resumeUrl).toBe("https://lte.test/my-courses/cap-1");
    expect(mapped.code).toBeUndefined();
  });

  it("omits resumeUrl when no public URL is configured", () => {
    expect(mapOne(capability()).resumeUrl).toBeUndefined();
  });

  it("omits resumeUrl when the base URL is only slashes", () => {
    expect(mapOne(capability(), "///").resumeUrl).toBeUndefined();
  });

  it("handles an empty capabilities list", () => {
    expect(mapCapabilitiesToSyncPayload([])).toEqual([]);
  });

  it("leaves optional fields undefined when absent on the source", () => {
    const mapped = mapOne(capability({ code: undefined, roleName: undefined }));
    expect(mapped.code).toBeUndefined();
    expect(mapped.roleName).toBeUndefined();
  });

  it("returns the exact SyncCapability shape for every entry", () => {
    const results = mapCapabilitiesToSyncPayload(
      [capability(), capability({ id: "cap-2", name: "RAG", code: "rag" })],
      "https://lte.test",
    );
    expect(results).toHaveLength(2);
    expect(results[1]?.id).toBe("cap-2");
    expect(results[1]?.resumeUrl).toBe("https://lte.test/my-courses/rag");
  });
});
