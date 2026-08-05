/**
 * Get Level Details & Modules Endpoint (Nested Capability Route)
 * GET /api/v1/courses/:capabilityCode/levels/:levelId
 */

import { AuthError, requireAuth } from "@functions/lib/auth";
import { jsonError, jsonResponse } from "@functions/lib/http";
import { createServiceSupabase } from "@functions/lib/supabase";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { getLevelWithModules } from "../../../queries";
import { CapabilityLevelParamsSchema } from "../../../schemas";

export async function onRequestGet(context: PagesContext<LteEnv>): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireAuth(context.request, context.env);
    const userId = user.sub;

    const parsedParams = CapabilityLevelParamsSchema.safeParse(context.params);
    if (!parsedParams.success) {
      return jsonError(parsedParams.error.issues[0]?.message ?? "Invalid route parameters", 400, {
        code: "VALIDATION_ERROR",
        requestId,
      });
    }

    const { levelId } = parsedParams.data;
    const supabase = createServiceSupabase(context.env);

    const levelDetails = await getLevelWithModules(supabase, levelId, userId);

    if (!levelDetails) {
      return jsonError(`Level with id '${levelId}' not found`, 404, {
        code: "NOT_FOUND",
        requestId,
      });
    }

    return jsonResponse({
      success: true,
      level: levelDetails,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.message, error.code === "UNAUTHORIZED" ? 401 : 403, {
        code: error.code,
        requestId,
      });
    }
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return jsonError(errorMessage, 500, { code: "SERVER_ERROR", requestId });
  }
}
