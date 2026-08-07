import { processAndSaveArtifactEvaluation } from "@functions/lib/ai-engine/artifact-evaluator";
import { extractArtifactContent } from "@functions/lib/ai-engine/artifact-extractor";
import type { AIDebugTelemetry, ArtifactEvaluationInput } from "@functions/lib/ai-engine/types";
import { apiLogger } from "@functions/lib/logger";
import { createObjectKey } from "@functions/lib/r2-client";
import type { LteEnv } from "@functions/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CompleteSubmissionInput } from "./schemas";

interface ArtifactQuestionRow {
  id: string;
  artifact_id: string;
  response_type: "text" | "file" | "url";
  allowed_file_types: string[] | null;
  max_file_size_mb: number | null;
  response_required: boolean;
}

interface ArtifactSubmissionRow {
  id: string;
  artifact_id: string;
  user_id: string;
  user_module_progress_id: string;
  attempt_no: number;
  version_label: string | null;
  is_latest: boolean;
  status: string;
  previous_submission_id: string | null;
  submitted_at: string | null;
}

interface ArtifactFileRow {
  id: string;
  submission_id: string;
  question_id: string;
  file_name: string;
  file_url: string | null;
  object_key: string | null;
  file_type: string;
  file_size_bytes: number | null;
}

interface ArtifactMetaRow {
  artifact_type: string | null;
  passing_score: number | null;
  total_score: number | null;
}

interface ArtifactQuestionDetailRow {
  id: string;
  title: string;
  description: string | null;
  response_type: string;
  instructions: Record<string, unknown> | string | null;
}

export class ArtifactSubmissionError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code = "ARTIFACT_SUBMISSION_ERROR",
  ) {
    super(message);
    this.name = "ArtifactSubmissionError";
  }
}

export function normalizeFileExtension(fileName: string): string {
  return (fileName.includes(".") ? (fileName.split(".").pop() ?? "") : "")
    ?.trim()
    .replace(/^\./, "")
    .toLowerCase();
}

function getObjectKeyFromFileUrl(fileUrl: string): string {
  try {
    const url = new URL(fileUrl);
    return decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  } catch {
    return fileUrl.replace(/^\/+/, "");
  }
}

function createPublicFileUrl(publicDomain: string | undefined, objectKey: string): string | null {
  const baseUrl = publicDomain?.trim().replace(/\/+$/, "");
  return baseUrl ? `${baseUrl}/${objectKey}` : null;
}

function validateFileForQuestion(file: File, question: ArtifactQuestionRow): string {
  if (question.response_type !== "file") {
    throw new ArtifactSubmissionError(
      "This question does not accept file uploads.",
      400,
      "INVALID_RESPONSE_TYPE",
    );
  }

  const extension = normalizeFileExtension(file.name);
  const allowedTypes = question.allowed_file_types?.map((type) => type.toLowerCase()) ?? [];
  if (allowedTypes.length > 0 && !allowedTypes.includes(extension)) {
    throw new ArtifactSubmissionError(
      "This file type is not allowed for the artifact question.",
      400,
      "FILE_TYPE_NOT_ALLOWED",
    );
  }

  const maxBytes = (question.max_file_size_mb ?? 10) * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new ArtifactSubmissionError(
      "The selected file is larger than the allowed upload size.",
      400,
      "FILE_TOO_LARGE",
    );
  }

  return extension || "file";
}

