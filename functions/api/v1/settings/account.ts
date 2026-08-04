import { AuthError, requireAuth } from "@functions/lib/auth";
import { jsonError, jsonResponse, readJsonObject } from "@functions/lib/http";
import { apiLogger } from "@functions/lib/logger";
import { createServiceSupabase } from "@functions/lib/supabase";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { AccountActionSchema } from "./schemas";

export async function onRequestPost(context: PagesContext<LteEnv>): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireAuth(context.request, context.env);
    const userId = user.sub;

    const body = await readJsonObject(context.request);
    const parsed = AccountActionSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid action. Must be 'deactivate' or 'delete'", 400, {
        code: "VALIDATION_ERROR",
        requestId,
        details: parsed.error.issues,
      });
    }
    const { action } = parsed.data;

    const supabase = createServiceSupabase(context.env);

    const newStatus = action === "deactivate" ? "inactive" : "deleted";
    const now = new Date().toISOString();

    const { error } = await supabase
      .from("users")
      .update({
        status: newStatus,
        updated_at: now,
      })
      .eq("id", userId);

    if (error) {
      throw error;
    }

    apiLogger.info(`Account ${action} executed for user`, { userId, action, status: newStatus });

    return jsonResponse({
      success: true,
      message:
        action === "deactivate"
          ? "Account has been deactivated successfully."
          : "Account has been permanently deleted.",
      status: newStatus,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.message, error.code === "UNAUTHORIZED" ? 401 : 403, {
        code: error.code,
        requestId,
      });
    }

    apiLogger.error("Failed to execute account action", error, { requestId });
    return jsonError("Internal server error", 500, { code: "SERVER_ERROR", requestId });
  }
}
