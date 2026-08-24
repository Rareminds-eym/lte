/**
 * Get Level Details & Modules Endpoint
 * GET /api/v1/courses/:levelId
 */

import { jsonError, jsonResponse } from "@functions/lib/http";
import { createServiceQueryGateway } from "@functions/lib/query-gateway";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { AuthError, requireAuth } from "@functions/middleware";
import { getLevelWithModules } from "../queries";
import { LevelIdParamsSchema } from "../schemas";

export async function onRequestGet(context: PagesContext<LteEnv>): Promise<Response> {
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
    const qb = createServiceQueryGateway(context.env);

    const levelDetails = await getLevelWithModules(qb, levelId, userId);

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
