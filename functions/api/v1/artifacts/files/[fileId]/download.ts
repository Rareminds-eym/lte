import { AuthError, requireAuth } from "@functions/lib/auth";
import { jsonError } from "@functions/lib/http";
import { apiLogger } from "@functions/lib/logger";
import { createServiceSupabase } from "@functions/lib/supabase";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { ArtifactSubmissionError, createArtifactFileDownloadResponse } from "../../queries";
import { uuidSchema } from "../../schemas";

export async function onRequestGet(context: PagesContext<LteEnv>): Promise<Response> {
  const requestId = crypto.randomUUID();

  try {
    const user = await requireAuth(context.request, context.env);
    const parsedFileId = uuidSchema.safeParse(context.params["fileId"]);
    if (!parsedFileId.success) {
      return jsonError("Invalid file id.", 400, { code: "VALIDATION_ERROR", requestId });
    }

    const supabase = createServiceSupabase(context.env);
    return await createArtifactFileDownloadResponse(
      supabase,
      context.env,
      user.sub,
      parsedFileId.data,
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.message, error.code === "UNAUTHORIZED" ? 401 : 403, {
        code: error.code,
        requestId,
      });
    }
    if (error instanceof ArtifactSubmissionError) {
      return jsonError(error.message, error.status, { code: error.code, requestId });
    }

    apiLogger.error("Failed to download artifact file", error, { requestId });
    return jsonError("Failed to download artifact file.", 500, { code: "SERVER_ERROR", requestId });
  }
}
