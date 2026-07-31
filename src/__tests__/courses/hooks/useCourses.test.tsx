import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const mockFetchUserCourses = vi.fn();
vi.mock("@/entities/course/api/courseApi", () => ({
  fetchUserCourses: (...args: unknown[]) => mockFetchUserCourses(...args),
}));

vi.mock("@/entities/session", () => ({
  useAuthStore: vi.fn((selector?: unknown) => {
    const state = { accessToken: "mock-token" };
    return typeof selector === "function" ? selector(state) : state;
  }),
}));

import { useCourses } from "@/entities/course";

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useCourses", () => {
  it("returns loading state initially", () => {
    mockFetchUserCourses.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useCourses(), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
  });

  it("returns courses data on success", async () => {
    const courses = [{ id: "1", title: "Course 1" }];
    mockFetchUserCourses.mockResolvedValue(courses);
    const { result } = renderHook(() => useCourses(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(courses);
  });

  it("returns error state on failure", async () => {
    const err = new Error("API error") as Error & { status: number };
    err.status = 400;
    mockFetchUserCourses.mockRejectedValue(err);
    const { result } = renderHook(() => useCourses(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeDefined();
  });
});
