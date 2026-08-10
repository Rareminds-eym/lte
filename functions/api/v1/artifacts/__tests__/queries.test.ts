import type { LteEnv } from "@functions/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx/xlsx.mjs";
import {
  type ArtifactSubmissionError,
  buildArtifactEvaluationInput,
  createArtifactFileDownloadResponse,
  submitArtifactSubmission,
} from "../queries";

interface QueryResult {
  data: unknown;
  error: { message: string; code?: string } | null;
}

interface MockChain {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
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
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
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

/** Real xlsx bytes so content-signature validation accepts the fixture. */
const xlsxBuffer = (() => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["a", "b"]]), "Sheet1");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
})();

const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function u16le(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff];
}

function u32le(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff];
}

/** Minimal zip (local headers + central directory + EOCD) with declared sizes. */
function buildZipBuffer(
  entries: Array<{ name: string; compressedSize: number; uncompressedSize: number }>,
) {
  const bytes: number[] = [];
  const localOffsets: number[] = [];
  entries.forEach((entry) => {
    const nameBytes = [...new TextEncoder().encode(entry.name)];
    localOffsets.push(bytes.length);
    bytes.push(
      0x50,
      0x4b,
      0x03,
      0x04, // local file header signature
      0x14,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      ...u32le(entry.compressedSize),
      ...u32le(entry.uncompressedSize),
      ...u16le(nameBytes.length),
      ...u16le(0),
      ...nameBytes,
    );
  });
  const dirOffset = bytes.length;
  entries.forEach((entry, i) => {
    const nameBytes = [...new TextEncoder().encode(entry.name)];
    bytes.push(
      0x50,
      0x4b,
      0x01,
      0x02, // central directory signature
      0x14,
      0x00,
      0x14,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      ...u32le(entry.compressedSize),
      ...u32le(entry.uncompressedSize),
      ...u16le(nameBytes.length),
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      ...u32le(localOffsets[i] ?? 0),
      ...nameBytes,
    );
  });
  const dirSize = bytes.length - dirOffset;
  bytes.push(
    0x50,
    0x4b,
    0x05,
    0x06, // EOCD signature
    ...u16le(0),
    ...u16le(0),
    ...u16le(entries.length),
    ...u16le(entries.length),
    ...u32le(dirSize),
    ...u32le(dirOffset),
    ...u16le(0),
  );
  return new Uint8Array(bytes);
}

