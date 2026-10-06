import { jsonError, jsonResponse } from "@functions/lib/http";
import { TRACK_REFRESH_RATE_LIMIT } from "@functions/lib/human-review";
import { resolveActiveTrack } from "@functions/lib/learner-track";
import { createServiceQueryGateway } from "@functions/lib/query-gateway";
import { syncSsoShadowData } from "@functions/lib/sync-shadow";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import {
  AuthError,
  checkDistributedRateLimit,
  rateLimitErrorResponse,
  requireAuth,
} from "@functions/middleware";
import { apiLogger } from "@functions/shared/logger";
import { z } from "zod";

const refreshParam = z.enum(["true", "false"]).optional().default("false");

export async function onRequestGet(context: PagesContext<LteEnv>): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireAuth(context.request, context.env);
    const userId = user.sub;

    const parsedRefresh = refreshParam.safeParse(
      new URL(context.request.url).searchParams.get("refresh") ?? undefined,
    );
    if (!parsedRefresh.success)
      return jsonError("Invalid refresh parameter", 400, { code: "VALIDATION_ERROR", requestId });
    const refresh = parsedRefresh.data;
    if (refresh === "true") {
      const rate = await checkDistributedRateLimit(
        context.env.RATE_LIMIT_KV,
        userId,
        TRACK_REFRESH_RATE_LIMIT,
      );
      if (!rate.allowed)
        return rateLimitErrorResponse(
          requestId,
          rate.retryAfterMs,
          "Too many learning path refreshes. Please wait before retrying.",
        );
    }
    const qb = createServiceQueryGateway(context.env);
    await syncSsoShadowData(qb, user, null);
    const { data, needsAssessment } = await resolveActiveTrack(qb, context.env, userId, {
      refresh: refresh === "true",
    });

    return jsonResponse({
      success: true,
      data,
      needsAssessment,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.message, error.code === "UNAUTHORIZED" ? 401 : 403, {
        code: error.code,
        requestId,
      });
    }

    apiLogger.error("Failed to resolve active learning path", error, { requestId });
    return jsonError("Unable to load your learning path. Please try again.", 503, {
      code: "LEARNING_PATH_UNAVAILABLE",
      requestId,
    });
  }
}
