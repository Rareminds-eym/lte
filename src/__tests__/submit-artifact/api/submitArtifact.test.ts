import { beforeEach, describe, expect, it, vi } from "vitest";
import { submitArtifact } from "@/features/submit-artifact";
import { apiFetch } from "@/shared/api";

vi.mock("@/shared/api", () => ({
  apiFetch: vi.fn().mockResolvedValue({
    success: true,
    submission_id: "submission-1",
    attempt_no: 1,
    version_label: "v1",
    submitted_at: "2026-08-05T10:00:00.000Z",
    status: "submitted",
    evaluation_status: "pending",
    files: [],
  }),
}));

describe("submitArtifact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("posts multipart payload and files to artifact submit endpoint", async () => {
    const file = new File(["xlsx"], "readiness.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    await submitArtifact({
      artifactId: "artifact-1",
      answers: [
        { questionId: "q-text", textResponse: "Done" },
        { questionId: "q-file", file },
      ],
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/v1/artifacts/submit",
      expect.objectContaining({
        method: "POST",
        body: expect.any(FormData),
      }),
    );

    const [, options] = vi.mocked(apiFetch).mock.calls[0] ?? [];
    const formData = options?.body as FormData;
    expect(JSON.parse(formData.get("payload") as string)).toEqual({
      artifact_id: "artifact-1",
      answers: [{ question_id: "q-text", text_response: "Done" }, { question_id: "q-file" }],
    });
    expect(formData.get("file:q-file")).toBe(file);
  });
});
