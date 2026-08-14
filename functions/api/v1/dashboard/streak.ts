import { jsonError, jsonResponse } from "@functions/lib/http";
import { createServiceQueryGateway } from "@functions/lib/query-gateway";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { countConsecutiveDaysFromToday } from "@functions/lib/xp-engine";
import { AuthError, requireAuth } from "@functions/middleware";
import { apiLogger } from "@functions/shared/logger";

export interface DashboardStreakResponse {
  success: boolean;
  streakDays: number;
}

const dailyLoginStreakReadPolicy = {
  table: "xp_events",
  operation: "read",
  columns: ["metadata"],
  filters: ["user_id", "event_type"],
  ownership: {
    column: "user_id",
    source: "authenticatedUserId",
    required: true,
  },
} as const;

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

    const qb = createServiceQueryGateway(context.env);
    const data = (await qb.read(dailyLoginStreakReadPolicy, {
      auth: { userId: user.sub },
      filters: [{ column: "event_type", op: "eq", value: "daily_login" }],
    })) as Array<{ metadata: unknown }> | null;

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
