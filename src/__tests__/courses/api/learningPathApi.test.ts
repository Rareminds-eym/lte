import { describe, expect, it, vi } from "vitest";
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
  afterEach(() => vi.restoreAllMocks());

  describe("fetchActiveLearningPath", () => {
    it("returns active learning path on success", async () => {
      const path = {
        learningPathId: "lp-1",
        learningTrackId: "lt-1",
        roleId: "role-1",
        track: "Frontend",
        fit: "Strong",
        matchScore: 85,
      };
      mockFetch(200, { success: true, data: path });
      const result = await fetchActiveLearningPath("token");
      expect(result).toEqual(path);
    });

    it("returns null when no active path exists", async () => {
      mockFetch(200, { success: true, data: null });
      const result = await fetchActiveLearningPath("token");
      expect(result).toBeNull();
    });

    it("throws on non-ok response", async () => {
      mockFetch(401, { success: false, error: { message: "Unauthorized" } });
      await expect(fetchActiveLearningPath("bad-token")).rejects.toThrow("Unauthorized");
    });

    it("throws status text when error message is missing", async () => {
      mockFetch(500, {});
      await expect(fetchActiveLearningPath("token")).rejects.toThrow(
        "Request failed with status 500",
      );
    });

    it("throws status text when JSON is malformed on error", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: () => Promise.reject(new Error("Invalid JSON")),
      });
      await expect(fetchActiveLearningPath("token")).rejects.toThrow(
        "Request failed with status 500",
      );
    });
  });
});
