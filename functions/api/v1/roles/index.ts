import { jsonError, jsonResponse } from "@functions/lib/http";
import { createServiceQueryGateway } from "@functions/lib/query-gateway";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { AuthError, requireAuth } from "@functions/middleware";
import { apiLogger } from "@functions/shared/logger";

const rolesReadPolicy = {
  table: "roles",
  operation: "read",
  columns: ["id", "role_name", "role_family_name", "domain_name", "deleted_at"],
  filters: ["deleted_at"],
  maxPageSize: 500,
} as const;

export async function onRequestGet(context: PagesContext<LteEnv>): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    await requireAuth(context.request, context.env);

    const qb = createServiceQueryGateway(context.env);
    const rows = (await qb.read(rolesReadPolicy, {
      filters: [{ column: "deleted_at", op: "is", value: null }],
    })) as Array<{
      id: string;
      role_name: string;
      role_family_name: string;
      domain_name: string;
      deleted_at: string | null;
    }> | null;

    const roles = (rows ?? [])
      .filter((r) => r.deleted_at === null)
      .map((r) => ({
        id: r.id,
        role_name: r.role_name,
        role_family_name: r.role_family_name,
        domain_name: r.domain_name,
      }));

    return jsonResponse({ success: true, roles, count: roles.length });
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.message, error.code === "UNAUTHORIZED" ? 401 : 403, {
        code: error.code,
        requestId,
      });
    }
    apiLogger.error("Failed to fetch roles", error, { requestId });
    return jsonError("Internal server error", 500, { code: "SERVER_ERROR", requestId });
  }
}
