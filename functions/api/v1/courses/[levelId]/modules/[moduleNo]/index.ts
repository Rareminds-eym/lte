/**
 * Get Module Details Endpoint (6E stages, e_content, artifacts)
 * GET /api/v1/courses/:levelId/modules/:moduleNo
 */

import { getModuleDetails } from "@functions/api/v1/courses/queries";
import { LevelModuleParamsSchema } from "@functions/api/v1/courses/schemas";
import { jsonError, jsonResponse } from "@functions/lib/http";
import { createServiceQueryGateway } from "@functions/lib/query-gateway";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { AuthError, requireAuth } from "@functions/middleware";

export async function onRequestGet(context: PagesContext<LteEnv>): Promise<Response> {
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
    const qb = createServiceQueryGateway(context.env);

    const moduleDetails = await getModuleDetails(qb, levelId, moduleNumber, userId);

    if (!moduleDetails) {
      return jsonError(`Module ${moduleNumber} for level '${levelId}' not found`, 404, {
        code: "NOT_FOUND",
        requestId,
      });
    }

    return jsonResponse({
      success: true,
      module: moduleDetails,
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
