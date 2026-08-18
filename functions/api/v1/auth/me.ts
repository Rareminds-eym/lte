import { jsonError, jsonResponse } from "@functions/lib/http";
import { createServiceQueryGateway } from "@functions/lib/query-gateway";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { AuthError, requireAuth, toAuthApiUser } from "@functions/middleware";
import { authLogger } from "@functions/shared/logger";

const authUserReadPolicy = {
  table: "users",
  operation: "read",
  columns: ["id", "status"],
  filters: ["id"],
  ownership: { column: "id", source: "authenticatedUserId", required: true },
} as const;

const reactivateUserPolicy = {
  table: "users",
  operation: "update",
  updateColumns: ["status", "updated_at"],
  filters: ["id"],
  ownership: { column: "id", source: "authenticatedUserId", required: true },
  requireFilter: true,
} as const;

export async function onRequestGet(context: PagesContext<LteEnv>): Promise<Response> {
  try {
    const user = await requireAuth(context.request, context.env);

    // Verify user exists in LTE local database (public.users)
    if (context.env.SUPABASE_URL && context.env.SUPABASE_SERVICE_ROLE_KEY) {
      const qb = createServiceQueryGateway(context.env);
      const existingUser = (await qb.read(authUserReadPolicy, {
        auth: { userId: user.sub },
        filters: [],
        result: "maybeSingle",
      })) as { id: string; status: string } | null;

      if (!existingUser) {
        authLogger.warn("User data not found in LTE database during /me check", {
          userId: user.sub,
        });
        throw new AuthError(
          "LTE user record not found. Please sign in via SkillPassport.",
          "UNAUTHORIZED",
        );
      }

      // Block permanently disabled accounts
      if (existingUser.status === "suspended" || existingUser.status === "deleted") {
        throw new AuthError("Account access has been disabled.", "FORBIDDEN");
      }

      // Auto-reactivate deactivated accounts on sign-in
      if (existingUser.status === "inactive") {
        await qb.update(reactivateUserPolicy, {
          auth: { userId: user.sub },
          data: { status: "active", updated_at: new Date().toISOString() },
          filters: [],
        });
        authLogger.info("Reactivated inactive user upon sign-in", { userId: user.sub });
      }
    }

    return jsonResponse({ user: toAuthApiUser(user) });
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.message, error.code === "UNAUTHORIZED" ? 401 : 403);
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    return jsonError(message, 500);
  }
}
