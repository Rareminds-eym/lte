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
      activeTrack: null,
      activeLearningPathLoading: false,
      needsAssessment: false,
      error: null,
    });
    vi.clearAllMocks();
  });

  describe("fetchAndSetActiveLearningPath", () => {
    it("fetches and stores active learning track on success", async () => {
      const mockTrack = {
        learningTrackId: "lt-1",
        track: "Frontend Development",
        fit: "High",
        matchScore: 92,
        whyItFits: "Good fit.",
        roles: [
          {
            roleId: "role-1",
            roleName: "Frontend Developer",
            learningPathId: "lp-1",
          },
        ],
      };
      (learningPathApi.fetchActiveLearningPath as Mock).mockResolvedValue({
        data: mockTrack,
        needsAssessment: false,
      });

      await useLearningPathStore.getState().fetchAndSetActiveLearningPath(testUserId);

      expect(useLearningPathStore.getState().activeTrack).toEqual(mockTrack);
      expect(useLearningPathStore.getState().needsAssessment).toBe(false);
      expect(useLearningPathStore.getState().activeLearningPathLoading).toBe(false);
      expect(useLearningPathStore.getState().error).toBeNull();
    });

    it("sets activeTrack to null and flags needsAssessment when api returns no path", async () => {
      (learningPathApi.fetchActiveLearningPath as Mock).mockResolvedValue({
        data: null,
        needsAssessment: true,
      });

      await useLearningPathStore.getState().fetchAndSetActiveLearningPath(testUserId);

      expect(useLearningPathStore.getState().activeTrack).toBeNull();
      expect(useLearningPathStore.getState().needsAssessment).toBe(true);
      expect(useLearningPathStore.getState().activeLearningPathLoading).toBe(false);
      expect(useLearningPathStore.getState().error).toBeNull();
    });

    it("handles fetch failure and records the error message", async () => {
      (learningPathApi.fetchActiveLearningPath as Mock).mockRejectedValue(
        new Error("Failed to reach server"),
      );

      await useLearningPathStore.getState().fetchAndSetActiveLearningPath(testUserId);

      expect(useLearningPathStore.getState().activeTrack).toBeNull();
      expect(useLearningPathStore.getState().needsAssessment).toBe(false);
      expect(useLearningPathStore.getState().activeLearningPathLoading).toBe(false);
      expect(useLearningPathStore.getState().error).toBe("Failed to reach server");
    });

    it("ignores fetch results if user changes during active fetch", async () => {
      let resolveFetch: (val: unknown) => void = () => {};
      const fetchPromise = new Promise((resolve) => {
        resolveFetch = resolve;
      });
      (learningPathApi.fetchActiveLearningPath as Mock).mockReturnValueOnce(fetchPromise);

      const promise = useLearningPathStore.getState().fetchAndSetActiveLearningPath("user-1");

      // Simulate user switching midway
      useLearningPathStore.setState({ userId: "user-2" });

      resolveFetch({
        data: { learningTrackId: "lt-new" },
        needsAssessment: false,
      });

      await promise;

      // Verify that the new track data was ignored
      expect(useLearningPathStore.getState().activeTrack).toBeNull();
    });

    it("ignores fetch errors if user changes during active fetch error", async () => {
      let rejectFetch: (err: Error) => void = () => {};
      const fetchPromise = new Promise((_, reject) => {
        rejectFetch = reject;
      });
      (learningPathApi.fetchActiveLearningPath as Mock).mockReturnValueOnce(fetchPromise);

      const promise = useLearningPathStore.getState().fetchAndSetActiveLearningPath("user-1");

      // Simulate user switching midway
      useLearningPathStore.setState({ userId: "user-2" });

      rejectFetch(new Error("Timeout error"));

      await promise;

      // Verify that error is not stored since user changed
      expect(useLearningPathStore.getState().error).toBeNull();
    });
  });

  describe("clearActiveLearningPath", () => {
    it("resets learning path state to default values", () => {
      useLearningPathStore.setState({
        activeTrack: {
          learningTrackId: "lt-1",
          track: "",
          fit: "",
          matchScore: 0,
          whyItFits: "",
          roles: [],
        },
        activeLearningPathLoading: true,
        needsAssessment: true,
        error: "Some old error",
      });

      useLearningPathStore.getState().clearActiveLearningPath();

      expect(useLearningPathStore.getState().activeTrack).toBeNull();
      expect(useLearningPathStore.getState().activeLearningPathLoading).toBe(false);
      expect(useLearningPathStore.getState().needsAssessment).toBe(false);
      expect(useLearningPathStore.getState().error).toBeNull();
    });
  });
});
