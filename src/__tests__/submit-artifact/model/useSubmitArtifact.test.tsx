import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSubmitArtifact = vi.fn();

vi.mock("@/features/submit-artifact/api", () => ({
  submitArtifact: (...args: unknown[]) => mockSubmitArtifact(...args),
}));

import { useSubmitArtifact } from "@/features/submit-artifact/model/useSubmitArtifact";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useSubmitArtifact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits artifact payload through the submitArtifact API", async () => {
    mockSubmitArtifact.mockResolvedValue({
      success: true,
      submission_id: "submission-1",
      attempt_no: 1,
      version_label: "v1",
      submitted_at: "2026-08-05T10:00:00.000Z",
      status: "submitted",
      evaluation_status: "pending",
      files: [],
    });

    const input = {
      artifactId: "artifact-1",
      answers: [{ questionId: "q-1", textResponse: "Done" }],
    };
    const { result } = renderHook(() => useSubmitArtifact(), { wrapper: createWrapper() });

    result.current.mutate(input);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockSubmitArtifact).toHaveBeenCalledWith(input, expect.any(String));
  });

  it("reuses the idempotency key after a failure and resets it after success", async () => {
    const input = {
      artifactId: "artifact-1",
      answers: [{ questionId: "q-1", textResponse: "Done" }],
    };
    const successResponse = {
      success: true,
      submission_id: "submission-1",
      attempt_no: 1,
      version_label: "v1",
      submitted_at: "2026-08-05T10:00:00.000Z",
      status: "submitted",
      evaluation_status: "pending",
      files: [],
    };
    mockSubmitArtifact.mockRejectedValueOnce(new Error("network"));
    mockSubmitArtifact.mockResolvedValue(successResponse);

    const { result } = renderHook(() => useSubmitArtifact(), { wrapper: createWrapper() });

    result.current.mutate(input);
    await waitFor(() => expect(result.current.isError).toBe(true));

    result.current.mutate(input);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const firstKey = mockSubmitArtifact.mock.calls[0]?.[1] as string;
    const secondKey = mockSubmitArtifact.mock.calls[1]?.[1] as string;
    expect(secondKey).toBe(firstKey);

    result.current.mutate(input);
    await waitFor(() => expect(mockSubmitArtifact).toHaveBeenCalledTimes(3));

    const thirdKey = mockSubmitArtifact.mock.calls[2]?.[1] as string;
    expect(thirdKey).not.toBe(firstKey);
  });
});