async function requireModuleProgress(
  supabase: SupabaseClient,
  artifactId: string,
  userId: string,
): Promise<string> {
  const { data: artifact, error: artifactError } = await supabase
    .from("module_artifacts")
    .select("id, modules_content_id")
    .eq("id", artifactId)
    .eq("is_active", true)
    .single();

  if (artifactError || !artifact) {
    throw new ArtifactSubmissionError("Artifact was not found.", 404, "ARTIFACT_NOT_FOUND");
  }

  const { data: moduleContent, error: moduleContentError } = await supabase
    .from("modules_content")
    .select("id, module_id")
    .eq("id", artifact.modules_content_id)
    .eq("is_active", true)
    .single();

  if (moduleContentError || !moduleContent) {
    throw new ArtifactSubmissionError(
      "Artifact module content was not found.",
      404,
      "ARTIFACT_MODULE_NOT_FOUND",
    );
  }

  const { data: progress, error: progressError } = await supabase
    .from("user_module_progress")
    .select("id")
    .eq("module_id", moduleContent.module_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (progressError) {
    throw new Error(`Failed to validate artifact access: ${progressError.message}`);
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
  supabase: SupabaseClient,
  artifactId: string,
  userId: string,
): Promise<ArtifactSubmissionRow | null> {
  const { data, error } = await supabase
    .from("artifact_submissions")
    .select(
      "id, artifact_id, user_id, user_module_progress_id, attempt_no, version_label, is_latest, status, previous_submission_id, submitted_at",
    )
    .eq("artifact_id", artifactId)
    .eq("user_id", userId)
    .eq("is_latest", true)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch latest artifact submission: ${error.message}`);
  }

  return (data as ArtifactSubmissionRow | null) ?? null;
}

async function createSubmissionAttempt(
  supabase: SupabaseClient,
  artifactId: string,
  userId: string,
  moduleProgressId: string,
): Promise<ArtifactSubmissionRow> {
  const latest = await getLatestSubmission(supabase, artifactId, userId);
  if (latest) {
    const { error } = await supabase
      .from("artifact_submissions")
      .update({ is_latest: false, updated_at: new Date().toISOString() })
      .eq("id", latest.id);

    if (error) {
      throw new Error(`Failed to update previous artifact submission: ${error.message}`);
    }
  }

  const attemptNo = (latest?.attempt_no ?? 0) + 1;
  const { data, error } = await supabase
    .from("artifact_submissions")
    .insert({
      artifact_id: artifactId,
      user_id: userId,
      user_module_progress_id: moduleProgressId,
      attempt_no: attemptNo,
      version_label: `v${attemptNo}`,
      previous_submission_id: latest?.id ?? null,
      status: "submitted",
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select(
      "id, artifact_id, user_id, user_module_progress_id, attempt_no, version_label, is_latest, status, previous_submission_id, submitted_at",
    )
    .single();

  if (error || !data) {
    throw new Error(`Failed to create artifact submission: ${error?.message ?? "unknown error"}`);
  }

  return data as ArtifactSubmissionRow;
}

async function listArtifactQuestions(
  supabase: SupabaseClient,
  artifactId: string,
): Promise<ArtifactQuestionRow[]> {
  const { data, error } = await supabase
    .from("artifact_questions")
    .select(
      "id, artifact_id, response_type, allowed_file_types, max_file_size_mb, response_required",
    )
    .eq("artifact_id", artifactId)
    .eq("is_active", true)
    .order("question_order", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch artifact questions: ${error.message}`);
  }

  return (data as ArtifactQuestionRow[] | null) ?? [];
}

export async function submitArtifactSubmission(
  supabase: SupabaseClient,
  env: Pick<LteEnv, "STORAGE_BUCKET" | "R2_PUBLIC_DOMAIN" | "OPENROUTER_API_KEY">,
  userId: string,
  input: CompleteSubmissionInput,
  filesByQuestionId: Map<string, File>,
): Promise<{
  submission_id: string;
  attempt_no: number;
  version_label: string;
  submitted_at: string | null;
  status: "submitted" | "accepted" | "resubmission_required" | "human_review";
  evaluation_status: "pending" | "completed";
  evaluation?: {
    overall_score: number;
    decision: "pass" | "revise_and_resubmit" | "human_review";
    rubric_rows: unknown[];
    feedback: string;
    improvements: string;
    calculated_xp: number;
    debug_telemetry?: AIDebugTelemetry;
  };
  files: Array<{ file_id: string; question_id: string; file_name: string }>;
}> {
  const moduleProgressId = await requireModuleProgress(supabase, input.artifact_id, userId);
  const questions = await listArtifactQuestions(supabase, input.artifact_id);
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
    if (file) validateFileForQuestion(file, question);
  }

  const submission = await createSubmissionAttempt(
    supabase,
    input.artifact_id,
    userId,
    moduleProgressId,
  );
  const now = new Date().toISOString();
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
    const { error } = await supabase
      .from("artifact_submission_answers")
      .upsert(answerRows, { onConflict: "submission_id,question_id" });
    if (error) {
      throw new Error(`Failed to save artifact answers: ${error.message}`);
    }
  }

  const uploadedFiles: Array<{ file_id: string; question_id: string; file_name: string }> = [];

  for (const [questionId, file] of filesByQuestionId) {
    const question = questionById.get(questionId);
    if (!question) continue;

    const fileId = crypto.randomUUID();
    const extension = validateFileForQuestion(file, question);
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
        contentDisposition: `attachment; filename="${file.name.replace(/"/g, "")}"`,
      },
    });

    const { error } = await supabase.from("artifact_submission_files").insert({
      id: fileId,
      submission_id: submission.id,
      question_id: questionId,
      file_name: file.name,
      file_url: createPublicFileUrl(env.R2_PUBLIC_DOMAIN, objectKey),
      object_key: objectKey,
      file_type: extension,
      file_size_bytes: file.size,
    });

    if (error) {
      throw new Error(`Failed to save uploaded artifact file: ${error.message}`);
    }

    uploadedFiles.push({
      file_id: fileId,
      question_id: questionId,
      file_name: file.name,
    });
  }

  // Fetch full artifact details for AI Evaluation
  const { data: artifactMeta } = await supabase
    .from("module_artifacts")
    .select("artifact_type, passing_score, total_score")
    .eq("id", input.artifact_id)
    .single();

  const { data: questionDetails } = await supabase
    .from("artifact_questions")
    .select("id, title, description, response_type, instructions")
    .eq("artifact_id", input.artifact_id)
    .eq("is_active", true);

  const evalInput = await buildArtifactEvaluationInput({
    artifactMeta: (artifactMeta as ArtifactMetaRow | null) ?? null,
    questionDetails: (questionDetails as ArtifactQuestionDetailRow[] | null) ?? [],
    input,
    filesByQuestionId,
    attemptNo: submission.attempt_no,
  });

  const evalResult = await processAndSaveArtifactEvaluation(
    supabase,
    env,
    submission.id,
    evalInput,
    userId,
    moduleProgressId,
  );

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
    evaluation: {
      overall_score: evalResult.overallScore,
      decision: evalResult.decision,
      rubric_rows: evalResult.rubricRows,
      feedback: evalResult.feedback,
      improvements: evalResult.singleImprovementPoint,
      calculated_xp: evalResult.calculatedXp,
      debug_telemetry: evalResult.debugTelemetry,
    },
    files: uploadedFiles,
  };
}

