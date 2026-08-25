import { jsonError, jsonResponse } from "@functions/lib/http";
import { createServiceQueryGateway } from "@functions/lib/query-gateway";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { calculateReadiness } from "@functions/lib/xp-engine.progress";
import { AuthError, requireAuth } from "@functions/middleware";
import { apiLogger } from "@functions/shared/logger";

// In-memory sliding window rate limiter
// Key: userId, Value: timestamps of calls in the last 60 seconds
const rateLimiterCache = new Map<string, number[]>();
let lastPruneTime = Date.now();

const latestLearningPathReadPolicy = {
  table: "learning_paths",
  operation: "read",
  columns: ["id"],
  filters: ["user_id", "is_latest"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
} as const;

function pruneRateLimiterCache(now: number) {
  if (now - lastPruneTime < 60000) return;
  lastPruneTime = now;
  for (const [key, timestamps] of rateLimiterCache.entries()) {
    const recent = timestamps.filter((t) => now - t < 60000);
    if (recent.length === 0) {
      rateLimiterCache.delete(key);
    } else {
      rateLimiterCache.set(key, recent);
    }
  }
}

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  pruneRateLimiterCache(now);
  const timestamps = rateLimiterCache.get(userId) || [];
  // Keep only timestamps within the last 60 seconds
  const recent = timestamps.filter((t) => now - t < 60000);
  if (recent.length >= 5) {
    return false; // Limit exceeded
  }
  recent.push(now);
  rateLimiterCache.set(userId, recent);
  return true;
}

export async function onRequestPost(context: PagesContext<LteEnv>): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireAuth(context.request, context.env);
    const userId = user.sub;

    // Enforce 5 calls/minute per user rate limit
    if (!checkRateLimit(userId)) {
      return jsonError(
        "Too many calculation requests. Strictly rate-limited to 5 calls/minute.",
        429,
        {
          code: "RATE_LIMIT_EXCEEDED",
          requestId,
        },
      );
    }

    const qb = createServiceQueryGateway(context.env);

    // Fetch the user's latest active learning path
    const path = (await qb.read(latestLearningPathReadPolicy, {
      auth: { userId },
      filters: [{ column: "is_latest", op: "eq", value: true }],
      result: "maybeSingle",
    })) as { id: string } | null;

    if (!path) {
      return jsonError("No active learning path found for this user", 404, {
        code: "LEARNING_PATH_NOT_FOUND",
        requestId,
      });
    }

    // Trigger calculation
    const result = await calculateReadiness(qb, userId, path.id);

    return jsonResponse({
      success: true,
      readinessScore: result.readinessScore,
      band: result.band,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.message, error.code === "UNAUTHORIZED" ? 401 : 403, {
        code: error.code,
        requestId,
      });
    }

    apiLogger.error("Failed to execute manual readiness recalculation", error, { requestId });
    return jsonError("Internal server error", 500, { code: "SERVER_ERROR", requestId });
  }
}
