import type { ArtifactEvaluationInput } from "@functions/lib/artifact-evaluator";
import {
  extractArtifactContent,
  METRIC,
  metrics,
  processAndSaveArtifactEvaluation,
  sanitizeContentDispositionFilename,
} from "@functions/lib/artifact-evaluator";
import {
  asQueryGateway,
  QueryGatewayDatabaseError,
  type QueryGatewaySource,
} from "@functions/lib/query-gateway";
import { createObjectKey } from "@functions/lib/r2-client";
import type { LteEnv } from "@functions/lib/types";
import type { CompleteSubmissionInput } from "@functions/schemas";
import { apiLogger } from "@functions/shared/logger";
import { fetchArtifactTemplateContent, fetchEvaluationContext } from "./evaluation-context";
import {
  ArtifactSubmissionError,
  validateArtifactFileContent,
  validateFileForQuestion,
} from "./file-validation";
import {
  type ArtifactMetaRow,
  type ArtifactQuestionDetailRow,
  type ArtifactQuestionRow,
  type ArtifactSubmissionAnswerRow,
  type ArtifactSubmissionFileRow,
  type ArtifactSubmissionRow,
  artifactEvaluationFlowReadPolicy,
  artifactMetaReadPolicy,
  artifactQuestionDetailsReadPolicy,
  artifactQuestionsReadPolicy,
  artifactSubmissionAnswersReadPolicy,
  artifactSubmissionAnswersUpsertPolicy,
  artifactSubmissionDeletePolicy,
  artifactSubmissionDemotePolicy,
  artifactSubmissionFileInsertPolicy,
  artifactSubmissionInsertPolicy,
  artifactSubmissionReadPolicy,
  type EvaluationFlowRow,
  moduleArtifactAccessPolicy,
  moduleContentAccessPolicy,
  submissionFilesReadPolicy,
  userModuleProgressAccessPolicy,
} from "./query-policies";

export { ArtifactSubmissionError } from "./file-validation";

function dbMessage(error: unknown): string {
  return error instanceof QueryGatewayDatabaseError ? error.message : "unknown error";
}

function createPublicFileUrl(publicDomain: string | undefined, objectKey: string): string | null {
  const baseUrl = publicDomain?.trim().replace(/\/+$/, "");
  return baseUrl ? `${baseUrl}/${objectKey}` : null;
}

async function requireModuleProgress(
  source: QueryGatewaySource,
  artifactId: string,
  userId: string,
): Promise<string> {
  const qb = asQueryGateway(source);
  let artifact: { id: string; modules_content_id: string } | null = null;
  try {
    artifact = (await qb.read(moduleArtifactAccessPolicy, {
      filters: [
        { column: "id", op: "eq", value: artifactId },
        { column: "is_active", op: "eq", value: true },
      ],
      result: "single",
    })) as { id: string; modules_content_id: string } | null;
  } catch {
    artifact = null;
  }

  if (!artifact) {
    throw new ArtifactSubmissionError("Artifact was not found.", 404, "ARTIFACT_NOT_FOUND");
  }

  let moduleContent: { id: string; module_id: string } | null = null;
  try {
    moduleContent = (await qb.read(moduleContentAccessPolicy, {
      filters: [
        { column: "id", op: "eq", value: artifact.modules_content_id },
        { column: "is_active", op: "eq", value: true },
      ],
      result: "single",
    })) as { id: string; module_id: string } | null;
  } catch {
    moduleContent = null;
  }

  if (!moduleContent) {
    throw new ArtifactSubmissionError(
      "Artifact module content was not found.",
      404,
      "ARTIFACT_MODULE_NOT_FOUND",
    );
  }

  let progress: { id: string } | null = null;
  try {
    progress = (await qb.read(userModuleProgressAccessPolicy, {
      auth: { userId },
      filters: [{ column: "module_id", op: "eq", value: moduleContent.module_id }],
      result: "maybeSingle",
    })) as { id: string } | null;
  } catch (progressError) {
    throw new Error(
      `Failed to validate artifact access (artifact ${artifactId}, user ${userId}): ${dbMessage(progressError)}`,
    );
  }
  if (!progress) {
    throw new ArtifactSubmissionError(
      "Artifact is not available for this learner.",
      403,
      "ARTIFACT_FORBIDDEN",
    );
  }

  return progress.id;
}

