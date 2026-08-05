import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { useLearningPathStore } from "@/entities/active-learning-path";
import { useAuthStore } from "@/entities/session";

const mockFetchCapabilityLevels = vi.fn();
vi.mock("@/entities/course/api/courseApi", () => ({
  fetchUserCourses: vi.fn(),
  fetchCapabilityLevels: (code: string) => mockFetchCapabilityLevels(code),
}));

import { useCapabilityLevels } from "@/entities/course/model/useCapabilityLevels";

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useCapabilityLevels", () => {
  it("should be disabled when not authenticated or learning path not ready", () => {
    useAuthStore.setState({ isAuthenticated: false, accessToken: null });
    useLearningPathStore.setState({ activeTrack: null, activeLearningPathLoading: false });

    const { result } = renderHook(() => useCapabilityLevels("TS-101"), {
      wrapper: createWrapper(),
    });
    expect(result.current.isEnabled).toBeFalsy();
  });

  it("should fetch capability levels on success when authenticated and track is ready", async () => {
    useAuthStore.setState({ isAuthenticated: true, accessToken: "token" });
    useLearningPathStore.setState({
      activeTrack: {
        learningTrackId: "lt-1",
      } as unknown as import("@/shared/types/auth").ActiveTrackDetail,
      activeLearningPathLoading: false,
    });

    const mockData = [{ id: "lvl-1", title: "Level 1" }];
    mockFetchCapabilityLevels.mockResolvedValue(mockData);

    const { result } = renderHook(() => useCapabilityLevels("TS-101"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
  });
});
