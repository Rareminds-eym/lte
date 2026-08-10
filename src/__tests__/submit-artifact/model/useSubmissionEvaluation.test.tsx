import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSubmissionEvaluation = vi.fn();
const mockUseAuthStore = vi.fn();

vi.mock("@/entities/session", () => ({
  useAuthStore: (...args: unknown[]) => mockUseAuthStore(...args),
}));

vi.mock("@/features/submit-artifact/api", () => ({
  getSubmissionEvaluation: (...args: unknown[]) => mockGetSubmissionEvaluation(...args),
}));

import { useSubmissionEvaluation } from "@/features/submit-artifact/model/useSubmissionEvaluation";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
}

const evaluationResponse = {
  success: true,
  evaluation: {
    id: "eval-1",
    submission_id: "submission-1",
    stage: "ai_review",
    status: "completed",
    score: 85,
    confidence: 0.9,
    decision: "revise_and_resubmit",
    feedback: "Good work, revise the evidence.",
    improvements: null,
    completed_at: "2026-08-08T10:00:00.000Z",
    rubric_rows: [],
    calculated_xp: 0,
  },
} as const;

describe("useSubmissionEvaluation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuthStore.mockImplementation(
      (selector: (state: { user: { id: string } | null }) => string | null) =>
        selector({ user: { id: "user-1" } }),
    );
  });

  it("fetches the evaluation for the current user's submission", async () => {
    mockGetSubmissionEvaluation.mockResolvedValue(evaluationResponse);
    const { wrapper, queryClient } = createWrapper();

    const { result } = renderHook(() => useSubmissionEvaluation("submission-1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetSubmissionEvaluation).toHaveBeenCalledWith("submission-1");
    expect(result.current.data).toEqual(evaluationResponse);
    expect(queryClient.getQueryData(["submission-evaluation", "user-1", "submission-1"])).toEqual(
      evaluationResponse,
    );
  });

  it("does not fetch when submissionId is undefined", async () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useSubmissionEvaluation(undefined), { wrapper });

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(mockGetSubmissionEvaluation).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });

  it("does not fetch when no authenticated user is present", async () => {
    mockUseAuthStore.mockImplementation(
      (selector: (state: { user: { id: string } | null }) => string | null) =>
        selector({ user: null }),
    );
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useSubmissionEvaluation("submission-1"), { wrapper });

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(mockGetSubmissionEvaluation).not.toHaveBeenCalled();
  });
});