async function getLatestSubmission(
  source: QueryGatewaySource,
  artifactId: string,
  userId: string,
): Promise<ArtifactSubmissionRow | null> {
  const qb = asQueryGateway(source);
  try {
    return (
      ((await qb.read(artifactSubmissionReadPolicy, {
        auth: { userId },
        filters: [
          { column: "artifact_id", op: "eq", value: artifactId },
          { column: "is_latest", op: "eq", value: true },
        ],
        result: "maybeSingle",
      })) as ArtifactSubmissionRow | null) ?? null
    );
  } catch (error) {
    throw new Error(
      `Failed to fetch latest artifact submission (artifact ${artifactId}, user ${userId}): ${dbMessage(error)}`,
    );
  }
}

async function findSubmissionByIdempotencyKey(
  source: QueryGatewaySource,
  userId: string,
  artifactId: string,
  idempotencyKey: string,
): Promise<ArtifactSubmissionRow | null> {
  const qb = asQueryGateway(source);
  try {
    return (
      ((await qb.read(artifactSubmissionReadPolicy, {
        auth: { userId },
        filters: [
          { column: "artifact_id", op: "eq", value: artifactId },
          { column: "idempotency_key", op: "eq", value: idempotencyKey },
        ],
        result: "maybeSingle",
      })) as ArtifactSubmissionRow | null) ?? null
    );
  } catch (error) {
    throw new Error(
      `Failed to fetch duplicate artifact submission (user ${userId}, artifact ${artifactId}): ${dbMessage(error)}`,
    );
  }
}

async function createSubmissionAttempt(
  source: QueryGatewaySource,
  artifactId: string,
  userId: string,
  moduleProgressId: string,
  idempotencyKey?: string,
): Promise<{ submission: ArtifactSubmissionRow; duplicate: boolean }> {
  const qb = asQueryGateway(source);

  // P0-2: a retried request with the same idempotency key returns the original
  // row BEFORE any state changes. Checking first is required: demoting
  // is_latest on the retry path would corrupt the exactly-one-latest invariant
  // (the demoted row would be returned as the "duplicate", leaving no latest).
  if (idempotencyKey) {
    const existing = await findSubmissionByIdempotencyKey(
      source,
      userId,
      artifactId,
      idempotencyKey,
    );
    if (existing) {
      return { submission: existing, duplicate: true };
    }
  }

  // P1-1: a unique-violation retry re-reads the latest row, so a concurrent
  // insert converges instead of failing. The uq_artifact_submissions_latest
  // partial unique index guarantees exactly one latest row either way.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const latest = await getLatestSubmission(source, artifactId, userId);

    // P0-3: accepted/sealed submissions are final; resubmission is rejected.
    if (latest && (latest.status === "accepted" || latest.sealed_at !== null)) {
      throw new ArtifactSubmissionError(
        "This artifact has already been accepted and cannot be resubmitted.",
        409,
        "SUBMISSION_ALREADY_ACCEPTED",
      );
    }

    if (latest) {
      try {
        await qb.update(artifactSubmissionDemotePolicy, {
          data: { is_latest: false, updated_at: new Date().toISOString() },
          filters: [{ column: "id", op: "eq", value: latest.id }],
        });
      } catch (error) {
        throw new Error(
          `Failed to update previous artifact submission (submission ${latest.id}, artifact ${artifactId}): ${dbMessage(error)}`,
        );
      }
    }

    const attemptNo = (latest?.attempt_no ?? 0) + 1;
    const insertPayload: Record<string, unknown> = {
      artifact_id: artifactId,
      user_module_progress_id: moduleProgressId,
      attempt_no: attemptNo,
      version_label: `v${attemptNo}`,
      previous_submission_id: latest?.id ?? null,
      status: "submitted",
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (idempotencyKey) {
      insertPayload["idempotency_key"] = idempotencyKey;
    }

    let data: ArtifactSubmissionRow | null = null;
    let error: { code?: string; message?: string } | null = null;
    try {
      data = (await qb.insert(artifactSubmissionInsertPolicy, insertPayload, {
        auth: { userId },
        result: "single",
      })) as ArtifactSubmissionRow | null;
    } catch (insertError) {
      if (insertError instanceof QueryGatewayDatabaseError) {
        error = insertError.cause as { code?: string; message?: string };
      } else {
        throw insertError;
      }
    }

    if (!error && data) {
      return { submission: data, duplicate: false };
    }

    if (error?.code === "23505") {
      // P0-2 race: a concurrent request with the same idempotency key won the
      // insert between the early lookup and this insert - return its row.
      if (idempotencyKey) {
        const existing = await findSubmissionByIdempotencyKey(
          source,
          userId,
          artifactId,
          idempotencyKey,
        );
        if (existing) {
          return { submission: existing, duplicate: true };
        }
      }
      // P1-1: concurrent attempt_no / is_latest collision - retry once.
      apiLogger.warn("Artifact submission insert collided; retrying once.", {
        artifactId,
        userId,
        attemptNo,
      });
      continue;
    }

    throw new Error(
      `Failed to create artifact submission (artifact ${artifactId}, user ${userId}, attempt ${attemptNo}): ${error?.message ?? "unknown error"}`,
    );
  }

  throw new Error(
    `Failed to create artifact submission after retrying a concurrent insert (artifact ${artifactId}, user ${userId}).`,
  );
}

