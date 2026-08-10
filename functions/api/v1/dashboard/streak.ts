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

function getTodayDateString(): string {
  const todayStr = new Date().toISOString().split("T")[0];
  if (!todayStr || !/^\d{4}-\d{2}-\d{2}$/.test(todayStr)) {
    throw new Error("Invalid date format generated");
  }
  return todayStr;
}

function isLoginDateMetadata(metadata: unknown): metadata is { login_date: string } {
  return (
    metadata !== null &&
    typeof metadata === "object" &&
    !Array.isArray(metadata) &&
    "login_date" in metadata &&
    typeof metadata.login_date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(metadata.login_date)
  );
}

export async function onRequestGet(context: PagesContext<LteEnv>): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireAuth(context.request, context.env);
    const todayStr = getTodayDateString();

    const { data, error } = await createServiceSupabase(context.env)
      .from("xp_events")
      .select("metadata")
      .eq("user_id", user.sub)
      .eq("event_type", "daily_login");

    if (error) throw error;

    const loginDates = new Set<string>();
    for (const row of data ?? []) {
      const metadata = row.metadata;
      if (isLoginDateMetadata(metadata)) loginDates.add(metadata.login_date);
    }

    return jsonResponse<DashboardStreakResponse>({
      success: true,
      streakDays: countConsecutiveDaysFromToday(todayStr, Array.from(loginDates).sort().reverse()),
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