export async function buildArtifactEvaluationInput(params: {
  artifactMeta: ArtifactMetaRow | null;
  questionDetails: ArtifactQuestionDetailRow[];
  input: CompleteSubmissionInput;
  filesByQuestionId: Map<string, File>;
  attemptNo: number;
}): Promise<ArtifactEvaluationInput> {
  const extractedByQuestionId = new Map<string, string>();
  for (const [questionId, file] of params.filesByQuestionId) {
    const extracted = await extractArtifactContent(file);
    if (extracted.isReadable) {
      extractedByQuestionId.set(questionId, extracted.extractedText);
    } else {
      apiLogger.warn("Artifact file content is not readable for AI evaluation.", {
        questionId,
        fileName: file.name,
        format: extracted.format,
      });
    }
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
      return {
        questionId: a.question_id,
        textResponse: a.text_response,
        urlResponse: a.url_response,
        fileName: fileObj?.name,
        fileContentSnippet: fileObj
          ? (extractedByQuestionId.get(a.question_id) ?? undefined)
          : undefined,
      };
    }),
    attemptNo: params.attemptNo,
  };
}

export async function requireOwnedFile(
  supabase: SupabaseClient,
  fileId: string,
  userId: string,
): Promise<ArtifactFileRow> {
  const { data, error } = await supabase
    .from("artifact_submission_files")
    .select(`
      id,
      submission_id,
      question_id,
      file_name,
      file_url,
      object_key,
      file_type,
      file_size_bytes,
      artifact_submissions!inner(user_id)
    `)
    .eq("id", fileId)
    .eq("artifact_submissions.user_id", userId)
    .single();

  if (error || !data) {
    throw new ArtifactSubmissionError("Artifact file was not found.", 404, "FILE_NOT_FOUND");
  }

  return data as ArtifactFileRow;
}

export async function createArtifactFileDownloadResponse(
  supabase: SupabaseClient,
  env: Pick<LteEnv, "STORAGE_BUCKET">,
  userId: string,
  fileId: string,
): Promise<Response> {
  const file = await requireOwnedFile(supabase, fileId, userId);
  const objectKey =
    file.object_key ?? (file.file_url ? getObjectKeyFromFileUrl(file.file_url) : null);
  if (!objectKey) {
    throw new ArtifactSubmissionError(
      "Artifact file is not available for download.",
      404,
      "FILE_NOT_AVAILABLE",
    );
  }

  const object = (await env.STORAGE_BUCKET.get(objectKey)) as {
    body?: BodyInit | null;
    httpMetadata?: { contentType?: string };
    size?: number;
  } | null;

  if (!object?.body) {
    throw new ArtifactSubmissionError(
      "Artifact file is not available for download.",
      404,
      "FILE_NOT_AVAILABLE",
    );
  }

  const headers = new Headers();
  headers.set("Content-Type", object.httpMetadata?.contentType ?? "application/octet-stream");
  headers.set("Content-Disposition", `attachment; filename="${file.file_name.replace(/"/g, "")}"`);
  if (object.size) headers.set("Content-Length", String(object.size));

  return new Response(object.body, { status: 200, headers });
}

export function createDownloadUrl(fileId: string, requestUrl: string): string {
  return new URL(`/api/v1/artifacts/files/${fileId}/download`, requestUrl).toString();
}

export async function getSubmissionEvaluationFlow(
  supabase: SupabaseClient,
  submissionId: string,
  userId: string,
) {
  const { data: submission } = await supabase
    .from("artifact_submissions")
    .select("id")
    .eq("id", submissionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!submission) {
    throw new ArtifactSubmissionError("Submission not found.", 404, "SUBMISSION_NOT_FOUND");
  }

  const { data: flow, error } = await supabase
    .from("artifact_evaluation_flows")
    .select(
      "id, submission_id, stage, status, score, decision, feedback, improvements, completed_at, metadata",
    )
    .eq("submission_id", submissionId)
    .eq("is_current_stage", true)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch evaluation flow: ${error.message}`);
  return flow;
}