function createSubmitChains(
  options: {
    questions?: QueryResult;
    fileInsert?: QueryResult;
    answerUpsert?: QueryResult;
    latest?: QueryResult;
    insertSingle?: QueryResult;
  } = {},
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

  const submissionsInsert = mockChain({ single: options.insertSingle ?? ok(submission) });
  const submissions = mockChain({ maybeSingle: options.latest ?? ok(null) });
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
    const file = createTestFile([xlsxBuffer], "Readiness Sheet.xlsx", {
      type: XLSX_CONTENT_TYPE,
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
    const file = createTestFile([xlsxBuffer], "answer.xlsx");

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
    const file = createTestFile([xlsxBuffer], "answer.xlsx");

    await expect(
      submitArtifactSubmission(
        supabase,
        createEnv(),
        "user-1",
        { artifact_id: "artifact-1", answers: [{ question_id: "question-1" }] },
        new Map([["question-1", file]]),
      ),
    ).rejects.toThrow(
      /Failed to save uploaded artifact file \(question .*, submission .*\): insert failed/,
    );
  });

  it("rejects renamed binaries by content signature before creating anything", async () => {
    const chains = createSubmitChains();
    const supabase = createSupabase(chains);
    const env = createEnv();
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
    const file = createTestFile([pdfBytes], "answer.xlsx");

    await expect(
      submitArtifactSubmission(
        supabase,
        env,
        "user-1",
        { artifact_id: "artifact-1", answers: [{ question_id: "question-1" }] },
        new Map([["question-1", file]]),
      ),
    ).rejects.toMatchObject({
      code: "INVALID_FILE_SIGNATURE",
      status: 400,
    } satisfies Partial<ArtifactSubmissionError>);

    expect(chains.artifact_submissions.insert).not.toHaveBeenCalled();
    expect(chains.artifact_submission_files.insert).not.toHaveBeenCalled();
    expect(env.STORAGE_BUCKET.put).not.toHaveBeenCalled();
  });

  it("rejects zip bombs before any submission row or R2 object is created", async () => {
    const chains = createSubmitChains();
    const supabase = createSupabase(chains);
    const env = createEnv();
    const bomb = buildZipBuffer([
      { name: "xl/data.bin", compressedSize: 100, uncompressedSize: 100_000_000 },
    ]);
    const file = createTestFile([bomb], "answer.xlsx");

    await expect(
      submitArtifactSubmission(
        supabase,
        env,
        "user-1",
        { artifact_id: "artifact-1", answers: [{ question_id: "question-1" }] },
        new Map([["question-1", file]]),
      ),
    ).rejects.toMatchObject({
      code: "ZIP_BOMB_DETECTED",
      status: 400,
    } satisfies Partial<ArtifactSubmissionError>);

    expect(chains.artifact_submissions.insert).not.toHaveBeenCalled();
    expect(chains.artifact_submission_files.insert).not.toHaveBeenCalled();
    expect(env.STORAGE_BUCKET.put).not.toHaveBeenCalled();
  });

  it("deletes the orphaned R2 object when the file row insert fails", async () => {
    const chains = createSubmitChains({ fileInsert: err("insert failed") });
    const supabase = createSupabase(chains);
    const env = createEnv();
    const file = createTestFile([xlsxBuffer], "answer.xlsx");

    await expect(
      submitArtifactSubmission(
        supabase,
        env,
        "user-1",
        { artifact_id: "artifact-1", answers: [{ question_id: "question-1" }] },
        new Map([["question-1", file]]),
      ),
    ).rejects.toThrow(
      /Failed to save uploaded artifact file \(question .*, submission .*\): insert failed/,
    );

    expect(env.STORAGE_BUCKET.delete).toHaveBeenCalledWith(
      "submissions/artifacts/users/user-1/artifact-1/submission-1/00000000-0000-4000-8000-000000000001-answer.xlsx",
    );
    expect(chains.artifact_submission_files.delete).toHaveBeenCalled();
    expect(chains.artifact_submission_answers.delete).toHaveBeenCalled();
    expect(chains.artifact_submissions.delete).toHaveBeenCalled();
  });

  it("returns the original submission for a retried request with the same idempotency key", async () => {
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
    const chains = createSubmitChains({
      latest: ok(existing),
      insertSingle: { data: null, error: { code: "23505", message: "duplicate key" } },
    });
    // biome-ignore lint/suspicious/noThenProperty: this mocks awaited Supabase query builders.
    chains.artifact_submission_files.then = vi.fn((resolve: (value: QueryResult) => unknown) =>
      Promise.resolve(
        ok([{ id: "file-1", question_id: "question-1", file_name: "answer.xlsx" }]),
      ).then(resolve),
    );
    // Call 1: findSubmissionByIdempotencyKey (none). Call 2: getLatestSubmission
    // (existing). Call 3: findSubmissionByIdempotencyKey again after the
    // concurrent-race 23505 on the idempotency index.
    chains.artifact_submissions.maybeSingle
      .mockResolvedValueOnce(ok(null))
      .mockResolvedValueOnce(ok(existing))
      .mockResolvedValueOnce(ok(existing));
    const supabase = createSupabase(chains);
    const file = createTestFile([xlsxBuffer], "answer.xlsx");

    const result = await submitArtifactSubmission(
      supabase,
      createEnv(),
      "user-1",
      { artifact_id: "artifact-1", answers: [{ question_id: "question-1" }] },
      new Map([["question-1", file]]),
      "idem-key-1",
    );

    expect(result.duplicate).toBe(true);
    expect(result.submission_id).toBe("submission-1");
    expect(result.evaluation_status).toBe("pending");
    expect(result.files).toEqual([
      { file_id: "file-1", question_id: "question-1", file_name: "answer.xlsx" },
    ]);
    expect(chains.artifact_submissions.insert).toHaveBeenCalledTimes(1);
  });

  it("returns the existing submission without demoting is_latest on a retried request", async () => {
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
    const chains = createSubmitChains({});
    // findSubmissionByIdempotencyKey hit on the first call - the retry short-
    // circuits before getLatestSubmission, so neither the demote nor the
    // insert runs and the exactly-one-latest invariant survives the retry.
    chains.artifact_submissions.maybeSingle.mockResolvedValueOnce(ok(existing));
    const supabase = createSupabase(chains);
    const file = createTestFile([xlsxBuffer], "answer.xlsx");

    const result = await submitArtifactSubmission(
      supabase,
      createEnv(),
      "user-1",
      { artifact_id: "artifact-1", answers: [{ question_id: "question-1" }] },
      new Map([["question-1", file]]),
      "idem-key-1",
    );

    expect(result.duplicate).toBe(true);
    expect(result.submission_id).toBe("submission-1");
    expect(chains.artifact_submissions.insert).not.toHaveBeenCalled();
    expect(chains.artifact_submissions.update).not.toHaveBeenCalled();
  });

  it("rejects resubmission when the latest submission is already accepted", async () => {
    const chains = createSubmitChains({
      latest: ok({
        id: "submission-1",
        artifact_id: "artifact-1",
        user_id: "user-1",
        user_module_progress_id: "progress-1",
        attempt_no: 1,
        version_label: "v1",
        is_latest: true,
        status: "accepted",
        previous_submission_id: null,
        submitted_at: "2026-08-05T10:00:00.000Z",
        sealed_at: "2026-08-06T00:00:00.000Z",
      }),
    });
    const supabase = createSupabase(chains);
    const file = createTestFile([xlsxBuffer], "answer.xlsx");

    await expect(
      submitArtifactSubmission(
        supabase,
        createEnv(),
        "user-1",
        { artifact_id: "artifact-1", answers: [{ question_id: "question-1" }] },
        new Map([["question-1", file]]),
      ),
    ).rejects.toMatchObject({
      code: "SUBMISSION_ALREADY_ACCEPTED",
      status: 409,
    } satisfies Partial<ArtifactSubmissionError>);

    expect(chains.artifact_submissions.insert).not.toHaveBeenCalled();
  });

  it("routes unreadable file submissions to human_review with neutral XP", async () => {
    const chains = createSubmitChains();
    const allChains = { ...chains, xp_events: mockChain(), artifact_evaluation_flows: mockChain() };
    const supabase = createSupabase(allChains);
    const corruptZip = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
    const file = createTestFile([corruptZip, "garbage"], "broken.xlsx");

    const result = await submitArtifactSubmission(
      supabase,
      createEnv(),
      "user-1",
      { artifact_id: "artifact-1", answers: [{ question_id: "question-1" }] },
      new Map([["question-1", file]]),
    );

    expect(result.status).toBe("human_review");
    expect(result.evaluation?.decision).toBe("human_review");
    expect(result.evaluation?.overall_score).toBe(0);
    expect(result.evaluation?.confidence).toBe(0);

    const flowsPayload = allChains.artifact_evaluation_flows.upsert.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(flowsPayload).toMatchObject({
      decision: "human_review",
      overall_status: "human_review",
      metadata: {
        debug_telemetry: {
          provider: "fallback",
          calculatedXp: 0,
          validatedDecision: "human_review",
          stage1Check: { isAssessable: false },
        },
      },
    });
    expect(allChains.artifact_submission_files.insert).toHaveBeenCalled();
    expect(allChains.xp_events.insert).not.toHaveBeenCalled();
  });
});

