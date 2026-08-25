import {
  ArtifactSubmissionError,
  createArtifactFileDownloadResponse,
} from "@functions/api/v1/artifacts/file-queries";
import { jsonError } from "@functions/lib/http";
import { createServiceQueryGateway } from "@functions/lib/query-gateway";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { getAuthUser } from "@functions/middleware";
import { uuidSchema } from "@functions/schemas";
import { apiLogger } from "@functions/shared/logger";

export async function onRequestGet(context: PagesContext<LteEnv>): Promise<Response> {
  const requestId = crypto.randomUUID();

  try {
    const user = getAuthUser(context);
    if (!user) {
      return jsonError("Unauthorized", 401, { code: "UNAUTHORIZED", requestId });
    }
    const parsedFileId = uuidSchema.safeParse(context.params["fileId"]);
    if (!parsedFileId.success) {
      return jsonError("Invalid file id.", 400, { code: "VALIDATION_ERROR", requestId });
    }

    const qb = createServiceQueryGateway(context.env);
    return await createArtifactFileDownloadResponse(qb, context.env, user.sub, parsedFileId.data);
  } catch (error) {
    if (error instanceof ArtifactSubmissionError) {
      return jsonError(error.message, error.status, { code: error.code, requestId });
    }

    apiLogger.error("Failed to download artifact file", error, { requestId });
    return jsonError("Failed to download artifact file.", 500, { code: "SERVER_ERROR", requestId });
  }
}
