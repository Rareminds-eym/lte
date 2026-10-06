import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSubmissionEvaluation } from "@/features/submit-artifact/api";
import { useSubmissionEvaluation } from "@/features/submit-artifact/model/useSubmissionEvaluation";
import { REVIEW_POLLING_INTERVAL_MS } from "@/shared/config";

vi.mock("@/entities/session", () => ({
  useAuthStore: (select: (s: { user: { id: string } }) => unknown) =>
    select({ user: { id: "learner" } }),
}));
vi.mock("@/features/submit-artifact/api", () => ({ getSubmissionEvaluation: vi.fn() }));
describe("review completion polling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  it("polls pending reviews, refreshes progression on completion, then stops", async () => {
    const stage = {
      stage: "staff_review",
      status: "pending",
      score: null,
      decision: null,
      feedback: null,
      improvements: null,
      evaluated_by: null,
      completed_at: null,
    };
    vi.mocked(getSubmissionEvaluation)
      .mockResolvedValueOnce({ success: true, evaluation: null, stages: [stage] })
      .mockResolvedValue({
        success: true,
        evaluation: null,
        stages: [{ ...stage, status: "completed", completed_at: "2026-10-06T00:00:00Z" }],
      });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result, unmount } = renderHook(() => useSubmissionEvaluation("submission"), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(result.current.data?.stages?.[0]?.status).toBe("pending");
    expect(client.getQueryData(["submission-evaluation", "learner", "submission"])).toBeDefined();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(REVIEW_POLLING_INTERVAL_MS + 10);
    });
    expect(result.current.data?.stages?.[0]?.status).toBe("completed");
    for (const prefix of [
      "userCourses",
      "capabilityLevels",
      "levelContent",
      "levelModuleDetails",
      "levelDetails",
      "dashboardData",
    ])
      expect(invalidate).toHaveBeenCalledWith({ queryKey: [prefix] });
    const calls = vi.mocked(getSubmissionEvaluation).mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(REVIEW_POLLING_INTERVAL_MS * 2);
    });
    expect(getSubmissionEvaluation).toHaveBeenCalledTimes(calls);
    unmount();
    client.clear();
  });
});