describe("artifact evaluation input builder", () => {
  const questionDetails = [
    {
      id: "question-1",
      title: "Readiness Sheet",
      description: "Complete the course readiness sheet.",
      response_type: "file",
      instructions: { pass_criteria: "All required fields completed" },
    },
  ];

  it("extracts readable file content into the eval input snippet", async () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Claim ID", "Confidence"],
      ["C-001", "High"],
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, "Readiness");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const file = new File([buffer], "Readiness.xlsx");

    const result = await buildArtifactEvaluationInput({
      artifactMeta: { artifact_type: "final", passing_score: 60, total_score: 100 },
      questionDetails,
      input: { artifact_id: "artifact-1", answers: [{ question_id: "question-1" }] },
      filesByQuestionId: new Map([["question-1", file]]),
      attemptNo: 1,
    });

    expect(result.answers[0]?.fileName).toBe("Readiness.xlsx");
    expect(result.answers[0]?.fileContentSnippet).toContain("C-001");
    expect(result.answers[0]?.fileContentSnippet).toContain("High");
  });

  it("leaves the snippet undefined when file content is not readable", async () => {
    const corruptZip = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
    const file = new File([corruptZip, "garbage-not-a-valid-zip"], "broken.xlsx");

    const result = await buildArtifactEvaluationInput({
      artifactMeta: { artifact_type: "final", passing_score: 60, total_score: 100 },
      questionDetails,
      input: { artifact_id: "artifact-1", answers: [{ question_id: "question-1" }] },
      filesByQuestionId: new Map([["question-1", file]]),
      attemptNo: 1,
    });

    expect(result.answers[0]?.fileName).toBe("broken.xlsx");
    expect(result.answers[0]?.fileContentSnippet).toBeUndefined();
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
