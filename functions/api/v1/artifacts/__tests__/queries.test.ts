import type { LteEnv } from "@functions/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type ArtifactSubmissionError,
  createArtifactFileDownloadResponse,
  submitArtifactSubmission,
} from "../queries";

interface QueryResult {
  data: unknown;
  error: { message: string } | null;
}

interface MockChain {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  then: (resolve: (value: QueryResult) => unknown) => Promise<unknown>;
}

const ok = (data: unknown): QueryResult => ({ data, error: null });
const err = (message: string): QueryResult => ({ data: null, error: { message } });

function mockChain(
  options: { single?: QueryResult; maybeSingle?: QueryResult; thenVal?: QueryResult } = {},
) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    update: vi.fn(() => Promise.resolve(ok(null))),
    insert: vi.fn(() => Promise.resolve(ok(null))),
    upsert: vi.fn(() => Promise.resolve(ok(null))),
    maybeSingle: vi.fn().mockResolvedValue(options.maybeSingle ?? ok(null)),
    single: vi.fn().mockResolvedValue(options.single ?? ok(null)),
    // biome-ignore lint/suspicious/noThenProperty: this mocks awaited Supabase query builders.
    then: vi.fn((resolve: (value: QueryResult) => unknown) =>
      Promise.resolve(options.thenVal ?? ok(null)).then(resolve),
    ),
  };
  return chain as MockChain;
}

function createSupabase(chains: Record<string, MockChain>): SupabaseClient {
  return {
    from: vi.fn((table: string) => chains[table] ?? mockChain()),
  } as unknown as SupabaseClient;
}

function createEnv(overrides: Partial<LteEnv["STORAGE_BUCKET"]> = {}) {
  return {
    R2_PUBLIC_DOMAIN: "https://bucket.lte.rareminds.in",
    STORAGE_BUCKET: {
      put: vi.fn().mockResolvedValue({}),
      get: vi.fn().mockResolvedValue(null),
      head: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    },
  } satisfies Pick<LteEnv, "STORAGE_BUCKET" | "R2_PUBLIC_DOMAIN">;
}

function createTestFile(parts: BlobPart[], fileName: string, options?: FilePropertyBag): File {
  const file = new File(parts, fileName, options);
  return Object.assign(file, {
    stream: () => new ReadableStream(),
  });
}

function createSubmitChains(
  options: { questions?: QueryResult; fileInsert?: QueryResult; answerUpsert?: QueryResult } = {},
) {
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
  };

  const submissionsInsert = mockChain({ single: ok(submission) });
  const submissions = mockChain({ maybeSingle: ok(null) });
  submissions.insert = vi.fn(() => submissionsInsert);

  const answers = mockChain();
  answers.upsert = vi.fn(() => Promise.resolve(options.answerUpsert ?? ok(null)));

  const files = mockChain();
  files.insert = vi.fn(() => Promise.resolve(options.fileInsert ?? ok(null)));

  return {
    module_artifacts: mockChain({
      single: ok({ id: "artifact-1", modules_content_id: "content-1" }),
    }),
    modules_content: mockChain({
      single: ok({ id: "content-1", module_id: "module-1" }),
    }),
    user_module_progress: mockChain({
      maybeSingle: ok({ id: "progress-1" }),
    }),
    artifact_questions: mockChain({
      thenVal:
        options.questions ??
        ok([
          {
            id: "question-1",
            artifact_id: "artifact-1",
            response_type: "file",
            allowed_file_types: ["xlsx"],
            max_file_size_mb: 10,
            response_required: true,
          },
        ]),
    }),
    artifact_submissions: submissions,
    artifact_submission_answers: answers,
    artifact_submission_files: files,
  };
}

describe("artifact submission queries", () => {
  beforeEach(() => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000001");
  });

  it("uploads a file to R2 and stores object metadata on the file row", async () => {
    const chains = createSubmitChains();
    const supabase = createSupabase(chains);
    const env = createEnv();
    const file = createTestFile(["xlsx"], "Readiness Sheet.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const result = await submitArtifactSubmission(
      supabase,
      env,
      "user-1",
      {
        artifact_id: "artifact-1",
        answers: [{ question_id: "question-1" }],
      },
      new Map([["question-1", file]]),
    );

    const expectedKey =
      "submissions/artifacts/users/user-1/artifact-1/submission-1/00000000-0000-4000-8000-000000000001-Readiness-Sheet.xlsx";

    expect(env.STORAGE_BUCKET.put).toHaveBeenCalledWith(
      expectedKey,
      expect.any(ReadableStream),
      expect.objectContaining({
        httpMetadata: expect.objectContaining({
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      }),
    );
    expect(chains.artifact_submission_files.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "00000000-0000-4000-8000-000000000001",
        file_url: `https://bucket.lte.rareminds.in/${expectedKey}`,
        object_key: expectedKey,
        file_type: "xlsx",
      }),
    );
    expect(result.files).toEqual([
      {
        file_id: "00000000-0000-4000-8000-000000000001",
        question_id: "question-1",
        file_name: "Readiness Sheet.xlsx",
      },
    ]);
  });

  it("rejects a required file submission before creating a submission when no file is provided", async () => {
    const chains = createSubmitChains();
    const supabase = createSupabase(chains);

    await expect(
      submitArtifactSubmission(
        supabase,
        createEnv(),
        "user-1",
        { artifact_id: "artifact-1", answers: [{ question_id: "question-1" }] },
        new Map(),
      ),
    ).rejects.toMatchObject({
      code: "FILE_RESPONSE_REQUIRED",
    } satisfies Partial<ArtifactSubmissionError>);

    expect(chains.artifact_submissions.insert).not.toHaveBeenCalled();
    expect(chains.artifact_submission_files.insert).not.toHaveBeenCalled();
  });

  it("does not insert a file row when R2 upload fails", async () => {
    const chains = createSubmitChains();
    const supabase = createSupabase(chains);
    const env = createEnv({ put: vi.fn().mockRejectedValue(new Error("R2 upload failed")) });
    const file = createTestFile(["xlsx"], "answer.xlsx");

    await expect(
      submitArtifactSubmission(
        supabase,
        env,
        "user-1",
        { artifact_id: "artifact-1", answers: [{ question_id: "question-1" }] },
        new Map([["question-1", file]]),
      ),
    ).rejects.toThrow(/R2 upload failed/);

    expect(chains.artifact_submission_files.insert).not.toHaveBeenCalled();
  });

  it("surfaces a DB failure when saving the uploaded file row", async () => {
    const chains = createSubmitChains({ fileInsert: err("insert failed") });
    const supabase = createSupabase(chains);
    const file = createTestFile(["xlsx"], "answer.xlsx");

    await expect(
      submitArtifactSubmission(
        supabase,
        createEnv(),
        "user-1",
        { artifact_id: "artifact-1", answers: [{ question_id: "question-1" }] },
        new Map([["question-1", file]]),
      ),
    ).rejects.toThrow(/Failed to save uploaded artifact file: insert failed/);
  });
});

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
