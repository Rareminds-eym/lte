import { describe, expect, it, vi } from "vitest";
import { type ArtifactSubmissionError, submitArtifactSubmission } from "../queries";
import type { QueryResult } from "./queries-helpers";
import {
  createEnv,
  createSubmitChains,
  createSupabase,
  createTestFile,
  err,
  mockChain,
  ok,
  xlsxBuffer,
} from "./queries-helpers";

describe("artifact submission error branches", () => {
  it("rejects submissions when the artifact is not found", async () => {
    const chains = createSubmitChains();
    chains.module_artifacts.single = vi.fn().mockResolvedValue(err("not found"));

    await expect(
      submitArtifactSubmission(
        createSupabase(chains),
        createEnv(),
        "user-1",
        { artifact_id: "artifact-1", answers: [] },
        new Map(),
      ),
    ).rejects.toMatchObject({
      code: "ARTIFACT_NOT_FOUND",
      status: 404,
    } satisfies Partial<ArtifactSubmissionError>);
  });

  it("rejects submissions when the artifact module content is not found", async () => {
    const chains = createSubmitChains();
    chains.modules_content.single = vi.fn().mockResolvedValue(err("not found"));

    await expect(
      submitArtifactSubmission(
        createSupabase(chains),
        createEnv(),
        "user-1",
        { artifact_id: "artifact-1", answers: [] },
        new Map(),
      ),
    ).rejects.toMatchObject({
      code: "ARTIFACT_MODULE_NOT_FOUND",
      status: 404,
    } satisfies Partial<ArtifactSubmissionError>);
  });

  it("surfaces a DB failure when checking module progress", async () => {
    const chains = createSubmitChains();
    chains.user_module_progress.maybeSingle = vi.fn().mockResolvedValue(err("progress down"));

    await expect(
      submitArtifactSubmission(
        createSupabase(chains),
        createEnv(),
        "user-1",
        { artifact_id: "artifact-1", answers: [] },
        new Map(),
      ),
    ).rejects.toThrow(/Failed to validate artifact access/);
  });

  it("rejects submissions when the learner has no module progress", async () => {
    const chains = createSubmitChains();
    chains.user_module_progress.maybeSingle = vi.fn().mockResolvedValue(ok(null));

    await expect(
      submitArtifactSubmission(
        createSupabase(chains),
        createEnv(),
        "user-1",
        { artifact_id: "artifact-1", answers: [] },
        new Map(),
      ),
    ).rejects.toMatchObject({
      code: "ARTIFACT_FORBIDDEN",
      status: 403,
    } satisfies Partial<ArtifactSubmissionError>);
  });

  it("rejects answers that do not belong to the artifact", async () => {
    const chains = createSubmitChains();
    const supabase = createSupabase(chains);

    await expect(
      submitArtifactSubmission(
        supabase,
        createEnv(),
        "user-1",
        { artifact_id: "artifact-1", answers: [{ question_id: "unknown-question" }] },
        new Map(),
      ),
    ).rejects.toMatchObject({
      code: "ANSWER_QUESTION_INVALID",
      status: 400,
    } satisfies Partial<ArtifactSubmissionError>);
  });

  it("rejects a missing answer for a required question", async () => {
    const chains = createSubmitChains({
      questions: ok([
        {
          id: "question-1",
          artifact_id: "artifact-1",
          response_type: "text",
          allowed_file_types: null,
          max_file_size_mb: null,
          response_required: true,
        },
      ]),
    });

    await expect(
      submitArtifactSubmission(
        createSupabase(chains),
        createEnv(),
        "user-1",
        { artifact_id: "artifact-1", answers: [] },
        new Map(),
      ),
    ).rejects.toMatchObject({
      code: "REQUIRED_ANSWER_MISSING",
      status: 400,
    } satisfies Partial<ArtifactSubmissionError>);
  });

  it("rejects a required text question with an empty answer", async () => {
    const chains = createSubmitChains({
      questions: ok([
        {
          id: "question-1",
          artifact_id: "artifact-1",
          response_type: "text",
          allowed_file_types: null,
          max_file_size_mb: null,
          response_required: true,
        },
      ]),
    });

    await expect(
      submitArtifactSubmission(
        createSupabase(chains),
        createEnv(),
        "user-1",
        { artifact_id: "artifact-1", answers: [{ question_id: "question-1" }] },
        new Map(),
      ),
    ).rejects.toMatchObject({
      code: "TEXT_RESPONSE_REQUIRED",
      status: 400,
    } satisfies Partial<ArtifactSubmissionError>);
  });

  it("rejects a required URL question with an empty answer", async () => {
    const chains = createSubmitChains({
      questions: ok([
        {
          id: "question-1",
          artifact_id: "artifact-1",
          response_type: "url",
          allowed_file_types: null,
          max_file_size_mb: null,
          response_required: true,
        },
      ]),
    });

    await expect(
      submitArtifactSubmission(
        createSupabase(chains),
        createEnv(),
        "user-1",
        { artifact_id: "artifact-1", answers: [{ question_id: "question-1" }] },
        new Map(),
      ),
    ).rejects.toMatchObject({
      code: "URL_RESPONSE_REQUIRED",
      status: 400,
    } satisfies Partial<ArtifactSubmissionError>);
  });

  it("rejects non-HTTPS URL answers", async () => {
    const chains = createSubmitChains({
      questions: ok([
        {
          id: "question-1",
          artifact_id: "artifact-1",
          response_type: "url",
          allowed_file_types: null,
          max_file_size_mb: null,
          response_required: false,
        },
      ]),
    });

    await expect(
      submitArtifactSubmission(
        createSupabase(chains),
        createEnv(),
        "user-1",
        {
          artifact_id: "artifact-1",
          answers: [{ question_id: "question-1", url_response: "http://insecure.example/a" }],
        },
        new Map(),
      ),
    ).rejects.toMatchObject({
      code: "HTTPS_URL_REQUIRED",
      status: 400,
    } satisfies Partial<ArtifactSubmissionError>);
  });

  it("upserts text answers and reports upsert failures", async () => {
    const chains = createSubmitChains({
      questions: ok([
        {
          id: "question-1",
          artifact_id: "artifact-1",
          response_type: "file",
          allowed_file_types: ["xlsx"],
          max_file_size_mb: 10,
          response_required: false,
        },
      ]),
    });
    const supabase = createSupabase(chains);

    const result = await submitArtifactSubmission(
      supabase,
      createEnv(),
      "user-1",
      {
        artifact_id: "artifact-1",
        answers: [{ question_id: "question-1", text_response: "hello" }],
      },
      new Map(),
    );

    expect(chains.artifact_submission_answers.upsert).toHaveBeenCalledWith(
      [
        {
          submission_id: "submission-1",
          question_id: "question-1",
          text_response: "hello",
          url_response: null,
          updated_at: expect.any(String),
        },
      ],
      { onConflict: "submission_id,question_id" },
    );
    expect(result.status).toBe("human_review");

    chains.artifact_submission_answers.upsert = vi.fn().mockResolvedValue(err("upsert failed"));
    await expect(
      submitArtifactSubmission(
        supabase,
        createEnv(),
        "user-1",
        {
          artifact_id: "artifact-1",
          answers: [{ question_id: "question-1", text_response: "hello" }],
        },
        new Map(),
      ),
    ).rejects.toThrow(/Failed to save artifact answers/);
  });

  it("fails when the artifact meta fetch errors after the attempt is created", async () => {
    const chains = createSubmitChains({
      questions: ok([
        {
          id: "question-1",
          artifact_id: "artifact-1",
          response_type: "file",
          allowed_file_types: ["xlsx"],
          max_file_size_mb: 10,
          response_required: false,
        },
      ]),
    });
    chains.module_artifacts.single = vi
      .fn()
      .mockResolvedValueOnce(ok({ id: "artifact-1", modules_content_id: "content-1" }))
      .mockResolvedValueOnce(err("meta down"));

    await expect(
      submitArtifactSubmission(
        createSupabase(chains),
        createEnv(),
        "user-1",
        { artifact_id: "artifact-1", answers: [] },
        new Map(),
      ),
    ).rejects.toThrow(/Failed to fetch artifact meta/);
  });

  it("fails when the question details fetch errors after the attempt is created", async () => {
    const chains = createSubmitChains();
    // biome-ignore lint/suspicious/noThenProperty: this mocks awaited Supabase query builders.
    chains.artifact_questions.then = vi
      .fn()
      .mockImplementationOnce((resolve: (value: QueryResult) => unknown) =>
        Promise.resolve(
          ok([
            {
              id: "question-1",
              artifact_id: "artifact-1",
              response_type: "file",
              allowed_file_types: ["xlsx"],
              max_file_size_mb: 10,
              response_required: false,
            },
          ]),
        ).then(resolve),
      )
      .mockImplementationOnce((resolve: (value: QueryResult) => unknown) =>
        Promise.resolve(err("details down")).then(resolve),
      );

    await expect(
      submitArtifactSubmission(
        createSupabase(chains),
        createEnv(),
        "user-1",
        { artifact_id: "artifact-1", answers: [] },
        new Map(),
      ),
    ).rejects.toThrow(/Failed to fetch artifact questions/);
  });

  it("rolls back and logs when the answer upsert fails", async () => {
    const chains = createSubmitChains({
      questions: ok([
        {
          id: "question-1",
          artifact_id: "artifact-1",
          response_type: "file",
          allowed_file_types: ["xlsx"],
          max_file_size_mb: 10,
          response_required: false,
        },
      ]),
    });
    chains.artifact_submission_answers.upsert = vi.fn().mockResolvedValue(err("upsert failed"));
    chains.artifact_submissions.delete = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue(err("delete failed")),
    }));
    const loggerSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(
      submitArtifactSubmission(
        createSupabase(chains),
        createEnv(),
        "user-1",
        { artifact_id: "artifact-1", answers: [{ question_id: "question-1", text_response: "x" }] },
        new Map(),
      ),
    ).rejects.toThrow(/Failed to save artifact answers/);

    expect(chains.artifact_submissions.delete).toHaveBeenCalled();
    expect(loggerSpy).toHaveBeenCalled();
    loggerSpy.mockRestore();
  });

  it("logs when orphaned R2 object cleanup fails", async () => {
    const chains = createSubmitChains({ fileInsert: err("insert failed") });
    const env = createEnv({ delete: vi.fn().mockRejectedValue(new Error("r2 delete failed")) });
    const loggerSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const file = createTestFile([xlsxBuffer], "answer.xlsx");

    await expect(
      submitArtifactSubmission(
        createSupabase(chains),
        env,
        "user-1",
        { artifact_id: "artifact-1", answers: [{ question_id: "question-1" }] },
        new Map([["question-1", file]]),
      ),
    ).rejects.toThrow(/Failed to save uploaded artifact file/);

    expect(env.STORAGE_BUCKET.delete).toHaveBeenCalled();
    expect(loggerSpy).toHaveBeenCalled();
    loggerSpy.mockRestore();
  });

  it("surfaces a DB failure while fetching the latest submission", async () => {
    const chains = createSubmitChains({
      questions: ok([
        {
          id: "question-1",
          artifact_id: "artifact-1",
          response_type: "file",
          allowed_file_types: ["xlsx"],
          max_file_size_mb: 10,
          response_required: false,
        },
      ]),
    });
    chains.artifact_submissions.maybeSingle = vi.fn().mockResolvedValue(err("latest down"));

    await expect(
      submitArtifactSubmission(
        createSupabase(chains),
        createEnv(),
        "user-1",
        { artifact_id: "artifact-1", answers: [] },
        new Map(),
      ),
    ).rejects.toThrow(/Failed to fetch latest artifact submission/);
  });

  it("surfaces a DB failure while checking the idempotency key", async () => {
    const chains = createSubmitChains({
      questions: ok([
        {
          id: "question-1",
          artifact_id: "artifact-1",
          response_type: "file",
          allowed_file_types: ["xlsx"],
          max_file_size_mb: 10,
          response_required: false,
        },
      ]),
    });
    chains.artifact_submissions.maybeSingle = vi.fn().mockResolvedValue(err("dup check down"));

    await expect(
      submitArtifactSubmission(
        createSupabase(chains),
        createEnv(),
        "user-1",
        { artifact_id: "artifact-1", answers: [] },
        new Map(),
        "idem-key-1",
      ),
    ).rejects.toThrow(/Failed to fetch duplicate artifact submission/);
  });

  it("surfaces a DB failure while demoting the previous latest submission", async () => {
    const chains = createSubmitChains({
      questions: ok([
        {
          id: "question-1",
          artifact_id: "artifact-1",
          response_type: "file",
          allowed_file_types: ["xlsx"],
          max_file_size_mb: 10,
          response_required: false,
        },
      ]),
      latest: ok({
        id: "submission-1",
        artifact_id: "artifact-1",
        user_id: "user-1",
        user_module_progress_id: "progress-1",
        attempt_no: 1,
        version_label: "v1",
        is_latest: true,
        status: "submitted",
        previous_submission_id: null,
        submitted_at: "2026-08-05T10:00:00.000Z",
        sealed_at: null,
      }),
    });
    chains.artifact_submissions.update = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue(err("demote failed")),
    }));

    await expect(
      submitArtifactSubmission(
        createSupabase(chains),
        createEnv(),
        "user-1",
        { artifact_id: "artifact-1", answers: [] },
        new Map(),
      ),
    ).rejects.toThrow(/Failed to update previous artifact submission/);
  });

  it("surfaces a DB failure when creating the submission attempt", async () => {
    const chains = createSubmitChains({
      questions: ok([
        {
          id: "question-1",
          artifact_id: "artifact-1",
          response_type: "file",
          allowed_file_types: ["xlsx"],
          max_file_size_mb: 10,
          response_required: false,
        },
      ]),
      insertSingle: { data: null, error: { code: "PGRST116", message: "constraint" } },
    });

    await expect(
      submitArtifactSubmission(
        createSupabase(chains),
        createEnv(),
        "user-1",
        { artifact_id: "artifact-1", answers: [] },
        new Map(),
      ),
    ).rejects.toThrow(/Failed to create artifact submission/);
  });

  it("retries once when a concurrent insert collides and then succeeds", async () => {
    const chains = createSubmitChains({
      questions: ok([
        {
          id: "question-1",
          artifact_id: "artifact-1",
          response_type: "file",
          allowed_file_types: ["xlsx"],
          max_file_size_mb: 10,
          response_required: false,
        },
      ]),
    });
    const submission = {
      id: "submission-1",
      artifact_id: "artifact-1",
      user_id: "user-1",
      user_module_progress_id: "progress-1",
      attempt_no: 1,
      version_label: "v1",
      is_latest: true,
      status: "submitted",
      previous_submission_id: null,
      submitted_at: "2026-08-05T10:00:00.000Z",
      sealed_at: null,
    };
    const collided = mockChain({
      single: { data: null, error: { code: "23505", message: "duplicate key" } },
    });
    const success = mockChain({ single: ok(submission) });
    chains.artifact_submissions.insert = vi
      .fn()
      .mockReturnValueOnce(collided)
      .mockReturnValueOnce(success);
    chains.artifact_submissions.maybeSingle = vi
      .fn()
      .mockResolvedValueOnce(ok(null))
      .mockResolvedValueOnce(ok(submission))
      .mockResolvedValueOnce(ok(null))
      .mockResolvedValueOnce(ok(submission));

    const result = await submitArtifactSubmission(
      createSupabase(chains),
      createEnv(),
      "user-1",
      { artifact_id: "artifact-1", answers: [] },
      new Map(),
    );

    expect(chains.artifact_submissions.insert).toHaveBeenCalledTimes(2);
    expect(result.submission_id).toBe("submission-1");
  });

  it("fails after exhausting retries on repeated insert collisions", async () => {
    const chains = createSubmitChains({
      questions: ok([
        {
          id: "question-1",
          artifact_id: "artifact-1",
          response_type: "file",
          allowed_file_types: ["xlsx"],
          max_file_size_mb: 10,
          response_required: false,
        },
      ]),
    });
    chains.artifact_submissions.insert = vi.fn(() =>
      mockChain({
        single: { data: null, error: { code: "23505", message: "duplicate key" } },
      }),
    );
    chains.artifact_submissions.maybeSingle = vi.fn().mockResolvedValue(ok(null));

    await expect(
      submitArtifactSubmission(
        createSupabase(chains),
        createEnv(),
        "user-1",
        { artifact_id: "artifact-1", answers: [] },
        new Map(),
      ),
    ).rejects.toThrow(/after retrying a concurrent insert/);
  });

  it("fails when the artifact questions fetch errors", async () => {
    const chains = createSubmitChains({ questions: err("questions down") });

    await expect(
      submitArtifactSubmission(
        createSupabase(chains),
        createEnv(),
        "user-1",
        { artifact_id: "artifact-1", answers: [] },
        new Map(),
      ),
    ).rejects.toThrow(/Failed to fetch artifact questions/);
  });

  it("stores null file_url when no public domain is configured", async () => {
    const chains = createSubmitChains();
    const env = {
      STORAGE_BUCKET: createEnv().STORAGE_BUCKET,
      R2_PUBLIC_DOMAIN: undefined,
    } as unknown as ReturnType<typeof createEnv>;
    const file = createTestFile([xlsxBuffer], "answer.xlsx");

    const result = await submitArtifactSubmission(
      createSupabase(chains),
      env,
      "user-1",
      { artifact_id: "artifact-1", answers: [{ question_id: "question-1" }] },
      new Map([["question-1", file]]),
    );

    expect(chains.artifact_submission_files.insert).toHaveBeenCalledWith(
      expect.objectContaining({ file_url: null }),
    );
    expect(result.files).toHaveLength(1);
  });
});
describe("duplicate submission re-run error branches", () => {
  const existing = {
    id: "submission-1",
    artifact_id: "artifact-1",
    user_id: "user-1",
    user_module_progress_id: "progress-1",
    attempt_no: 1,
    version_label: "v1",
    is_latest: true,
    status: "submitted",
    previous_submission_id: null,
    submitted_at: "2026-08-05T10:00:00.000Z",
    sealed_at: null,
  };

  function duplicateChains() {
    const chains = createSubmitChains({
      questions: ok([
        {
          id: "question-1",
          artifact_id: "artifact-1",
          response_type: "file",
          allowed_file_types: ["xlsx"],
          max_file_size_mb: 10,
          response_required: false,
        },
      ]),
      latest: ok(existing),
      insertSingle: { data: null, error: { code: "23505", message: "duplicate key" } },
    });
    // findSubmissionByIdempotencyKey (none) -> getLatestSubmission (existing)
    // -> post-23505 re-find (existing, wins the race).
    chains.artifact_submissions.maybeSingle
      .mockResolvedValueOnce(ok(null))
      .mockResolvedValueOnce(ok(existing))
      .mockResolvedValueOnce(ok(existing));
    return chains;
  }

  it("fails when the duplicate evaluation flow fetch errors", async () => {
    const chains = duplicateChains();
    chains.artifact_evaluation_flows.maybeSingle = vi.fn().mockResolvedValue(err("flow down"));

    await expect(
      submitArtifactSubmission(
        createSupabase(chains),
        createEnv(),
        "user-1",
        { artifact_id: "artifact-1", answers: [] },
        new Map(),
        "idem-key-1",
      ),
    ).rejects.toThrow(/Failed to fetch evaluation flow for duplicate submission/);
  });

  it("fails when the duplicate submission files fetch errors", async () => {
    const chains = duplicateChains();
    chains.artifact_evaluation_flows.maybeSingle = vi
      .fn()
      .mockResolvedValueOnce(ok(null))
      .mockResolvedValueOnce(
        ok({
          id: "flow-1",
          submission_id: "submission-1",
          stage: "ai",
          status: "completed",
          score: 0,
          decision: "human_review",
          feedback: "",
          improvements: null,
          completed_at: null,
          metadata: {},
        }),
      );
    // biome-ignore lint/suspicious/noThenProperty: this mocks awaited Supabase query builders.
    chains.artifact_submission_files.then = vi.fn((resolve: (value: QueryResult) => unknown) =>
      Promise.resolve(err("files down")).then(resolve),
    );

    await expect(
      submitArtifactSubmission(
        createSupabase(chains),
        createEnv(),
        "user-1",
        { artifact_id: "artifact-1", answers: [] },
        new Map(),
        "idem-key-1",
      ),
    ).rejects.toThrow(/Failed to fetch submission files/);
  });

  it("fails when the re-run evaluation completes without a flow row", async () => {
    const chains = duplicateChains();
    chains.artifact_evaluation_flows.maybeSingle = vi.fn().mockResolvedValue(ok(null));

    await expect(
      submitArtifactSubmission(
        createSupabase(chains),
        createEnv(),
        "user-1",
        { artifact_id: "artifact-1", answers: [] },
        new Map(),
        "idem-key-1",
      ),
    ).rejects.toThrow(/Evaluation re-run completed without a flow row/);
  });

  it("surfaces each re-run query failure", async () => {
    const rerunMetaErr = duplicateChains();
    rerunMetaErr.module_artifacts.single = vi
      .fn()
      .mockResolvedValueOnce(ok({ id: "artifact-1", modules_content_id: "content-1" }))
      .mockResolvedValueOnce(err("meta down"));
    await expect(
      submitArtifactSubmission(
        createSupabase(rerunMetaErr),
        createEnv(),
        "user-1",
        { artifact_id: "artifact-1", answers: [] },
        new Map(),
        "idem-key-1",
      ),
    ).rejects.toThrow(/Failed to fetch artifact meta for re-run/);

    const rerunQuestionsErr = duplicateChains();
    // biome-ignore lint/suspicious/noThenProperty: this mocks awaited Supabase query builders.
    rerunQuestionsErr.artifact_questions.then = vi
      .fn()
      .mockImplementationOnce((resolve: (value: QueryResult) => unknown) =>
        Promise.resolve(ok([])).then(resolve),
      )
      .mockImplementationOnce((resolve: (value: QueryResult) => unknown) =>
        Promise.resolve(err("questions down")).then(resolve),
      );
    await expect(
      submitArtifactSubmission(
        createSupabase(rerunQuestionsErr),
        createEnv(),
        "user-1",
        { artifact_id: "artifact-1", answers: [] },
        new Map(),
        "idem-key-1",
      ),
    ).rejects.toThrow(/Failed to fetch artifact questions for re-run/);

    const rerunAnswersErr = duplicateChains();
    // biome-ignore lint/suspicious/noThenProperty: this mocks awaited Supabase query builders.
    rerunAnswersErr.artifact_submission_answers.then = vi.fn(
      (resolve: (value: QueryResult) => unknown) =>
        Promise.resolve(err("answers down")).then(resolve),
    );
    await expect(
      submitArtifactSubmission(
        createSupabase(rerunAnswersErr),
        createEnv(),
        "user-1",
        { artifact_id: "artifact-1", answers: [] },
        new Map(),
        "idem-key-1",
      ),
    ).rejects.toThrow(/Failed to fetch artifact answers for re-run/);

    const rerunFilesErr = duplicateChains();
    // biome-ignore lint/suspicious/noThenProperty: this mocks awaited Supabase query builders.
    rerunFilesErr.artifact_submission_files.then = vi
      .fn()
      .mockImplementationOnce((resolve: (value: QueryResult) => unknown) =>
        Promise.resolve(ok([])).then(resolve),
      )
      .mockImplementationOnce((resolve: (value: QueryResult) => unknown) =>
        Promise.resolve(err("files down")).then(resolve),
      );
    await expect(
      submitArtifactSubmission(
        createSupabase(rerunFilesErr),
        createEnv(),
        "user-1",
        { artifact_id: "artifact-1", answers: [] },
        new Map(),
        "idem-key-1",
      ),
    ).rejects.toThrow(/Failed to fetch artifact files for re-run/);
  });

  it("rebuilds the evaluation input from persisted answers and R2 objects on re-run", async () => {
    const chains = duplicateChains();
    chains.artifact_evaluation_flows.maybeSingle = vi
      .fn()
      .mockResolvedValueOnce(ok(null))
      .mockResolvedValueOnce(
        ok({
          id: "flow-1",
          submission_id: "submission-1",
          stage: "ai",
          status: "completed",
          score: 0,
          decision: "human_review",
          feedback: "",
          improvements: null,
          completed_at: null,
          metadata: {},
        }),
      );
    // biome-ignore lint/suspicious/noThenProperty: this mocks awaited Supabase query builders.
    chains.artifact_submission_answers.then = vi.fn((resolve: (value: QueryResult) => unknown) =>
      Promise.resolve(
        ok([{ question_id: "question-1", text_response: "persisted answer", url_response: null }]),
      ).then(resolve),
    );
    // biome-ignore lint/suspicious/noThenProperty: this mocks awaited Supabase query builders.
    chains.artifact_submission_files.then = vi.fn((resolve: (value: QueryResult) => unknown) =>
      Promise.resolve(
        ok([
          {
            question_id: "question-1",
            file_name: "answer.xlsx",
            object_key: null,
            file_type: "xlsx",
          },
          {
            question_id: "question-1",
            file_name: "answer.xlsx",
            object_key: "missing-key",
            file_type: "xlsx",
          },
          {
            question_id: "question-1",
            file_name: "answer.xlsx",
            object_key: "real-key",
            file_type: "xlsx",
          },
        ]),
      ).then(resolve),
    );
    const env = createEnv({
      get: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ arrayBuffer: async () => xlsxBuffer }),
    });

    const result = await submitArtifactSubmission(
      createSupabase(chains),
      env,
      "user-1",
      { artifact_id: "artifact-1", answers: [] },
      new Map(),
      "idem-key-1",
    );

    expect(env.STORAGE_BUCKET.get).toHaveBeenCalledTimes(2);
    expect(result.duplicate).toBe(true);
    expect(result.evaluation?.decision).toBe("human_review");
  });

  it("fails when the post-re-run flow fetch errors", async () => {
    const chains = duplicateChains();
    chains.artifact_evaluation_flows.maybeSingle = vi
      .fn()
      .mockResolvedValueOnce(ok(null))
      .mockResolvedValueOnce(err("flow down after re-run"));

    await expect(
      submitArtifactSubmission(
        createSupabase(chains),
        createEnv(),
        "user-1",
        { artifact_id: "artifact-1", answers: [] },
        new Map(),
        "idem-key-1",
      ),
    ).rejects.toThrow(/Failed to fetch evaluation flow after re-run/);
  });
});
