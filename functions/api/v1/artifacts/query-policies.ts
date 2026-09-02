export interface ArtifactQuestionRow {
  id: string;
  artifact_id: string;
  response_type: "text" | "file" | "url";
  allowed_file_types: string[] | null;
  max_file_size_mb: number | null;
  response_required: boolean;
}

export interface ArtifactSubmissionRow {
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
  sealed_at: string | null;
}

export interface ArtifactMetaRow {
  artifact_type: string | null;
  passing_score: number | null;
  total_score: number | null;
}

export interface ArtifactQuestionDetailRow {
  id: string;
  title: string;
  description: string | null;
  response_type: string;
  instructions: Record<string, unknown> | string | null;
}

export interface EvaluationFlowRow {
  id: string;
  submission_id: string;
  stage: string;
  status: string;
  score: number | null;
  decision: string | null;
  feedback: string | null;
  improvements: string | null;
  completed_at: string | null;
  metadata: unknown;
}

export interface ArtifactSubmissionAnswerRow {
  question_id: string;
  text_response?: string | null;
  url_response?: string | null;
}

export interface ArtifactSubmissionFileRow {
  id?: string;
  question_id: string;
  file_name: string;
  object_key?: string | null;
  file_type: string;
}

export const SUBMISSION_ROW_SELECT =
  "id, artifact_id, user_id, user_module_progress_id, attempt_no, version_label, is_latest, status, previous_submission_id, submitted_at, sealed_at";

export const moduleArtifactAccessPolicy = {
  table: "module_artifacts",
  operation: "read",
  columns: ["id", "modules_content_id"],
  filters: ["id", "is_active"],
} as const;

export const moduleContentAccessPolicy = {
  table: "modules_content",
  operation: "read",
  columns: ["id", "module_id"],
  filters: ["id", "is_active"],
} as const;

export const userModuleProgressAccessPolicy = {
  table: "user_module_progress",
  operation: "read",
  columns: ["id"],
  filters: ["user_id", "module_id"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
} as const;

export const artifactSubmissionReadPolicy = {
  table: "artifact_submissions",
  operation: "read",
  select: SUBMISSION_ROW_SELECT,
  filters: ["user_id", "artifact_id", "is_latest", "idempotency_key", "id"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
} as const;

export const artifactSubmissionDemotePolicy = {
  table: "artifact_submissions",
  operation: "update",
  updateColumns: ["is_latest", "updated_at"],
  filters: ["id", "user_id"],
  requireFilter: true,
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
} as const;

export const artifactSubmissionInsertPolicy = {
  table: "artifact_submissions",
  operation: "insert",
  insertColumns: [
    "artifact_id",
    "user_id",
    "user_module_progress_id",
    "attempt_no",
    "version_label",
    "previous_submission_id",
    "status",
    "submitted_at",
    "updated_at",
    "idempotency_key",
  ],
  returningColumns: [
    "id",
    "artifact_id",
    "user_id",
    "user_module_progress_id",
    "attempt_no",
    "version_label",
    "is_latest",
    "status",
    "previous_submission_id",
    "submitted_at",
    "sealed_at",
  ],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
} as const;

export const artifactQuestionsReadPolicy = {
  table: "artifact_questions",
  operation: "read",
  columns: [
    "id",
    "artifact_id",
    "response_type",
    "allowed_file_types",
    "max_file_size_mb",
    "response_required",
  ],
  filters: ["artifact_id", "is_active"],
  sorts: ["question_order"],
  maxPageSize: 100,
} as const;

export const artifactMetaReadPolicy = {
  table: "module_artifacts",
  operation: "read",
  columns: ["artifact_type", "passing_score", "total_score"],
  filters: ["id"],
} as const;

export const artifactQuestionDetailsReadPolicy = {
  table: "artifact_questions",
  operation: "read",
  columns: ["id", "title", "description", "response_type", "instructions"],
  filters: ["artifact_id", "is_active"],
  maxPageSize: 100,
} as const;

export const artifactSubmissionFileInsertPolicy = {
  table: "artifact_submission_files",
  operation: "insert",
  insertColumns: [
    "id",
    "submission_id",
    "question_id",
    "file_name",
    "file_url",
    "object_key",
    "file_type",
    "file_size_bytes",
  ],
} as const;

export const artifactSubmissionDeletePolicy = {
  table: "artifact_submissions",
  operation: "delete",
  filters: ["id"],
  mode: "hard",
  requireFilter: true,
} as const;

export const submissionFilesReadPolicy = {
  table: "artifact_submission_files",
  operation: "read",
  columns: ["id", "question_id", "file_name", "object_key", "file_type"],
  filters: ["submission_id"],
  maxPageSize: 100,
} as const;

export const artifactEvaluationFlowReadPolicy = {
  table: "artifact_evaluation_flows",
  operation: "read",
  columns: [
    "id",
    "submission_id",
    "stage",
    "status",
    "score",
    "decision",
    "feedback",
    "improvements",
    "completed_at",
    "metadata",
  ],
  filters: ["submission_id", "is_current_stage"],
} as const;

export const artifactSubmissionAnswersReadPolicy = {
  table: "artifact_submission_answers",
  operation: "read",
  columns: ["question_id", "text_response", "url_response"],
  filters: ["submission_id"],
  maxPageSize: 100,
} as const;

export const artifactSubmissionAnswersUpsertPolicy = {
  table: "artifact_submission_answers",
  operation: "upsert",
  upsertColumns: ["submission_id", "question_id", "text_response", "url_response", "updated_at"],
  onConflict: "submission_id,question_id",
} as const;
