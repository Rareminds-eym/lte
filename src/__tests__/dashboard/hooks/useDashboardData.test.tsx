import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDashboardData } from "@/entities/dashboard";
import { apiFetch } from "@/shared/api";

vi.mock("@/entities/session", () => ({
  useAuthStore: (selector: (state: { user: { id: string } }) => unknown) =>
    selector({ user: { id: "learner-1" } }),
}));

vi.mock("@/shared/api", () => ({
  authClient: {
    subscribe: vi.fn(() => () => {}),
  },
  apiFetch: vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useDashboardData", () => {
  afterEach(() => vi.useRealTimers());
  beforeEach(() => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({ success: true, totalXp: 1240, xpThisWeek: 120, todayXp: 120 })
      .mockResolvedValueOnce({ success: true, streakDays: 7 })
      .mockResolvedValueOnce({ success: true, data: null, state: "active" })
      .mockResolvedValueOnce({ success: true, upcoming: [], recentFeedback: [] });
  });

  it("fetches and returns dashboard data via TanStack Query", async () => {
    const { result } = renderHook(() => useDashboardData(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.careerTarget.title).toBe("Backend Engineer");
    expect(result.current.data?.achievements.unlockedCount).toBe(18);
    expect(result.current.data?.upcomingFeedback).toEqual({ upcoming: [], recentFeedback: [] });
  });
  it("keeps polling when the feedback service fails, then stops after recovery", async () => {
    vi.useFakeTimers();
    vi.mocked(apiFetch).mockReset();
    vi.mocked(apiFetch).mockImplementation(async (path) => {
      if (String(path).endsWith("/feedback")) throw new Error("temporarily offline");
      if (String(path).endsWith("/xp"))
        return { success: true, totalXp: 0, xpThisWeek: 0, todayXp: 0 };
      if (String(path).endsWith("/streak")) return { success: true, streakDays: 0 };
      return { success: true, data: null, state: "active" };
    });
    const { result, unmount } = renderHook(() => useDashboardData(), { wrapper: createWrapper() });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(result.current.data?.upcomingFeedback.error).toBeTruthy();
    const before = vi.mocked(apiFetch).mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_010);
    });
    expect(vi.mocked(apiFetch).mock.calls.length).toBeGreaterThan(before);
    vi.mocked(apiFetch).mockResolvedValue({ success: true, upcoming: [], recentFeedback: [] });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_010);
    });
    expect(result.current.data?.upcomingFeedback.error).toBeUndefined();
    const recovered = vi.mocked(apiFetch).mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_010);
    });
    expect(apiFetch).toHaveBeenCalledTimes(recovered);
    unmount();
  });
});
