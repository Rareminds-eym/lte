import { getActiveLearningTrack } from "@functions/api/v1/learning-paths/queries";
import { AuthError, requireAuth } from "@functions/lib/auth";
import { jsonError, jsonResponse } from "@functions/lib/http";
import { apiLogger } from "@functions/lib/logger";
import { createServiceSupabase } from "@functions/lib/supabase";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { getCapabilitiesByRoleId, getLevelsForCapability } from "../queries";
import type { CapabilityLevelsResponse } from "../types";

export async function onRequestGet(context: PagesContext<LteEnv>): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireAuth(context.request, context.env);
    const supabase = createServiceSupabase(context.env);
    const capabilityCode = context.params["capabilityCode"] ?? "";

    const activeTrack = await getActiveLearningTrack(supabase, user.sub);
    if (!activeTrack || !capabilityCode) {
      return jsonError("Capability not found", 404, { code: "NOT_FOUND", requestId });
    }

    let capability = null;
    for (const role of activeTrack.roles) {
      const capabilities = await getCapabilitiesByRoleId(supabase, role.roleId);
      const found = capabilities.find(
        (c) => c.code?.toLowerCase() === capabilityCode.toLowerCase(),
      );
      if (found) {
        capability = found;
        break;
      }
    }

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
