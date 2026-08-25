import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDashboardData } from "@/entities/dashboard";
import { apiFetch } from "@/shared/api";

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
  beforeEach(() => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({ success: true, totalXp: 1240, xpThisWeek: 120, todayXp: 120 })
      .mockResolvedValueOnce({ success: true, streakDays: 7 })
      .mockResolvedValueOnce({ success: true, data: null, state: "active" });
  });

  it("fetches and returns dashboard data via TanStack Query", async () => {
    const { result } = renderHook(() => useDashboardData(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.careerTarget.title).toBe("Backend Engineer");
    expect(result.current.data?.achievements.unlockedCount).toBe(18);
  });
});
