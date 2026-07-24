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
import { createServiceSupabase } from "@functions/lib/supabase";
import { getCapabilitiesByRoleId } from "./queries";
import { GetCapabilitiesRequestSchema } from "./schemas";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import type {
  GetCapabilitiesRequest,
  GetCapabilitiesResponse,
} from "./types";

export async function onRequestPost(context: PagesContext<LteEnv>): Promise<Response> {
  try {
    const parsedBody = GetCapabilitiesRequestSchema.safeParse(await readJsonObject(context.request));
    if (!parsedBody.success) {
      return jsonError(parsedBody.error.issues[0]?.message ?? "Invalid request body", 400);
    }

    const body: GetCapabilitiesRequest = parsedBody.data;
    const { roleId } = body;

    const supabase = createServiceSupabase(context.env);
    const capabilities = await getCapabilitiesByRoleId(supabase, roleId);

    return jsonResponse<GetCapabilitiesResponse>({
      success: true,
      capabilities,
      count: capabilities.length,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return jsonError(errorMessage, 500);
  }
}
