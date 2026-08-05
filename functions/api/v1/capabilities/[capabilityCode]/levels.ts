import { getActiveLearningPath } from "@functions/api/v1/learning-paths/queries";
import { AuthError, requireAuth } from "@functions/lib/auth";
import { jsonError, jsonResponse } from "@functions/lib/http";
import { apiLogger } from "@functions/lib/logger";
import { createServiceSupabase } from "@functions/lib/supabase";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { getCapabilitiesByRoleId, getLevelsForCapability } from "../queries";
import { CapabilityCodeParamsSchema } from "../schemas";
import type { CapabilityLevelsResponse } from "../types";

export async function onRequestGet(context: PagesContext<LteEnv>): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireAuth(context.request, context.env);
    const supabase = createServiceSupabase(context.env);

    const parsedParams = CapabilityCodeParamsSchema.safeParse(context.params);
    if (!parsedParams.success) {
      return jsonError(parsedParams.error.issues[0]?.message ?? "Invalid route parameters", 400, {
        code: "VALIDATION_ERROR",
        requestId,
      });
    }
    const capabilityCode = parsedParams.data.capabilityCode;

    const activePath = await getActiveLearningPath(supabase, user.sub);
    if (!activePath) {
      return jsonError("Capability not found", 404, { code: "NOT_FOUND", requestId });
    }

    const capabilities = await getCapabilitiesByRoleId(supabase, activePath.roleId);
    const capability = capabilities.find(
      (c) => c.code?.toLowerCase() === capabilityCode.toLowerCase(),
    );
    if (!capability) {
      return jsonError("Capability not found", 404, { code: "NOT_FOUND", requestId });
    }

    const levels = await getLevelsForCapability(supabase, capability.id);

    return jsonResponse<CapabilityLevelsResponse>({
      success: true,
      capability: {
        id: capability.id,
        code: capability.code ?? capabilityCode,
        name: capability.name,
      },
      levels,
      count: levels.length,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.message, error.code === "UNAUTHORIZED" ? 401 : 403, {
        code: error.code,
        requestId,
      });
    }

    apiLogger.error("Failed to fetch capability levels", error, { requestId });
    const message = error instanceof Error ? error.message : "Internal server error";
    return jsonError(message, 500, { code: "SERVER_ERROR", requestId });
  }
}
