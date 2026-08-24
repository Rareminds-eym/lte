import { jsonError, jsonResponse } from "@functions/lib/http";
import { createServiceQueryGateway } from "@functions/lib/query-gateway";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { AuthError, requireAuth } from "@functions/middleware";
import { apiLogger } from "@functions/shared/logger";
import { DashboardXpQuerySchema } from "./schemas";

export interface TodayXpEvent {
  id: string;
  event_type: string;
  xp_amount: number;
  metadata: Record<string, unknown>;
}

export interface DashboardXpResponse {
  success: boolean;
  totalXp: number;
  xpThisWeek: number;
  todayXp: number;
  todayEvents?: TodayXpEvent[];
}

const todayXpEventsReadPolicy = {
  table: "xp_events",
  operation: "read",
  columns: ["id", "event_type", "xp_amount", "metadata"],
  filters: ["user_id", "created_at", "event_type"],
  ownership: {
    column: "user_id",
    source: "authenticatedUserId",
    required: true,
  },
  maxPageSize: 100,
} as const;

const xpTotalReadPolicy = {
  table: "xp_events",
  operation: "read",
  columns: ["xp_amount"],
  filters: ["user_id", "created_at"],
  ownership: {
    column: "user_id",
    source: "authenticatedUserId",
    required: true,
  },
  maxPageSize: 1000,
} as const;

const markXpEventsShownRpcPolicy = {
  operation: "rpc",
  functionName: "mark_xp_events_shown",
  allowedArgs: ["p_event_ids"],
  ownership: {
    arg: "p_user_id",
    source: "authenticatedUserId",
    required: true,
  },
} as const;

function startOfDayUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function startOfWeekMondayUtc(now: Date): Date {
  const diff = (now.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff));
}

async function getUserTotalXpFromGateway(
  qb: ReturnType<typeof createServiceQueryGateway>,
  userId: string,
  since?: Date,
): Promise<number> {
  let page = 1;
  let total = 0;

  while (true) {
    const rows = (await qb.read(xpTotalReadPolicy, {
      auth: { userId },
      filters: since ? [{ column: "created_at", op: "gte", value: since.toISOString() }] : [],
      page,
      pageSize: 1000,
    })) as Array<{ xp_amount: number | null }> | null;

    const batch = rows ?? [];
    total += batch.reduce((sum, row) => sum + (row.xp_amount ?? 0), 0);
    if (batch.length < 1000) {
      return total;
    }
    page += 1;
  }
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

    const qb = createServiceQueryGateway(context.env);
    const now = new Date();
    const totalXp = await getUserTotalXpFromGateway(qb, user.sub);
    const xpThisWeek = await getUserTotalXpFromGateway(
      qb,
      user.sub,
      since ?? startOfWeekMondayUtc(now),
    );
    const todayXp = await getUserTotalXpFromGateway(qb, user.sub, todaySince ?? startOfDayUtc(now));

    // Query today's engagement XP events
    const eventsData = (await qb.read(todayXpEventsReadPolicy, {
      auth: { userId: user.sub },
      filters: [
        {
          column: "created_at",
          op: "gte",
          value: (todaySince ?? startOfDayUtc(now)).toISOString(),
        },
        {
          column: "event_type",
          op: "in",
          value: ["daily_login", "streak_7_day", "consistency_30_day", "legacy_consistency_bonus"],
        },
      ],
    })) as TodayXpEvent[] | null;

    const todayEvents = (eventsData ?? [])
      .filter((row) => {
        const metadata = row.metadata as Record<string, unknown> | null;
        return metadata?.["modal_shown"] !== true;
      })
      .map((row) => {
        const metadata = row.metadata;
        const isObject =
          metadata !== null && typeof metadata === "object" && !Array.isArray(metadata);
        return {
          id: row.id,
          event_type: row.event_type,
          xp_amount: row.xp_amount,
          metadata: isObject ? (metadata as Record<string, unknown>) : {},
        };
      });

    return jsonResponse<DashboardXpResponse>({
      success: true,
      totalXp,
      xpThisWeek,
      todayXp,
      todayEvents,
    });
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

export async function onRequestPost(context: PagesContext<LteEnv>): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireAuth(context.request, context.env);
    const body = (await context.request.json()) as { eventIds?: string[] };
    if (!body.eventIds || !Array.isArray(body.eventIds)) {
      return jsonError("Invalid request body", 400, {
        code: "VALIDATION_ERROR",
        requestId,
      });
    }

    const qb = createServiceQueryGateway(context.env);

    await qb.rpc(markXpEventsShownRpcPolicy, {
      auth: { userId: user.sub },
      args: { p_event_ids: body.eventIds },
    });

    return jsonResponse({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.message, error.code === "UNAUTHORIZED" ? 401 : 403, {
        code: error.code,
        requestId,
      });
    }

    apiLogger.error("Failed to mark XP events as shown", error, { requestId });
    const message = error instanceof Error ? error.message : "Internal server error";
    return jsonError(message, 500, { code: "SERVER_ERROR", requestId });
  }
}
