import { sanitizeContentDispositionFilename } from "@functions/lib/artifact-evaluator";
import type { LteEnv } from "@functions/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ArtifactSubmissionError } from "./file-validation";

export { ArtifactSubmissionError } from "./file-validation";

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

function getObjectKeyFromFileUrl(fileUrl: string): string {
  try {
    const url = new URL(fileUrl);
    return decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  } catch {
    return fileUrl.replace(/^\/+/, "");
  }
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
  headers.set(
    "Content-Disposition",
    `attachment; filename="${sanitizeContentDispositionFilename(file.file_name)}"`,
  );
  if (object.size) headers.set("Content-Length", String(object.size));

  return new Response(object.body, { status: 200, headers });
}

export function createDownloadUrl(fileId: string, requestUrl: string): string {
  return new URL(`/api/v1/artifacts/files/${fileId}/download`, requestUrl).toString();
}
