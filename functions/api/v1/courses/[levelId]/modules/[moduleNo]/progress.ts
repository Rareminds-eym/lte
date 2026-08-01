import { AuthError, requireAuth } from "@functions/lib/auth";
import { jsonError, jsonResponse, readJsonObject } from "@functions/lib/http";
import { apiLogger } from "@functions/lib/logger";
import { createServiceSupabase } from "@functions/lib/supabase";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { upsertModuleProgress } from "../../../queries";
import { LevelModuleParamsSchema } from "../../../schemas";

export async function onRequestPost(context: PagesContext<LteEnv>): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireAuth(context.request, context.env);
    const userId = user.sub;

    const parsedParams = LevelModuleParamsSchema.safeParse(context.params);
    if (!parsedParams.success) {
      return jsonError(parsedParams.error.issues[0]?.message ?? "Invalid route parameters", 400, {
        code: "VALIDATION_ERROR",
        requestId,
      });
    }

    const { levelId, moduleNo } = parsedParams.data;
    const moduleNumber = parseInt(moduleNo, 10);

    let status = "in_progress";
    try {
      const body = (await readJsonObject(context.request)) as { status?: string };
      if (body && typeof body.status === "string") {
        status = body.status;
      }
    } catch {
      // Body is optional, default to in_progress
    }

    const supabase = createServiceSupabase(context.env);
    const progressId = await upsertModuleProgress(supabase, userId, levelId, moduleNumber, status);

    return jsonResponse({
      success: true,
      moduleProgressId: progressId,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.message, error.code === "UNAUTHORIZED" ? 401 : 403, {
        code: error.code,
        requestId,
      });
    }

    apiLogger.error("Failed to update module progress", error, { requestId });
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return jsonError(errorMessage, 500, { code: "SERVER_ERROR", requestId });
  }
}
