import { jsonError, jsonResponse } from "@functions/lib/http";
import { createServiceSupabase } from "@functions/lib/supabase";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { countConsecutiveDaysFromToday } from "@functions/lib/xp-engine";
import { AuthError, requireAuth } from "@functions/middleware";
import { apiLogger } from "@functions/shared/logger";

export interface DashboardStreakResponse {
  success: boolean;
  streakDays: number;
}

function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function isLoginDateMetadata(metadata: unknown): metadata is { login_date: string } {
  return typeof (metadata as Record<string, unknown> | null)?.["login_date"] === "string";
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
