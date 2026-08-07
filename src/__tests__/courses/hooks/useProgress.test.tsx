import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const mockStartLevelProgress = vi.fn();
const mockStartModuleProgress = vi.fn();
const mockUpdateStageProgress = vi.fn();

vi.mock("@/entities/course/api/progressApi", () => ({
  startLevelProgress: (...args: unknown[]) => mockStartLevelProgress(...args),
  startModuleProgress: (...args: unknown[]) => mockStartModuleProgress(...args),
  updateStageProgress: (...args: unknown[]) => mockUpdateStageProgress(...args),
}));

import {
  useStartLevelProgress,
  useStartModuleProgress,
  useUpdateStageProgress,
} from "@/entities/course/model/useProgress";

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useProgress hooks", () => {
  it("useStartLevelProgress triggers mutation and invalidates queries on success", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    mockStartLevelProgress.mockResolvedValue({ success: true, levelProgressId: "lvl-prog-1" });

    const { result } = renderHook(() => useStartLevelProgress(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate("lvl-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockStartLevelProgress).toHaveBeenCalledWith("lvl-1");
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["userCourses"] }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["capabilityLevels"] }),
    );
  });

  it("useStartModuleProgress triggers mutation and invalidates queries on success", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    mockStartModuleProgress.mockResolvedValue({ success: true, moduleProgressId: "mod-prog-1" });

    const { result } = renderHook(() => useStartModuleProgress(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({ levelId: "lvl-1", moduleNo: 2 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockStartModuleProgress).toHaveBeenCalledWith("lvl-1", 2);
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["userCourses"] }),
    );
  });

  it("useUpdateStageProgress triggers mutation and invalidates queries on success", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    mockUpdateStageProgress.mockResolvedValue({ success: true, stageProgressId: "stage-prog-1" });

    const { result } = renderHook(() => useUpdateStageProgress(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({
      levelId: "lvl-1",
      moduleNo: 2,
      eContentId: "content-1",
      stageName: "engage",
      status: "completed",
      durationSeconds: 12,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockUpdateStageProgress).toHaveBeenCalledWith(
      "lvl-1",
      2,
      "content-1",
      "engage",
      "completed",
      12,
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["userCourses"] }),
    );
  });
});
