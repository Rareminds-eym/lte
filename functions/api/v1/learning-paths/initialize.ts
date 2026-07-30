import { AuthError, requireAuth } from "@functions/lib/auth";
import { jsonError, jsonResponse, readJsonObject } from "@functions/lib/http";
import { apiLogger } from "@functions/lib/logger";
import { createServiceSupabase } from "@functions/lib/supabase";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import {
  checkRoleExists,
  deactivateOtherPaths,
  upsertLearningPath,
  upsertLearningTrack,
} from "./queries";
import { InitializeLearningPathSchema } from "./schemas";

export async function onRequestPost(context: PagesContext<LteEnv>): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireAuth(context.request, context.env);
    const userId = user.sub;

    let rawBody: Record<string, unknown>;
    try {
      rawBody = await readJsonObject(context.request);
    } catch (err) {
      apiLogger.error("Failed to parse JSON request body", err, { requestId });
      return jsonError("Request body must be a valid JSON object", 400, {
        code: "BAD_REQUEST",
        requestId,
      });
    }

    const parsedBody = InitializeLearningPathSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return jsonError(parsedBody.error.issues[0]?.message ?? "Invalid request body", 400, {
        code: "VALIDATION_ERROR",
        requestId,
      });
    }

    const { fit, track, matchScore, whyItFits, attemptId, roleId, duration } = parsedBody.data;

    const supabase = createServiceSupabase(context.env);

    const roleExists = await checkRoleExists(supabase, roleId);
    if (!roleExists) {
      return jsonError(`Target role context '${roleId}' does not exist in local database.`, 400, {
        code: "ROLE_NOT_FOUND",
        requestId,
      });
    }

    const trackId = await upsertLearningTrack(supabase, {
      userId,
      attemptId,
      fit,
      track,
      matchScore,
      whyItFits,
      duration,
    });

    await deactivateOtherPaths(supabase, userId);

    const pathId = await upsertLearningPath(supabase, {
      userId,
      trackId,
      roleId,
    });

    return jsonResponse(
      {
        success: true,
        learningTrackId: trackId,
        learningPathId: pathId,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.message, error.code === "UNAUTHORIZED" ? 401 : 403, {
        code: error.code,
        requestId,
      });
    }

    apiLogger.error("Unhandled error", error, { requestId });
    const message = error instanceof Error ? error.message : "Internal server error";
    return jsonError(message, 500, { code: "SERVER_ERROR", requestId });
  }
}
