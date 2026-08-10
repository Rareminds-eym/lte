import { describe, expect, it } from "vitest";
import {
  type ArtifactSubmissionError,
  createArtifactFileDownloadResponse,
  createDownloadUrl,
} from "../file-queries";
import { getSubmissionEvaluationFlow } from "../queries";
import { createEnv, createSupabase, err, mockChain, ok } from "./queries-helpers";

describe("artifact file downloads", () => {
  it("checks file ownership and streams the R2 object", async () => {
    const files = mockChain({
      single: ok({
        id: "file-1",
        submission_id: "submission-1",
        question_id: "question-1",
        file_name: "answer.xlsx",
        file_url: null,
        object_key: "submissions/artifacts/users/user-1/artifact-1/submission-1/file-1-answer.xlsx",
        file_type: "xlsx",
        file_size_bytes: 4,
      }),
    });
    const supabase = createSupabase({ artifact_submission_files: files });
    const env = createEnv({
      get: vi.fn().mockResolvedValue({
        body: "xlsx",
        size: 4,
        httpMetadata: {
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      }),
    });

    const response = await createArtifactFileDownloadResponse(supabase, env, "user-1", "file-1");

    expect(files.eq).toHaveBeenCalledWith("artifact_submissions.user_id", "user-1");
    expect(env.STORAGE_BUCKET.get).toHaveBeenCalledWith(
      "submissions/artifacts/users/user-1/artifact-1/submission-1/file-1-answer.xlsx",
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="answer.xlsx"');
  });

  it("rejects downloads when the learner does not own the file", async () => {
    const supabase = createSupabase({
      artifact_submission_files: mockChain({ single: err("not found") }),
    });

    await expect(
      createArtifactFileDownloadResponse(supabase, createEnv(), "user-2", "file-1"),
    ).rejects.toMatchObject({
      code: "FILE_NOT_FOUND",
      status: 404,
    } satisfies Partial<ArtifactSubmissionError>);
  });
});
describe("artifact download and status edge cases", () => {
  const ownedFileRow = {
    id: "file-1",
    submission_id: "submission-1",
    question_id: "question-1",
    file_name: "answer.xlsx",
    file_url: null,
    object_key: "key-1",
    file_type: "xlsx",
    file_size_bytes: 4,
  };

  it("derives the object key from the file URL when object_key is missing", async () => {
    const supabase = createSupabase({
      artifact_submission_files: mockChain({
        single: ok({
          ...ownedFileRow,
          object_key: null,
          file_url: "https://cdn.example.com/submissions/answer.xlsx",
        }),
      }),
    });
    const env = createEnv({
      get: vi.fn().mockResolvedValue({ body: "x", httpMetadata: {} }),
    });

    const response = await createArtifactFileDownloadResponse(supabase, env, "user-1", "file-1");

    expect(env.STORAGE_BUCKET.get).toHaveBeenCalledWith("submissions/answer.xlsx");
    expect(response.status).toBe(200);
  });

  it("falls back to the raw URL when the file URL is not parseable", async () => {
    const supabase = createSupabase({
      artifact_submission_files: mockChain({
        single: ok({ ...ownedFileRow, object_key: null, file_url: "not-a-url/answer.xlsx" }),
      }),
    });
    const env = createEnv({
      get: vi.fn().mockResolvedValue({ body: "x", httpMetadata: {} }),
    });

    const response = await createArtifactFileDownloadResponse(supabase, env, "user-1", "file-1");

    expect(env.STORAGE_BUCKET.get).toHaveBeenCalledWith("not-a-url/answer.xlsx");
    expect(response.status).toBe(200);
  });

  it("rejects downloads when neither object_key nor file_url exists", async () => {
    const supabase = createSupabase({
      artifact_submission_files: mockChain({
        single: ok({ ...ownedFileRow, object_key: null, file_url: null }),
      }),
    });

    await expect(
      createArtifactFileDownloadResponse(supabase, createEnv(), "user-1", "file-1"),
    ).rejects.toMatchObject({
      code: "FILE_NOT_AVAILABLE",
      status: 404,
    } satisfies Partial<ArtifactSubmissionError>);
  });

  it("rejects downloads when the R2 object is missing", async () => {
    const supabase = createSupabase({
      artifact_submission_files: mockChain({ single: ok(ownedFileRow) }),
    });
    const env = createEnv({ get: vi.fn().mockResolvedValue(null) });

    await expect(
      createArtifactFileDownloadResponse(supabase, env, "user-1", "file-1"),
    ).rejects.toMatchObject({
      code: "FILE_NOT_AVAILABLE",
      status: 404,
    } satisfies Partial<ArtifactSubmissionError>);
  });

  it("builds download URLs against the request origin", () => {
    expect(createDownloadUrl("file-1", "https://lte.example/api/v1/artifacts/x")).toBe(
      "https://lte.example/api/v1/artifacts/files/file-1/download",
    );
  });

  it("returns the current evaluation flow for an owned submission", async () => {
    const flowRow = {
      id: "flow-1",
      submission_id: "submission-1",
      stage: "ai",
      status: "completed",
      score: 80,
      decision: "pass",
      feedback: "Well done",
      improvements: null,
      completed_at: "2026-08-05T10:05:00.000Z",
      metadata: { confidence: 0.9 },
    };
    const supabase = createSupabase({
      artifact_submissions: mockChain({ maybeSingle: ok({ id: "submission-1" }) }),
      artifact_evaluation_flows: mockChain({ maybeSingle: ok(flowRow) }),
    });

    const flow = await getSubmissionEvaluationFlow(supabase, "submission-1", "user-1");

    expect(flow).toEqual(flowRow);
  });

  it("fails when the submission fetch errors", async () => {
    const supabase = createSupabase({
      artifact_submissions: mockChain({ maybeSingle: err("submission down") }),
    });

    await expect(getSubmissionEvaluationFlow(supabase, "submission-1", "user-1")).rejects.toThrow(
      /Failed to fetch submission evaluation flow/,
    );
  });

  it("rejects when the submission does not exist", async () => {
    const supabase = createSupabase({
      artifact_submissions: mockChain({ maybeSingle: ok(null) }),
    });

    await expect(
      getSubmissionEvaluationFlow(supabase, "submission-1", "user-1"),
    ).rejects.toMatchObject({
      code: "SUBMISSION_NOT_FOUND",
      status: 404,
    } satisfies Partial<ArtifactSubmissionError>);
  });

  it("rejects when the submission belongs to another user", async () => {
    const supabase = createSupabase({
      artifact_submissions: mockChain({ maybeSingle: ok({ id: "submission-1" }) }),
      artifact_evaluation_flows: mockChain({ maybeSingle: err("flow down") }),
    });

    await expect(getSubmissionEvaluationFlow(supabase, "submission-1", "user-1")).rejects.toThrow(
      /Failed to fetch evaluation flow/,
    );
  });
});
