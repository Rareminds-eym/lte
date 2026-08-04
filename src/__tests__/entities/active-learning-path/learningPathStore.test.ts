import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLearningPathStore } from "@/entities/active-learning-path";
import * as learningPathApi from "@/entities/active-learning-path/api/learningPathApi";

vi.mock("@/entities/active-learning-path/api/learningPathApi", () => ({
  fetchActiveLearningPath: vi.fn(),
}));

describe("learningPathStore", () => {
  const testUserId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    useLearningPathStore.setState({
      activeLearningPath: null,
      activeLearningPathLoading: false,
      needsAssessment: false,
      error: null,
    });
    vi.clearAllMocks();
  });

  describe("fetchAndSetActiveLearningPath", () => {
    it("fetches and stores active learning path on success", async () => {
      const mockPath = {
        learningPathId: "lp-1",
        learningTrackId: "lt-1",
        roleId: "role-1",
        track: "Frontend Development",
        fit: "High",
        matchScore: 92,
      };
      (learningPathApi.fetchActiveLearningPath as Mock).mockResolvedValue({
        data: mockPath,
        needsAssessment: false,
      });

      await useLearningPathStore.getState().fetchAndSetActiveLearningPath(testUserId);

      expect(useLearningPathStore.getState().activeLearningPath).toEqual(mockPath);
      expect(useLearningPathStore.getState().needsAssessment).toBe(false);
      expect(useLearningPathStore.getState().activeLearningPathLoading).toBe(false);
      expect(useLearningPathStore.getState().error).toBeNull();
    });

    it("sets activeLearningPath to null and flags needsAssessment when api returns no path", async () => {
      (learningPathApi.fetchActiveLearningPath as Mock).mockResolvedValue({
        data: null,
        needsAssessment: true,
      });

      await useLearningPathStore.getState().fetchAndSetActiveLearningPath(testUserId);

      expect(useLearningPathStore.getState().activeLearningPath).toBeNull();
      expect(useLearningPathStore.getState().needsAssessment).toBe(true);
      expect(useLearningPathStore.getState().activeLearningPathLoading).toBe(false);
      expect(useLearningPathStore.getState().error).toBeNull();
    });

    it("handles fetch failure and records the error message", async () => {
      (learningPathApi.fetchActiveLearningPath as Mock).mockRejectedValue(
        new Error("Failed to reach server"),
      );

      await useLearningPathStore.getState().fetchAndSetActiveLearningPath(testUserId);

      expect(useLearningPathStore.getState().activeLearningPath).toBeNull();
      expect(useLearningPathStore.getState().needsAssessment).toBe(false);
      expect(useLearningPathStore.getState().activeLearningPathLoading).toBe(false);
      expect(useLearningPathStore.getState().error).toBe("Failed to reach server");
    });
  });

  describe("clearActiveLearningPath", () => {
    it("resets learning path state to default values", () => {
      useLearningPathStore.setState({
        activeLearningPath: {
          learningPathId: "lp-1",
          learningTrackId: "lt-1",
          roleId: "role-1",
          track: "",
          fit: "",
          matchScore: 0,
        },
        activeLearningPathLoading: true,
        needsAssessment: true,
        error: "Some old error",
      });

      useLearningPathStore.getState().clearActiveLearningPath();

      expect(useLearningPathStore.getState().activeLearningPath).toBeNull();
      expect(useLearningPathStore.getState().activeLearningPathLoading).toBe(false);
      expect(useLearningPathStore.getState().needsAssessment).toBe(false);
      expect(useLearningPathStore.getState().error).toBeNull();
    });
  });
});
