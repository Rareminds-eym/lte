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
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LteEnv, PagesContext } from "@functions/lib/types";

// Domain Models
export interface Capability {
  id: string;
  name: string;
  description: string;
  code?: string;
  level?: string;
  priority?: string;
  step?: number;
}

// Request/Response Models
export interface GetCapabilitiesRequest {
  roleId: string;
}

export interface GetCapabilitiesResponse {
  success: boolean;
  capabilities: Capability[];
  error?: string;
  count?: number;
}

// Private Functions

async function getCapabilitiesByRoleId(
  supabase: SupabaseClient,
  roleId: string
): Promise<Capability[]> {
  // Fetch capabilities for role (ordered by sequence step)
  // Join with capabilities table to get capability details
  const { data, error } = await supabase
    .from('role_capability_sequence')
    .select(`
      id,
      sequence_step,
      required_level,
      capability_priority,
      capabilities (
        id,
        code,
        name,
        description
      )
    `)
    .eq('role_id', roleId)
    .order('sequence_step', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch role capabilities: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  return data.map((item: any) => {
    const cap = Array.isArray(item.capabilities)
      ? item.capabilities[0]
      : item.capabilities;

    return {
      id: cap?.id ?? '',
      name: cap?.name ?? '',
      description: cap?.description ?? '',
      code: cap?.code ?? undefined,
      level: item.required_level ?? undefined,
      priority: item.capability_priority ?? undefined,
      step: item.sequence_step ?? undefined,
    };
  });
}

// Handler

export async function onRequestPost(context: PagesContext<LteEnv>): Promise<Response> {
  try {
    const body = (await readJsonObject(context.request)) as GetCapabilitiesRequest;
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