async function listArtifactQuestions(
  source: QueryGatewaySource,
  artifactId: string,
): Promise<ArtifactQuestionRow[]> {
  const qb = asQueryGateway(source);
  try {
    return (
      ((await qb.read(artifactQuestionsReadPolicy, {
        filters: [
          { column: "artifact_id", op: "eq", value: artifactId },
          { column: "is_active", op: "eq", value: true },
        ],
        sort: [{ column: "question_order", ascending: true }],
      })) as ArtifactQuestionRow[] | null) ?? []
    );
  } catch (error) {
    throw new Error(
      `Failed to fetch artifact questions (artifact ${artifactId}): ${dbMessage(error)}`,
    );
  }
}

export interface ArtifactSubmissionResult {
  submission_id: string;
  attempt_no: number;
  version_label: string;
  submitted_at: string | null;
  status: "submitted" | "accepted" | "resubmission_required" | "human_review";
  evaluation_status: "pending" | "completed";
  /** True when this request was a duplicate of an already-processed one. */
  duplicate: boolean;
  evaluation?: {
    overall_score: number;
    confidence: number;
    decision: "pass" | "revise_and_resubmit" | "human_review";
    rubric_rows: unknown[];
    feedback: string;
    improvements: string;
    calculated_xp: number;
    event_type?: string;
  };
  files: Array<{ file_id: string; question_id: string; file_name: string }>;
}

