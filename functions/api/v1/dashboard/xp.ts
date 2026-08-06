import { AuthError, requireAuth } from "@functions/lib/auth";
import { jsonError, jsonResponse } from "@functions/lib/http";
import { apiLogger } from "@functions/lib/logger";
import { createServiceSupabase } from "@functions/lib/supabase";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { getUserTotalXp } from "@functions/lib/xp-engine";
import { DashboardXpQuerySchema } from "./schemas";

export interface DashboardXpResponse {
  success: boolean;
  totalXp: number;
  xpThisWeek: number;
  todayXp: number;
}

function startOfDayUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function startOfWeekMondayUtc(now: Date): Date {
  const diff = (now.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff));
}

export async function onRequestGet(context: PagesContext<LteEnv>): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireAuth(context.request, context.env);

    const params = new URL(context.request.url).searchParams;
    const parsedQuery = DashboardXpQuerySchema.safeParse({
      since: params.get("since") ?? undefined,
      todaySince: params.get("todaySince") ?? undefined,
    });
    if (!parsedQuery.success) {
      return jsonError("Invalid query parameters", 400, {
        code: "VALIDATION_ERROR",
        requestId,
      });
    }
    // ponytail: week/day boundaries computed by the browser in the user's local tz;
    // fall back to UTC boundaries when absent rather than silently equaling totals
    const { since, todaySince } = parsedQuery.data;

    const supabase = createServiceSupabase(context.env);
    const now = new Date();
    const totalXp = await getUserTotalXp(supabase, user.sub);
    const xpThisWeek = await getUserTotalXp(supabase, user.sub, since ?? startOfWeekMondayUtc(now));
    const todayXp = await getUserTotalXp(supabase, user.sub, todaySince ?? startOfDayUtc(now));

    return jsonResponse<DashboardXpResponse>({ success: true, totalXp, xpThisWeek, todayXp });
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.message, error.code === "UNAUTHORIZED" ? 401 : 403, {
        code: error.code,
        requestId,
      });
    }

    apiLogger.error("Failed to fetch dashboard XP", error, { requestId });
    const message = error instanceof Error ? error.message : "Internal server error";
    return jsonError(message, 500, { code: "SERVER_ERROR", requestId });
  }
}
