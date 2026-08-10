import { AuthError, requireAuth } from "@functions/lib/auth";
import { jsonError, jsonResponse } from "@functions/lib/http";
import { apiLogger } from "@functions/lib/logger";
import { createServiceSupabase } from "@functions/lib/supabase";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { countConsecutiveDaysFromToday } from "@functions/lib/xp-engine";

export interface DashboardStreakResponse {
  success: boolean;
  streakDays: number;
}

export async function onRequestGet(context: PagesContext<LteEnv>): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireAuth(context.request, context.env);
    const todayStr = new Date().toISOString().split("T")[0] || "";

    const { data, error } = await createServiceSupabase(context.env)
      .from("xp_events")
      .select("metadata")
      .eq("user_id", user.sub)
      .eq("event_type", "daily_login");

    if (error) throw error;

    const loginDates = new Set<string>();
    for (const row of data ?? []) {
      const metadata = row.metadata;
      const loginDate =
        metadata !== null &&
        typeof metadata === "object" &&
        !Array.isArray(metadata) &&
        typeof (metadata as Record<string, unknown>)["login_date"] === "string"
          ? ((metadata as Record<string, unknown>)["login_date"] as string)
          : null;
      if (loginDate) loginDates.add(loginDate);
    }

    return jsonResponse<DashboardStreakResponse>({
      success: true,
      streakDays: countConsecutiveDaysFromToday(
        todayStr,
        Array.from(loginDates).sort((a, b) => (a > b ? -1 : 1)),
      ),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.message, error.code === "UNAUTHORIZED" ? 401 : 403, {
        code: error.code,
        requestId,
      });
    }

    apiLogger.error("Failed to fetch dashboard streak", error, { requestId });
    const message = error instanceof Error ? error.message : "Internal server error";
    return jsonError(message, 500, { code: "SERVER_ERROR", requestId });
  }
}
