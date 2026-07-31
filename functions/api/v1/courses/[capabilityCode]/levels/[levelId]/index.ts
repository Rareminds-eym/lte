/**
 * Get Level Details & Modules Endpoint (Nested Capability Route)
 * GET /api/v1/courses/:capabilityCode/levels/:levelId
 */

import { jsonError, jsonResponse } from "@functions/lib/http";
import { createServiceSupabase } from "@functions/lib/supabase";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { getLevelWithModules } from "../../../queries";
import { CapabilityLevelParamsSchema } from "../../../schemas";

export async function onRequestGet(context: PagesContext<LteEnv>): Promise<Response> {
  try {
    const parsedParams = CapabilityLevelParamsSchema.safeParse(context.params);
    if (!parsedParams.success) {
      return jsonError(parsedParams.error.issues[0]?.message ?? "Invalid route parameters", 400);
    }

    const { levelId } = parsedParams.data;
    const supabase = createServiceSupabase(context.env);

    const levelDetails = await getLevelWithModules(supabase, levelId);

    if (!levelDetails) {
      return jsonError(`Level with id '${levelId}' not found`, 404);
    }

    return jsonResponse({
      success: true,
      level: levelDetails,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return jsonError(errorMessage, 500);
  }
}
