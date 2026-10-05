import { jsonError, jsonResponse } from "@functions/lib/http";
import { resolveActiveTrack } from "@functions/lib/learner-track";
import { createServiceQueryGateway } from "@functions/lib/query-gateway";
import { syncSsoShadowData } from "@functions/lib/sync-shadow";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { AuthError, requireAuth } from "@functions/middleware";
import { apiLogger } from "@functions/shared/logger";
import { z } from "zod";

const refreshParam = z.enum(["true", "false"]).optional().default("false");

export async function onRequestGet(context: PagesContext<LteEnv>): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireAuth(context.request, context.env);
    const userId = user.sub;

    const qb = createServiceQueryGateway(context.env);
    // A valid SSO session can survive a local database restore. Provision the
    // missing user before importing tracks that reference public.users.
    await syncSsoShadowData(qb, user, null);
    const refresh = refreshParam.parse(
      new URL(context.request.url).searchParams.get("refresh") ?? undefined,
    );
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
