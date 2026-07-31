import { AuthError, requireAuth } from "@functions/lib/auth";
import { jsonError, jsonResponse, readJsonObject } from "@functions/lib/http";
import { apiLogger } from "@functions/lib/logger";
import { createServiceSupabase } from "@functions/lib/supabase";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { z } from "zod";
import { upsertStageProgress } from "../../../../queries";
import { LevelModuleParamsSchema } from "../../../../schemas";

const StageProgressBodySchema = z.object({
  eContentId: z.string().uuid("Invalid eContentId format"),
  stageName: z.enum(["engage", "explore", "explain", "express", "empower", "evolve"]),
  status: z.enum(["in_progress", "completed"]),
});

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

    let rawBody: Record<string, unknown>;
    try {
      rawBody = await readJsonObject(context.request);
    } catch (err) {
      return jsonError("Request body must be a valid JSON object", 400, {
        code: "BAD_REQUEST",
        requestId,
      });
    }

    const parsedBody = StageProgressBodySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return jsonError(parsedBody.error.issues[0]?.message ?? "Invalid request body", 400, {
        code: "VALIDATION_ERROR",
        requestId,
      });
    }

    const { eContentId, stageName, status } = parsedBody.data;

    const supabase = createServiceSupabase(context.env);
    const progressData = await upsertStageProgress(
      supabase,
      userId,
      levelId,
      moduleNumber,
      eContentId,
      stageName,
      status,
    );

    return jsonResponse({
      success: true,
      ...progressData,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.message, error.code === "UNAUTHORIZED" ? 401 : 403, {
        code: error.code,
        requestId,
      });
    }

    apiLogger.error("Failed to update stage progress", error, { requestId });
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return jsonError(errorMessage, 500, { code: "SERVER_ERROR", requestId });
  }
}
