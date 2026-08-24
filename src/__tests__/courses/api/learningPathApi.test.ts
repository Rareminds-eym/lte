import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchActiveLearningPath } from "@/entities/active-learning-path";

function mockFetch(status: number, body: unknown): void {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 404 ? "Not Found" : "Error",
    json: () => Promise.resolve(body),
  });
}

describe("learningPathApi", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("fetchActiveLearningPath", () => {
    it("returns active learning path on success", async () => {
      const trackDetail = {
        learningTrackId: "lt-1",
        track: "Frontend",
        fit: "Strong",
        matchScore: 85,
        whyItFits: "Good match",
        roles: [
          {
            roleId: "role-1",
            roleName: "Frontend Engineer",
            learningPathId: "lp-1",
            readinessScore: 85,
            status: "in_progress",
            updatedAt: "2026-08-11T09:00:00Z",
            metadata: {},
          },
        ],
      };
      mockFetch(200, { success: true, data: trackDetail, needsAssessment: false });
      const result = await fetchActiveLearningPath();
      expect(result).toEqual({ data: trackDetail, needsAssessment: false });
    });

    it("returns null when no active path exists", async () => {
      mockFetch(200, { success: true, data: null, needsAssessment: false });
      const result = await fetchActiveLearningPath();
      expect(result).toEqual({ data: null, needsAssessment: false });
    });

    it("throws on non-ok response", async () => {
      mockFetch(401, { success: false, error: { message: "Unauthorized" } });
      await expect(fetchActiveLearningPath()).rejects.toThrow("Unauthorized");
    });

    it("throws status text when error message is missing", async () => {
      mockFetch(500, {});
      await expect(fetchActiveLearningPath()).rejects.toThrow("API Request failed with status 500");
    });

    it("throws status text when JSON is malformed on error", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: () => Promise.reject(new Error("Invalid JSON")),
      });
      await expect(fetchActiveLearningPath()).rejects.toThrow("API Request failed with status 500");
    });
  });
});
