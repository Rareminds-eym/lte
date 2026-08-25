/**
 * Get Capabilities API Endpoint
 * POST /api/v1/capabilities
 *
 * Fetches capabilities required for a specific role by role ID
 * Query by ID: Direct lookup, no name-based filtering needed
 *
 * No authentication required (public endpoint)
 */

import { jsonError, jsonResponse, readJsonObject } from "@functions/lib/http";
import { createServiceQueryGateway } from "@functions/lib/query-gateway";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { apiLogger } from "@functions/shared/logger";
import { getCapabilitiesByRoleId } from "./queries";
import { GetCapabilitiesRequestSchema } from "./schemas";
import type { GetCapabilitiesRequest, GetCapabilitiesResponse } from "./types";

export async function onRequestPost(context: PagesContext<LteEnv>): Promise<Response> {
  const requestId = crypto.randomUUID();
  let roleId: string | undefined;
  try {
    const parsedBody = GetCapabilitiesRequestSchema.safeParse(
      await readJsonObject(context.request),
    );
    if (!parsedBody.success) {
      return jsonError(parsedBody.error.issues[0]?.message ?? "Invalid request body", 400, {
        code: "INVALID_REQUEST_BODY",
        requestId,
      });
    }

    const body: GetCapabilitiesRequest = parsedBody.data;
    roleId = body.roleId;

    const qb = createServiceQueryGateway(context.env);
    const capabilities = await getCapabilitiesByRoleId(qb, roleId);

    return jsonResponse<GetCapabilitiesResponse>({
      success: true,
      capabilities,
      count: capabilities.length,
    });
  } catch (error) {
    apiLogger.error("Failed to fetch capabilities by role ID", error, { requestId, roleId });
    return jsonError("Internal server error", 500, { code: "SERVER_ERROR", requestId });
  }
}
