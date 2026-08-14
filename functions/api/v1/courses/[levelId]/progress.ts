import { jsonError, jsonResponse, readJsonObject } from "@functions/lib/http";
import { createServiceQueryGateway } from "@functions/lib/query-gateway";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { AuthError, requireAuth } from "@functions/middleware";
import { apiLogger } from "@functions/shared/logger";
import { upsertLevelProgress } from "../queries";
import { LevelIdParamsSchema } from "../schemas";

export async function onRequestPost(context: PagesContext<LteEnv>): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireAuth(context.request, context.env);
    const userId = user.sub;

    const parsedParams = LevelIdParamsSchema.safeParse(context.params);
    if (!parsedParams.success) {
      return jsonError(parsedParams.error.issues[0]?.message ?? "Invalid route parameters", 400, {
        code: "VALIDATION_ERROR",
        requestId,
      });
    }

    const { levelId } = parsedParams.data;

    let status = "in_progress";
    try {
      const body = (await readJsonObject(context.request)) as { status?: string };
      if (body && typeof body.status === "string") {
        status = body.status;
      }
    } catch {
      // Body is optional, default to in_progress
    }

    const qb = createServiceQueryGateway(context.env);
    const progressId = await upsertLevelProgress(qb, userId, levelId, status);

    return jsonResponse({
      success: true,
      levelProgressId: progressId,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.message, error.code === "UNAUTHORIZED" ? 401 : 403, {
        code: error.code,
        requestId,
      });
    }

    apiLogger.error("Failed to update level progress", error, { requestId });
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return jsonError(errorMessage, 500, { code: "SERVER_ERROR", requestId });
  }
}
