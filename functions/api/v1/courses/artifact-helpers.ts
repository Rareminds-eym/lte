import { normalizeStageName } from "@functions/lib/stage-sequence";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ArtifactRow,
  ArtifactSubmissionRow,
  Lte6eStage,
  ModuleArtifact,
  ModuleArtifactQuestion,
  ModuleArtifactSubmittedFile,
} from "./types";

const getDownloadUrl = (fileId: string) => `/api/v1/artifacts/files/${fileId}/download`;

export const pickArtifactType = (
  current: "practice" | "final" | null | undefined,
  next: "practice" | "final",
) => (current === "final" || next === "final" ? "final" : "practice");

export async function getArtifactTypeByStage(
  supabase: SupabaseClient,
  moduleId: string,
  allStages: readonly Lte6eStage[],
): Promise<Map<Lte6eStage, "practice" | "final">> {
  const artifactTypeByStage = new Map<Lte6eStage, "practice" | "final">();
  const { data, error } = await supabase
    .from("module_artifacts")
    .select(`
      artifact_type,
      modules_content!inner (
        stage_name
      )
    `)
    .eq("is_active", true)
    .eq("modules_content.module_id", moduleId);

  if (error) {
    throw new Error(`Failed to fetch artifact stage metadata: ${error.message}`);
  }

  for (const row of (data as Array<{
    artifact_type: "practice" | "final";
    modules_content?: { stage_name?: string | null } | Array<{ stage_name?: string | null }>;
  }> | null) ?? []) {
    const moduleContent = Array.isArray(row.modules_content)
      ? row.modules_content[0]
      : row.modules_content;
    if (!moduleContent?.stage_name) continue;

    const stageName = normalizeStageName(moduleContent.stage_name);
    if (allStages.includes(stageName)) {
      artifactTypeByStage.set(
        stageName,
        pickArtifactType(artifactTypeByStage.get(stageName), row.artifact_type),
      );
    }
  }

  return artifactTypeByStage;
}

export async function getSubmittedFilesByArtifactId(
  supabase: SupabaseClient,
  userId: string | undefined,
  artifactIds: string[],
): Promise<Map<string, ModuleArtifactSubmittedFile[]>> {
  const submittedFilesByArtifactId = new Map<string, ModuleArtifactSubmittedFile[]>();

  if (!userId || artifactIds.length === 0) {
    return submittedFilesByArtifactId;
  }

  const { data, error } = await supabase
    .from("artifact_submissions")
    .select(`
      id,
      artifact_id,
      attempt_no,
      version_label,
      is_latest,
      submitted_at,
      artifact_submission_files (
        id,
        question_id,
        file_name,
        file_type,
        file_size_bytes
      )
    `)
    .eq("user_id", userId)
    .eq("status", "submitted")
    .in("artifact_id", artifactIds)
    .order("attempt_no", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch artifact submissions: ${error.message}`);
  }

  for (const submission of (data as ArtifactSubmissionRow[] | null) ?? []) {
    const files = (submission.artifact_submission_files || []).map((file) => ({
      id: file.id,
      submissionId: submission.id,
      questionId: file.question_id,
      fileName: file.file_name,
      fileType: file.file_type,
      fileSizeBytes: file.file_size_bytes,
      downloadUrl: getDownloadUrl(file.id),
      attemptNo: submission.attempt_no,
      versionLabel: submission.version_label ?? `v${submission.attempt_no}`,
      isLatest: submission.is_latest,
      submittedAt: submission.submitted_at,
      uploadedAt: submission.submitted_at,
    }));

    submittedFilesByArtifactId.set(submission.artifact_id, [
      ...(submittedFilesByArtifactId.get(submission.artifact_id) ?? []),
      ...files,
    ]);
  }

  return submittedFilesByArtifactId;
}

export function mapArtifactRow(
  artifact: ArtifactRow,
  submittedFilesByArtifactId: Map<string, ModuleArtifactSubmittedFile[]>,
): ModuleArtifact {
  const questions: ModuleArtifactQuestion[] = (artifact.artifact_questions || [])
    .sort((a, b) => a.question_order - b.question_order)
    .map((question) => ({
      id: question.id,
      questionOrder: question.question_order,
      title: question.title,
      description: question.description,
      instructions: question.instructions,
      responseType: question.response_type ?? "text",
      allowedFileTypes: question.allowed_file_types ?? null,
      maxFileSizeMb: question.max_file_size_mb ?? null,
      responseRequired: question.response_required ?? true,
    }));

  const templates = (artifact.artifact_templates || []).map((template) => ({
    id: template.id,
    questionId: template.question_id,
    fileName: template.file_name,
    fileUrl: template.file_url,
    fileType: template.file_type,
    version: template.version,
    isDownloadable: template.is_downloadable,
  }));

  return {
    id: artifact.id,
    artifactType: artifact.artifact_type,
    totalScore: artifact.total_score,
    passingScore: artifact.passing_score,
    questions,
    templates,
    submittedFiles: submittedFilesByArtifactId.get(artifact.id) ?? [],
    isActive: artifact.is_active,
  };
}
