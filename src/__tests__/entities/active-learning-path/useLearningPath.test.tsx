import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { learningPathKey, useLearningPath } from "@/entities/active-learning-path";
import {
  activateLearningTrack,
  fetchActiveLearningPath,
} from "@/entities/active-learning-path/api/learningPathApi";
import { useAuthStore } from "@/entities/session";

vi.mock("@/entities/active-learning-path/api/learningPathApi", () => ({
  activateLearningTrack: vi.fn(),
  fetchActiveLearningPath: vi.fn(),
}));
vi.mock("@/shared/ui", () => ({ toast: { error: vi.fn() } }));
const track = {
  learningTrackId: "track-1",
  track: "Engineering",
  fit: "High",
  matchScore: 80,
  whyItFits: "Fit",
  roles: [],
};
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(() => useLearningPath((s) => s), { wrapper }) };
}
describe("learning path server state", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useAuthStore.setState({
      user: { id: "user-1" } as NonNullable<ReturnType<typeof useAuthStore.getState>["user"]>,
    });
    vi.mocked(fetchActiveLearningPath).mockResolvedValue({ data: track, needsAssessment: false });
  });
  it("loads into the user-partitioned query cache", async () => {
    const { result, client } = setup();
    await waitFor(() => expect(result.current.activeTrack).toEqual(track));
    expect(client.getQueryData(learningPathKey("user-1"))).toEqual({
      data: track,
      needsAssessment: false,
    });
    expect(fetchActiveLearningPath).toHaveBeenCalledWith(false, expect.any(AbortSignal));
  });
  it("surfaces load failures without fabricating an assessment requirement", async () => {
    vi.mocked(fetchActiveLearningPath).mockRejectedValue(new Error("offline"));
    const { result } = setup();
    await waitFor(() => expect(result.current.error).toBe("offline"));
    expect(result.current.needsAssessment).toBe(false);
  });
  it("refreshes and invalidates dependent queries", async () => {
    const { result, client } = setup();
    await waitFor(() => expect(result.current.activeTrack).toEqual(track));
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await act(() => result.current.fetchAndSetActiveLearningPath("user-1", { refresh: true }));
    expect(fetchActiveLearningPath).toHaveBeenCalledWith(true);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["dashboardData", "user-1"] });
  });
  it("switches tracks through a mutation and replaces the query result", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.activeTrack).toEqual(track));
    vi.mocked(fetchActiveLearningPath).mockResolvedValue({
      data: { ...track, learningTrackId: "track-2" },
      needsAssessment: false,
    });
    await act(() => result.current.switchActiveTrack("track-2"));
    expect(activateLearningTrack).toHaveBeenCalledWith("track-2");
    await waitFor(() => expect(result.current.activeTrack?.learningTrackId).toBe("track-2"));
  });
  it("does not restore a completed mutation into the cache after logout", async () => {
    const { result, client } = setup();
    await waitFor(() => expect(result.current.activeTrack).toEqual(track));
    let resolve!: (value: { data: typeof track; needsAssessment: boolean }) => void;
    vi.mocked(fetchActiveLearningPath).mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    let work!: Promise<void>;
    await act(async () => {
      work = result.current.fetchAndSetActiveLearningPath("user-1", { refresh: true });
    });
    await waitFor(() => expect(resolve).toBeDefined());
    await act(async () => {
      useAuthStore.setState({ user: null });
      client.clear();
      resolve({ data: track, needsAssessment: false });
      await work;
    });
    expect(client.getQueryData(learningPathKey("user-1"))).toBeUndefined();
  });
});
