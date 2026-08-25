import { beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "../../../../../vendor/sheetjs/xlsx-0.20.3/xlsx.mjs";
import {
  type ArtifactSubmissionError,
  buildArtifactEvaluationInput,
  submitArtifactSubmission,
} from "../queries";
import type { QueryResult } from "./queries-helpers";
import {
  buildZipBuffer,
  createEnv,
  createSubmitChains,
  createSupabase,
  createTestFile,
  err,
  mockChain,
  ok,
  XLSX_CONTENT_TYPE,
  xlsxBuffer,
} from "./queries-helpers";

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
    // P0-2: the rollback deletes the submission row; its children (answers,
    // files, evaluation flows) cascade-delete with it.
    expect(chains.artifact_submissions.eq).toHaveBeenCalledWith("id", "submission-1");
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
    const flowRow = {
      id: "flow-1",
      submission_id: "submission-1",
      stage: "ai",
      status: "completed",
      score: 0,
      decision: "human_review",
      feedback: "AI evaluation is unavailable; a human reviewer must evaluate this submission.",
      improvements: null,
      completed_at: "2026-08-05T10:05:00.000Z",
      metadata: { confidence: 0, rubric_rows: [], calculated_xp: 0 },
    };
    const chains = createSubmitChains({
      latest: ok(existing),
      insertSingle: { data: null, error: { code: "23505", message: "duplicate key" } },
    });
    // P0-2: the duplicate response sees no flow row first (the original
    // request died mid-evaluation), re-runs the evaluation from the persisted
    // rows, then reads the flow row it wrote.
    chains.artifact_evaluation_flows.maybeSingle = vi
      .fn()
      .mockResolvedValueOnce(ok(null))
      .mockResolvedValueOnce(ok(flowRow));
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
    expect(result.evaluation_status).toBe("completed");
    expect(result.evaluation?.decision).toBe("human_review");
    expect(result.files).toEqual([
      { file_id: "file-1", question_id: "question-1", file_name: "answer.xlsx" },
    ]);
    expect(chains.artifact_submissions.insert).toHaveBeenCalledTimes(1);
    expect(chains.artifact_evaluation_flows.upsert).toHaveBeenCalled();
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
    // P0-2: no flow row on the first read -> the duplicate response re-runs
    // the evaluation, then reads the flow row it wrote.
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
          feedback: "AI evaluation is unavailable; a human reviewer must evaluate this submission.",
          improvements: null,
          completed_at: "2026-08-05T10:05:00.000Z",
          metadata: { confidence: 0, rubric_rows: [], calculated_xp: 0 },
        }),
      );
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
    expect(result.evaluation_status).toBe("completed");
    expect(chains.artifact_submissions.insert).not.toHaveBeenCalled();
    // The only update is the re-run's status write - never an is_latest demote.
    expect(chains.artifact_submissions.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "human_review" }),
    );
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
