import { jsonError, jsonResponse } from "@functions/lib/http";
import { createServiceSupabase } from "@functions/lib/supabase";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { uuidSchema } from "@functions/schemas";
import { apiLogger } from "@functions/shared/logger";
import { ArtifactSubmissionError, createDownloadUrl, requireOwnedFile } from "../../queries";

export async function onRequestGet(context: PagesContext<LteEnv>): Promise<Response> {
  const requestId = crypto.randomUUID();

  try {
    const user = context.data?.["user"] as { sub: string } | undefined;
    if (!user) {
      return jsonError("Unauthorized", 401, { code: "UNAUTHORIZED", requestId });
    }
    const parsedFileId = uuidSchema.safeParse(context.params["fileId"]);
    if (!parsedFileId.success) {
      return jsonError("Invalid file id.", 400, { code: "VALIDATION_ERROR", requestId });
    }

    const supabase = createServiceSupabase(context.env);
    await requireOwnedFile(supabase, parsedFileId.data, user.sub);

    return jsonResponse({
      success: true,
      download_url: createDownloadUrl(parsedFileId.data, context.request.url),
    });
  } catch (error) {
    if (error instanceof ArtifactSubmissionError) {
      return jsonError(error.message, error.status, { code: error.code, requestId });
    }

    apiLogger.error("Failed to create artifact download URL", error, { requestId });
    return jsonError("Failed to create artifact download URL.", 500, {
      code: "SERVER_ERROR",
      requestId,
    });
  }
}
