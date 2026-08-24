import { getActiveLearningTrack } from "@functions/api/v1/learning-paths/queries";
import { jsonError, jsonResponse } from "@functions/lib/http";
import { createServiceQueryGateway } from "@functions/lib/query-gateway";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { AuthError, requireAuth } from "@functions/middleware";
import { apiLogger } from "@functions/shared/logger";
import { getUserCapabilitiesForRoles } from "./queries";
import type { UserCapabilitiesResponse } from "./types";

export async function onRequestGet(context: PagesContext<LteEnv>): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireAuth(context.request, context.env);
    const userId = user.sub;

    const qb = createServiceQueryGateway(context.env);

    const activeTrack = await getActiveLearningTrack(qb, userId);
    if (!activeTrack || activeTrack.roles.length === 0) {
      return jsonResponse<UserCapabilitiesResponse>({
        success: true,
        capabilities: [],
        count: 0,
      });
    }

    const roleIds = activeTrack.roles.map((r) => r.roleId);
    const capabilities = await getUserCapabilitiesForRoles(qb, userId, roleIds, activeTrack.roles);

    return jsonResponse<UserCapabilitiesResponse>({
      success: true,
      capabilities,
      count: capabilities.length,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.message, error.code === "UNAUTHORIZED" ? 401 : 403, {
        code: error.code,
        requestId,
      });
    }

    apiLogger.error("Failed to fetch user capabilities", error, { requestId });
    return jsonError("Internal server error", 500, { code: "SERVER_ERROR", requestId });
  }
}
