import { sanitizeContentDispositionFilename } from "@functions/lib/artifact-evaluator";
import type { QueryGateway } from "@functions/lib/query-gateway";
import { QueryGatewayDatabaseError } from "@functions/lib/query-gateway/errors";
import type { LteEnv } from "@functions/lib/types";
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

const ownedArtifactFileReadPolicy = {
  table: "artifact_submission_files",
  operation: "read",
  select: `
    id,
    submission_id,
    question_id,
    file_name,
    file_url,
    object_key,
    file_type,
    file_size_bytes,
    artifact_submissions!inner(user_id)
  `,
  filters: ["id", "artifact_submissions.user_id"],
  ownership: {
    column: "artifact_submissions.user_id",
    source: "authenticatedUserId",
    required: true,
  },
} as const;

function getObjectKeyFromFileUrl(fileUrl: string): string {
  try {
    const url = new URL(fileUrl);
    return decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  } catch {
    return fileUrl.replace(/^\/+/, "");
  }
}

function isNotFoundDatabaseError(error: QueryGatewayDatabaseError): boolean {
  const cause = error.cause as { code?: unknown; message?: unknown } | undefined;
  return (
    cause?.code === "PGRST116" || String(cause?.message ?? error.message).includes("not found")
  );
}

export async function requireOwnedFile(
  qb: QueryGateway,
  fileId: string,
  userId: string,
): Promise<ArtifactFileRow> {
  try {
    const file = (await qb.read(ownedArtifactFileReadPolicy, {
      auth: { userId },
      filters: [{ column: "id", op: "eq", value: fileId }],
      result: "single",
    })) as ArtifactFileRow;
    if (!file) {
      throw new ArtifactSubmissionError("Artifact file was not found.", 404, "FILE_NOT_FOUND");
    }
    return file;
  } catch (error) {
    if (error instanceof QueryGatewayDatabaseError) {
      if (isNotFoundDatabaseError(error)) {
        throw new ArtifactSubmissionError("Artifact file was not found.", 404, "FILE_NOT_FOUND");
      }
      throw error;
    }
    if (error instanceof Error) throw error;
    throw new ArtifactSubmissionError("Artifact file was not found.", 404, "FILE_NOT_FOUND");
  }
}

export async function createArtifactFileDownloadResponse(
  qb: QueryGateway,
  env: Pick<LteEnv, "STORAGE_BUCKET">,
  userId: string,
  fileId: string,
): Promise<Response> {
  const file = await requireOwnedFile(qb, fileId, userId);
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
