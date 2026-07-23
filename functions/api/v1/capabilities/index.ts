/**
 * Get Capabilities API Endpoint
 * POST /api/v1/capabilities
 *
 * Fetches capabilities required for a specific role by role ID
 * Query by ID: Direct lookup, no name-based filtering needed
 *
 * No authentication required (public endpoint)
 */

import { createServiceSupabase } from "@functions/lib/supabase";
import { jsonResponse, jsonError, readJsonObject } from "@functions/lib/http";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import type {
  GetCapabilitiesRequest,
  GetCapabilitiesResponse,
} from "./types";
import { getCapabilitiesByRoleId } from "./queries";

export async function onRequestPost(context: PagesContext<LteEnv>): Promise<Response> {
  try {
    const body = (await readJsonObject(context.request)) as unknown as GetCapabilitiesRequest;
    const { roleId } = body;

    if (!roleId) {
      return jsonError('roleId is required', 400);
    }

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
