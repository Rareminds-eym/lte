import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLearningPathStore } from "@/entities/active-learning-path";
import * as learningPathApi from "@/entities/active-learning-path/api/learningPathApi";

vi.mock("@/entities/active-learning-path/api/learningPathApi", () => ({
  fetchActiveLearningPath: vi.fn(),
}));

describe("learningPathStore", () => {
  beforeEach(() => {
    useLearningPathStore.setState({
      activeLearningPath: null,
      activeLearningPathLoading: false,
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
      (learningPathApi.fetchActiveLearningPath as Mock).mockResolvedValue(mockPath);

      await useLearningPathStore.getState().fetchAndSetActiveLearningPath();

      expect(useLearningPathStore.getState().activeLearningPath).toEqual(mockPath);
      expect(useLearningPathStore.getState().activeLearningPathLoading).toBe(false);
      expect(useLearningPathStore.getState().error).toBeNull();
    });

    it("sets activeLearningPath to null when api returns null", async () => {
      (learningPathApi.fetchActiveLearningPath as Mock).mockResolvedValue(null);

      await useLearningPathStore.getState().fetchAndSetActiveLearningPath();

      expect(useLearningPathStore.getState().activeLearningPath).toBeNull();
      expect(useLearningPathStore.getState().activeLearningPathLoading).toBe(false);
      expect(useLearningPathStore.getState().error).toBeNull();
    });

    it("handles fetch failure and records the error message", async () => {
      (learningPathApi.fetchActiveLearningPath as Mock).mockRejectedValue(
        new Error("Failed to reach server"),
      );

      await useLearningPathStore.getState().fetchAndSetActiveLearningPath();

      expect(useLearningPathStore.getState().activeLearningPath).toBeNull();
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
        error: "Some old error",
      });

      useLearningPathStore.getState().clearActiveLearningPath();

      expect(useLearningPathStore.getState().activeLearningPath).toBeNull();
      expect(useLearningPathStore.getState().activeLearningPathLoading).toBe(false);
      expect(useLearningPathStore.getState().error).toBeNull();
    });
  });
});