export async function submitArtifactSubmission(
  source: QueryGatewaySource,
  env: Pick<LteEnv, "STORAGE_BUCKET" | "R2_PUBLIC_DOMAIN" | "OPENROUTER_API_KEY">,
  userId: string,
  input: CompleteSubmissionInput,
  filesByQuestionId: Map<string, File>,
  idempotencyKey?: string,
): Promise<ArtifactSubmissionResult> {
  const qb = asQueryGateway(source);
  const moduleProgressId = await requireModuleProgress(source, input.artifact_id, userId);
  const questions = await listArtifactQuestions(source, input.artifact_id);
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const answerByQuestionId = new Map(input.answers.map((answer) => [answer.question_id, answer]));

  for (const answer of input.answers) {
    if (!questionById.has(answer.question_id)) {
      throw new ArtifactSubmissionError(
        "Submitted answer does not belong to this artifact.",
        400,
        "ANSWER_QUESTION_INVALID",
      );
    }
  }

  for (const question of questions) {
    const answer = answerByQuestionId.get(question.id);
    const file = filesByQuestionId.get(question.id);
    if (!answer && !file && question.response_required) {
      throw new ArtifactSubmissionError(
        "A required artifact answer is missing.",
        400,
        "REQUIRED_ANSWER_MISSING",
      );
    }
    if (!answer && !file) continue;

    if (question.response_type === "text" && question.response_required && !answer?.text_response) {
      throw new ArtifactSubmissionError(
        "A required text answer is missing.",
        400,
        "TEXT_RESPONSE_REQUIRED",
      );
    }
    if (question.response_type === "url" && question.response_required && !answer?.url_response) {
      throw new ArtifactSubmissionError(
        "A required URL answer is missing.",
        400,
        "URL_RESPONSE_REQUIRED",
      );
    }
    if (answer?.url_response && new URL(answer.url_response).protocol !== "https:") {
      throw new ArtifactSubmissionError("Artifact URLs must use HTTPS.", 400, "HTTPS_URL_REQUIRED");
    }
    if (question.response_type === "file" && question.response_required && !file) {
      throw new ArtifactSubmissionError(
        "A required file answer is missing.",
        400,
        "FILE_RESPONSE_REQUIRED",
      );
    }
  }

  // Phase 3: read each file's bytes exactly once and reuse them for both
  // content validation and text extraction (was 2-3 arrayBuffer() per file).
  const fileContexts = new Map<
    string,
    { file: File; question: ArtifactQuestionRow; extension: string; buffer: ArrayBuffer }
  >();
  for (const [questionId, file] of filesByQuestionId) {
    const question = questionById.get(questionId);
    if (!question) continue; // matches the upload loop: stray files are ignored
    const extension = validateFileForQuestion(file, question);
    // P1-2/P1-3: reject renamed binaries and zip bombs before any
    // submission row or R2 object is created.
    const buffer = await file.arrayBuffer();
    await validateArtifactFileContent(buffer, extension, file.name);
    fileContexts.set(questionId, { file, question, extension, buffer });
  }

  const created = await createSubmissionAttempt(
    source,
    input.artifact_id,
    userId,
    moduleProgressId,
    idempotencyKey,
  );
  if (created.duplicate) {
    // P0-2: the same request was already processed - return the original
    // submission instead of creating a new attempt.
    return buildDuplicateSubmissionResponse(source, env, userId, created.submission);
  }
  const submission = created.submission;
  const now = new Date().toISOString();

  const uploadedFiles: Array<{ file_id: string; question_id: string; file_name: string }> = [];
  const uploadedObjectKeys: string[] = [];

  // P0-2: everything after attempt creation - answer upsert, uploads, meta
  // fetch, evaluation - is one rollback envelope: any failure deletes the
  // whole attempt so a retried idempotency key re-runs the full flow instead
  // of finding a half-built submission with no evaluation flow (the "stuck
  // pending" failure mode). The submission row's children (answers, files,
  // evaluation flows) cascade-delete with it; R2 objects are cleaned up
  // separately.
  let evalResult: Awaited<ReturnType<typeof processAndSaveArtifactEvaluation>>;
  try {
    const answerRows = input.answers
      .filter((answer) => answer.text_response || answer.url_response)
      .map((answer) => ({
        submission_id: submission.id,
        question_id: answer.question_id,
        text_response: answer.text_response || null,
        url_response: answer.url_response || null,
        updated_at: now,
      }));

    if (answerRows.length > 0) {
      try {
        await qb.upsert(artifactSubmissionAnswersUpsertPolicy, answerRows);
      } catch (error) {
        throw new Error(
          `Failed to save artifact answers (submission ${submission.id}, artifact ${input.artifact_id}): ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        );
      }
    }

    for (const [questionId, { file, extension }] of fileContexts) {
      const fileId = crypto.randomUUID();
      const objectKey = createObjectKey({
        namespace: "submissions/artifacts",
        ownerId: userId,
        entityId: input.artifact_id,
        recordId: submission.id,
        fileId,
        fileName: file.name,
      });

      await env.STORAGE_BUCKET.put(objectKey, file.stream(), {
        httpMetadata: {
          contentType: file.type || "application/octet-stream",
          contentDisposition: `attachment; filename="${sanitizeContentDispositionFilename(file.name)}"`,
        },
      });
      uploadedObjectKeys.push(objectKey);

      try {
        await qb.insert(artifactSubmissionFileInsertPolicy, {
          id: fileId,
          submission_id: submission.id,
          question_id: questionId,
          file_name: file.name,
          file_url: createPublicFileUrl(env.R2_PUBLIC_DOMAIN, objectKey),
          object_key: objectKey,
          file_type: extension,
          file_size_bytes: file.size,
        });
      } catch (error) {
        throw new Error(
          `Failed to save uploaded artifact file (question ${questionId}, submission ${submission.id}): ${dbMessage(error)}`,
        );
      }

      uploadedFiles.push({
        file_id: fileId,
        question_id: questionId,
        file_name: file.name,
      });
    }

    // Fetch full artifact details for AI Evaluation
    let artifactMeta: ArtifactMetaRow | null = null;
    try {
      artifactMeta = (await qb.read(artifactMetaReadPolicy, {
        filters: [{ column: "id", op: "eq", value: input.artifact_id }],
        result: "single",
      })) as ArtifactMetaRow | null;
    } catch (error) {
      throw new Error(
        `Failed to fetch artifact meta (artifact ${input.artifact_id}): ${dbMessage(error)}`,
      );
    }

    let questionDetails: ArtifactQuestionDetailRow[] | null = null;
    try {
      questionDetails = (await qb.read(artifactQuestionDetailsReadPolicy, {
        filters: [
          { column: "artifact_id", op: "eq", value: input.artifact_id },
          { column: "is_active", op: "eq", value: true },
        ],
      })) as ArtifactQuestionDetailRow[] | null;
    } catch (error) {
      throw new Error(
        `Failed to fetch artifact questions (artifact ${input.artifact_id}): ${dbMessage(error)}`,
      );
    }

    const evalInput = await buildArtifactEvaluationInput({
      querySource: source,
      artifactMeta: artifactMeta ?? null,
      questionDetails: questionDetails ?? [],
      input,
      filesByQuestionId,
      // Phase 3: reuse the bytes already read for signature validation instead
      // of arrayBuffer()-ing every file a second time.
      preReadBuffers: new Map(
        [...fileContexts].map(([questionId, ctx]) => [questionId, ctx.buffer]),
      ),
      attemptNo: submission.attempt_no,
    });

    evalResult = await processAndSaveArtifactEvaluation(
      source,
      env,
      submission.id,
      evalInput,
      userId,
      moduleProgressId,
    );
  } catch (error) {
    // P0-2: roll back the partial attempt (the row cascade-deletes its
    // answers, files and evaluation flows) so a retried idempotency key
    // re-runs the whole flow instead of returning a half-built "duplicate"
    // submission. Best-effort: the original error always wins.
    await rollbackArtifactSubmission(source, env, submission.id, uploadedObjectKeys);
    throw error;
  }

  return {
    submission_id: submission.id,
    attempt_no: submission.attempt_no,
    version_label: submission.version_label ?? `v${submission.attempt_no}`,
    submitted_at: submission.submitted_at,
    status:
      evalResult.decision === "pass"
        ? "accepted"
        : evalResult.decision === "human_review"
          ? "human_review"
          : "resubmission_required",
    evaluation_status: "completed",
    duplicate: false,
    evaluation: {
      overall_score: evalResult.overallScore,
      confidence: evalResult.confidence,
      decision: evalResult.decision,
      rubric_rows: evalResult.rubricRows,
      feedback: evalResult.feedback,
      improvements: evalResult.singleImprovementPoint,
      calculated_xp: evalResult.calculatedXp,
      event_type: evalResult.eventType,
    },
    files: uploadedFiles,
  };
}

/**
 * P0-2: best-effort rollback of a partial submission attempt. The submission
 * row's children (answers, files, evaluation flows) cascade-delete with it;
 * uploaded R2 objects are deleted too. Never silent: every failure is logged.
 */
async function rollbackArtifactSubmission(
  source: QueryGatewaySource,
  env: Pick<LteEnv, "STORAGE_BUCKET">,
  submissionId: string,
  uploadedObjectKeys: string[],
): Promise<void> {
  try {
    const qb = asQueryGateway(source);
    await qb.delete(artifactSubmissionDeletePolicy, {
      filters: [{ column: "id", op: "eq", value: submissionId }],
    });
  } catch (rollbackError) {
    apiLogger.error("Failed to roll back partial artifact submission.", rollbackError, {
      submissionId,
    });
  }
  await cleanupUploadedObjects(env, uploadedObjectKeys);
}

/**
 * P0-4: best-effort deletion of R2 objects whose DB persistence failed.
 * Never silent: every cleanup attempt is logged with its outcome.
 */
async function cleanupUploadedObjects(
  env: Pick<LteEnv, "STORAGE_BUCKET">,
  objectKeys: string[],
): Promise<void> {
  for (const objectKey of objectKeys) {
    try {
      await env.STORAGE_BUCKET.delete(objectKey);
      apiLogger.warn("Deleted orphaned R2 object after persistence failure.", { objectKey });
    } catch (cleanupError) {
      apiLogger.error(
        "Failed to delete orphaned R2 object after persistence failure.",
        cleanupError,
        {
          objectKey,
        },
      );
    }
  }
}

/**
 * P0-2: response for a duplicate submission request - reuses the original
 * submission, its files, and its current evaluation flow (if completed).
 */
async function buildDuplicateSubmissionResponse(
  source: QueryGatewaySource,
  env: Pick<LteEnv, "STORAGE_BUCKET" | "R2_PUBLIC_DOMAIN" | "OPENROUTER_API_KEY">,
  userId: string,
  submission: ArtifactSubmissionRow,
): Promise<ArtifactSubmissionResult> {
  const { data: flow, error: flowError } = await fetchCurrentEvaluationFlow(source, submission.id);

  if (flowError) {
    throw new Error(
      `Failed to fetch evaluation flow for duplicate submission (${submission.id}): ${flowError.message}`,
    );
  }

  const qb = asQueryGateway(source);
  let fileRows: Array<{ id: string; question_id: string; file_name: string }> | null = null;
  try {
    fileRows = (await qb.read(submissionFilesReadPolicy, {
      filters: [{ column: "submission_id", op: "eq", value: submission.id }],
    })) as Array<{ id: string; question_id: string; file_name: string }> | null;
  } catch (error) {
    throw new Error(
      `Failed to fetch submission files (submission ${submission.id}): ${dbMessage(error)}`,
    );
  }

  // P0-2: a duplicate request with no flow row means the original request
  // died mid-evaluation (e.g. isolate timeout/kill): the submission, its
  // answers and files persisted, but no evaluation was ever written. Instead
  // of returning "pending" forever, re-run the evaluation from the persisted
  // rows and R2 objects, then return the completed result.
  let currentFlow = flow;
  if (!currentFlow) {
    currentFlow = await rerunEvaluationForDuplicateSubmission(source, env, userId, submission);
    if (!currentFlow) {
      throw new Error(
        `Evaluation re-run completed without a flow row (submission ${submission.id}).`,
      );
    }
  }

  const meta = (currentFlow.metadata as Record<string, unknown> | null) ?? null;

  return {
    submission_id: submission.id,
    attempt_no: submission.attempt_no,
    version_label: submission.version_label ?? `v${submission.attempt_no}`,
    submitted_at: submission.submitted_at,
    status: submission.status as ArtifactSubmissionResult["status"],
    evaluation_status: "completed",
    duplicate: true,
    evaluation: {
      overall_score: currentFlow.score ?? 0,
      confidence: (meta?.["confidence"] as number | null) ?? 0,
      decision:
        (currentFlow.decision as "pass" | "revise_and_resubmit" | "human_review") ?? "human_review",
      rubric_rows: (meta?.["rubric_rows"] as unknown[]) ?? [],
      feedback: currentFlow.feedback ?? "",
      improvements: currentFlow.improvements ?? "",
      calculated_xp: (meta?.["calculated_xp"] as number) ?? 0,
      event_type: (meta?.["event_type"] as string) ?? undefined,
    },
    files: (fileRows ?? []).map((fileRow) => ({
      file_id: fileRow.id,
      question_id: fileRow.question_id,
      file_name: fileRow.file_name,
    })),
  };
}

/**
 * Shared read of the current (is_current_stage) evaluation flow row for a
 * submission. Used by the duplicate-response path (before and after a
 * re-run) and by the status endpoint.
 */
async function fetchCurrentEvaluationFlow(
  source: QueryGatewaySource,
  submissionId: string,
): Promise<{ data: EvaluationFlowRow | null; error: { message: string } | null }> {
  const qb = asQueryGateway(source);
  try {
    const data = await qb.read(artifactEvaluationFlowReadPolicy, {
      filters: [
        { column: "submission_id", op: "eq", value: submissionId },
        { column: "is_current_stage", op: "eq", value: true },
      ],
      result: "maybeSingle",
    });
    return { data: data as EvaluationFlowRow | null, error: null };
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof QueryGatewayDatabaseError
          ? { message: error.message }
          : { message: error instanceof Error ? error.message : "unknown error" },
    };
  }
}

/**
 * P0-2: re-runs the AI evaluation for a submission whose original request died
 * before any flow row was written. Rebuilds the evaluation input from the
 * persisted answers and R2 objects, then delegates to the same persistence
 * path as a fresh submission. Returns the flow row it wrote (null only if the
 * persistence path silently succeeded without writing - it throws on write
 * failure, so this is effectively never). The flow upsert is idempotent per
 * (submission_id, stage), so concurrent retries converge on one flow row.
 */
async function rerunEvaluationForDuplicateSubmission(
  source: QueryGatewaySource,
  env: Pick<LteEnv, "STORAGE_BUCKET" | "R2_PUBLIC_DOMAIN" | "OPENROUTER_API_KEY">,
  userId: string,
  submission: ArtifactSubmissionRow,
): Promise<EvaluationFlowRow | null> {
  apiLogger.warn("Re-running evaluation for submission with no evaluation flow.", {
    submissionId: submission.id,
    artifactId: submission.artifact_id,
  });

  const qb = asQueryGateway(source);
  let artifactMeta: ArtifactMetaRow | null = null;
  try {
    artifactMeta = (await qb.read(artifactMetaReadPolicy, {
      filters: [{ column: "id", op: "eq", value: submission.artifact_id }],
      result: "single",
    })) as ArtifactMetaRow | null;
  } catch (error) {
    throw new Error(
      `Failed to fetch artifact meta for re-run (artifact ${submission.artifact_id}): ${dbMessage(error)}`,
    );
  }

  let questionDetails: ArtifactQuestionDetailRow[] | null = null;
  try {
    questionDetails = (await qb.read(artifactQuestionDetailsReadPolicy, {
      filters: [
        { column: "artifact_id", op: "eq", value: submission.artifact_id },
        { column: "is_active", op: "eq", value: true },
      ],
    })) as ArtifactQuestionDetailRow[] | null;
  } catch (error) {
    throw new Error(
      `Failed to fetch artifact questions for re-run (artifact ${submission.artifact_id}): ${dbMessage(error)}`,
    );
  }

  let answerRows: ArtifactSubmissionAnswerRow[] | null = null;
  try {
    answerRows = (await qb.read(artifactSubmissionAnswersReadPolicy, {
      filters: [{ column: "submission_id", op: "eq", value: submission.id }],
    })) as ArtifactSubmissionAnswerRow[] | null;
  } catch (error) {
    throw new Error(
      `Failed to fetch artifact answers for re-run (submission ${submission.id}): ${dbMessage(error)}`,
    );
  }

  let fileRows: ArtifactSubmissionFileRow[] | null = null;
  try {
    fileRows = (await qb.read(submissionFilesReadPolicy, {
      filters: [{ column: "submission_id", op: "eq", value: submission.id }],
    })) as ArtifactSubmissionFileRow[] | null;
  } catch (error) {
    throw new Error(
      `Failed to fetch artifact files for re-run (submission ${submission.id}): ${dbMessage(error)}`,
    );
  }

  const filesByQuestionId = new Map<string, File>();
  for (const fileRow of fileRows ?? []) {
    if (!fileRow.object_key) continue;
    const object = (await env.STORAGE_BUCKET.get(fileRow.object_key)) as {
      arrayBuffer: () => Promise<ArrayBuffer>;
    } | null;
    if (!object) continue;
    const bytes = await object.arrayBuffer();
    filesByQuestionId.set(
      fileRow.question_id,
      new File([bytes], fileRow.file_name, { type: fileRow.file_type }),
    );
  }

  const evalInput = await buildArtifactEvaluationInput({
    querySource: source,
    artifactMeta: artifactMeta ?? null,
    questionDetails: questionDetails ?? [],
    input: {
      artifact_id: submission.artifact_id,
      answers: (answerRows ?? []).map((answer) => ({
        question_id: answer.question_id,
        text_response: answer.text_response ?? undefined,
        url_response: answer.url_response ?? undefined,
      })),
    },
    filesByQuestionId,
    attemptNo: submission.attempt_no,
  });

  await processAndSaveArtifactEvaluation(
    source,
    env,
    submission.id,
    evalInput,
    userId,
    submission.user_module_progress_id,
  );

  const { data: flow, error: flowError } = await fetchCurrentEvaluationFlow(source, submission.id);
  if (flowError) {
    throw new Error(
      `Failed to fetch evaluation flow after re-run (submission ${submission.id}): ${flowError.message}`,
    );
  }
  return (flow as EvaluationFlowRow | null) ?? null;
}

export async function buildArtifactEvaluationInput(params: {
  querySource?: QueryGatewaySource;
  artifactMeta: ArtifactMetaRow | null;
  questionDetails: ArtifactQuestionDetailRow[];
  input: CompleteSubmissionInput;
  filesByQuestionId: Map<string, File>;
  preReadBuffers?: Map<string, ArrayBuffer>;
  attemptNo: number;
  evaluationContext?: ArtifactEvaluationInput["evaluationContext"];
  templateContentByQuestionId?: Map<string, string>;
}): Promise<ArtifactEvaluationInput> {
  const extractedByQuestionId = new Map<string, string>();
  for (const [questionId, file] of params.filesByQuestionId) {
    const extracted = await extractArtifactContent(file, params.preReadBuffers?.get(questionId));
    if (extracted.isReadable) {
      extractedByQuestionId.set(questionId, extracted.extractedText);
    } else {
      metrics.inc(METRIC.EXTRACTION_FAILED);
      apiLogger.warn("Artifact file content is not readable for AI evaluation.", {
        questionId,
        fileName: file.name,
        format: extracted.format,
        artifactId: params.input.artifact_id,
      });
    }
  }

  let evaluationContext = params.evaluationContext;
  if (!evaluationContext && params.querySource) {
    evaluationContext = await fetchEvaluationContext(params.querySource, params.input.artifact_id);
  }

  let templateContentMap = params.templateContentByQuestionId;
  if (!templateContentMap && params.querySource) {
    templateContentMap = await fetchArtifactTemplateContent(
      params.querySource,
      params.input.artifact_id,
    );
  }

  return {
    artifactId: params.input.artifact_id,
    artifactType: (params.artifactMeta?.artifact_type as "practice" | "final") || "final",
    passingScore: params.artifactMeta?.passing_score ?? 60,
    totalScore: params.artifactMeta?.total_score ?? 100,
    questions: params.questionDetails.map((q) => ({
      id: q.id,
      title: q.title,
      description: q.description ?? "",
      responseType: q.response_type as "text" | "file" | "url",
      instructions: q.instructions,
    })),
    answers: params.input.answers.map((a) => {
      const fileObj = params.filesByQuestionId.get(a.question_id);
      const tplContent = templateContentMap
        ? (templateContentMap.get(a.question_id) ?? templateContentMap.get("__artifact__"))
        : undefined;
      return {
        questionId: a.question_id,
        textResponse: a.text_response,
        urlResponse: a.url_response,
        fileName: fileObj?.name,
        fileContentSnippet: fileObj
          ? (extractedByQuestionId.get(a.question_id) ?? undefined)
          : undefined,
        templateContent: tplContent ?? undefined,
      };
    }),
    attemptNo: params.attemptNo,
    evaluationContext,
  };
}

export async function getSubmissionEvaluationFlow(
  source: QueryGatewaySource,
  submissionId: string,
  userId: string,
) {
  const qb = asQueryGateway(source);
  let submission: { id: string } | null = null;
  try {
    submission = (await qb.read(artifactSubmissionReadPolicy, {
      auth: { userId },
      filters: [{ column: "id", op: "eq", value: submissionId }],
      result: "maybeSingle",
    })) as { id: string } | null;
  } catch (error) {
    throw new Error(
      `Failed to fetch submission evaluation flow (submission ${submissionId}): ${dbMessage(error)}`,
    );
  }

  if (!submission) {
    throw new ArtifactSubmissionError("Submission not found.", 404, "SUBMISSION_NOT_FOUND");
  }

  const { data: flow, error } = await fetchCurrentEvaluationFlow(qb, submissionId);

  if (error) throw new Error(`Failed to fetch evaluation flow: ${error.message}`);
  return flow;
}
