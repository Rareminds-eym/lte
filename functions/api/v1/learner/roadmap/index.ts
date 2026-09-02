import { getActiveLearningTrack } from "@functions/api/v1/learning-paths/queries";
import { jsonError, jsonResponse } from "@functions/lib/http";
import { asQueryGateway, createServiceQueryGateway } from "@functions/lib/query-gateway";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { AuthError, requireAuth } from "@functions/middleware";
import { apiLogger } from "@functions/shared/logger";

const roadmapSequenceReadPolicy = {
  table: "role_capability_sequence",
  operation: "read",
  select: `
    id,
    role_id,
    capability_id,
    sequence_step,
    required_level,
    capability_priority,
    capabilities (
      code
    )
  `,
  filters: ["role_id"],
  sorts: ["sequence_step"],
  maxPageSize: 500,
} as const;

export async function onRequestGet(context: PagesContext<LteEnv>): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireAuth(context.request, context.env);
    const userId = user.sub;

    const qb = createServiceQueryGateway(context.env);
    const activeTrack = await getActiveLearningTrack(asQueryGateway(qb), userId);

    if (!activeTrack?.roles || activeTrack.roles.length === 0) {
      return jsonResponse({ needsAssessment: true, roleId: null, track: null, capabilities: [] });
    }

    const roleId = activeTrack.roles[0]?.roleId;
    if (!roleId) {
      return jsonResponse({ needsAssessment: true, roleId: null, track: null, capabilities: [] });
    }

    let rows: unknown;
    try {
      rows = await asQueryGateway(qb).read(roadmapSequenceReadPolicy, {
        filters: [{ column: "role_id", op: "eq", value: roleId }],
        sort: [{ column: "sequence_step", ascending: true }],
      });
    } catch (error) {
      apiLogger.error("Failed to fetch roadmap sequence", error, { requestId, roleId });
      throw error;
    }

    const capabilities = ((rows as unknown[]) ?? []).map((r: unknown) => {
      const row = r as Record<string, unknown>;
      const cap = Array.isArray(row["capabilities"])
        ? (row["capabilities"] as Record<string, unknown>[])[0]
        : (row["capabilities"] as Record<string, unknown> | null);
      return {
        capabilityId: row["capability_id"],
        sequenceNo: row["sequence_step"],
        roleId: row["role_id"],
        capabilityCode: cap?.["code"] ?? null,
        requiredLevel: row["required_level"],
        priority: row["capability_priority"],
        id: row["id"],
      };
    });

    return jsonResponse({
      roleId,
      track: activeTrack.track,
      learningTrackId: activeTrack.learningTrackId,
      capabilities,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.message, error.code === "UNAUTHORIZED" ? 401 : 403, {
        code: error.code,
        requestId,
      });
    }
    apiLogger.error("Failed to resolve learner roadmap", error, { requestId });
    return jsonError("Internal server error", 500, { code: "SERVER_ERROR", requestId });
  }
}
