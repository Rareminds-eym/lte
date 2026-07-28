import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type React from "react";
import { describe, expect, it } from "vitest";
import { useDashboardData } from "@/entities/dashboard";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useDashboardData", () => {
  it("fetches and returns dashboard data via TanStack Query", async () => {
    const { result } = renderHook(() => useDashboardData(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.careerTarget.title).toBe("Backend Engineer");
    expect(result.current.data?.achievements.unlockedCount).toBe(18);
  });
});
