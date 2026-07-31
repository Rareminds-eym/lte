/**
 * Get Module Details Endpoint (6E stages, e_content, artifacts)
 * GET /api/v1/courses/:levelId/modules/:moduleNo
 */

import { getModuleDetails } from "@functions/api/v1/courses/queries";
import { LevelModuleParamsSchema } from "@functions/api/v1/courses/schemas";
import { jsonError, jsonResponse } from "@functions/lib/http";
import { createServiceSupabase } from "@functions/lib/supabase";
import type { LteEnv, PagesContext } from "@functions/lib/types";

export async function onRequestGet(context: PagesContext<LteEnv>): Promise<Response> {
  try {
    const parsedParams = LevelModuleParamsSchema.safeParse(context.params);
    if (!parsedParams.success) {
      return jsonError(parsedParams.error.issues[0]?.message ?? "Invalid route parameters", 400);
    }

    const { levelId, moduleNo } = parsedParams.data;
    const moduleNumber = parseInt(moduleNo, 10);
    const supabase = createServiceSupabase(context.env);

    const moduleDetails = await getModuleDetails(supabase, levelId, moduleNumber);

    if (!moduleDetails) {
      return jsonError(`Module ${moduleNumber} for level '${levelId}' not found`, 404);
    }

    return jsonResponse({
      success: true,
      module: moduleDetails,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return jsonError(errorMessage, 500);
  }
}
