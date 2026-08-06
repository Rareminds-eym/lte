import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  startLevelProgress,
  startModuleProgress,
  updateStageProgress,
} from "@/entities/course/api/progressApi";
import { registerTokenGetter } from "@/shared/api";

function mockFetch(status: number, body: unknown): void {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: "Error",
    json: () => Promise.resolve(body),
  });
}

describe("progressApi", () => {
  beforeEach(() => {
    registerTokenGetter(() => "token");
  });

  afterEach(() => {
    registerTokenGetter(() => null);
    vi.restoreAllMocks();
  });

  describe("startLevelProgress", () => {
    it("calls API correct URL and returns success payload", async () => {
      mockFetch(200, { success: true, levelProgressId: "lvl-prog-123" });
      const res = await startLevelProgress("level-1");
      expect(res).toEqual({ success: true, levelProgressId: "lvl-prog-123" });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/courses/level-1/progress"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ status: "in_progress" }),
        }),
      );
    });
  });

  describe("startModuleProgress", () => {
    it("calls API correct URL and returns success payload", async () => {
      mockFetch(200, { success: true, moduleProgressId: "mod-prog-123" });
      const res = await startModuleProgress("level-1", 2);
      expect(res).toEqual({ success: true, moduleProgressId: "mod-prog-123" });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/courses/level-1/modules/2/progress"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ status: "in_progress" }),
        }),
      );
    });
  });

  describe("updateStageProgress", () => {
    it("calls API correct URL and returns success payload", async () => {
      const mockResponse = {
        success: true,
        stageProgressId: "stage-prog-123",
        stagesCompleted: 2,
        completionPercentage: 33,
        xpAwarded: 10,
        totalXp: 100,
      };
      mockFetch(200, mockResponse);

      const res = await updateStageProgress("level-1", 2, "content-1", "engage", "completed");
      expect(res).toEqual(mockResponse);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/courses/level-1/modules/2/stages/progress"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            eContentId: "content-1",
            stageName: "engage",
            status: "completed",
          }),
        }),
      );
    });

    it("includes duration seconds when tracking content viewing time", async () => {
      const mockResponse = {
        success: true,
        stageProgressId: "stage-prog-123",
        stagesCompleted: 1,
        completionPercentage: 17,
      };
      mockFetch(200, mockResponse);

      await updateStageProgress("level-1", 2, "content-1", "engage", "in_progress", 42);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/courses/level-1/modules/2/stages/progress"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            eContentId: "content-1",
            stageName: "engage",
            status: "in_progress",
            durationSeconds: 42,
          }),
        }),
      );
    });
  });
});
