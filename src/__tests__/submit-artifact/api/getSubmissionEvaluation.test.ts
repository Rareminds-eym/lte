import { beforeEach, describe, expect, it, vi } from "vitest";

const mockApiFetch = vi.fn();

vi.mock("@/shared/api", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

import { getSubmissionEvaluation } from "@/features/submit-artifact";

describe("getSubmissionEvaluation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches the evaluation for the submission id", async () => {
    mockApiFetch.mockResolvedValue({ success: true, evaluation: null });

    await getSubmissionEvaluation("submission-123");

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/v1/artifacts/submissions/submission-123/evaluation",
    );
  });

  it("URL-encodes the submission id", async () => {
    mockApiFetch.mockResolvedValue({ success: true, evaluation: null });

    await getSubmissionEvaluation("a/b c");

    expect(mockApiFetch).toHaveBeenCalledWith("/api/v1/artifacts/submissions/a%2Fb%20c/evaluation");
  });
});
