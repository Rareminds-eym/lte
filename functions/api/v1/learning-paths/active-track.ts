import { jsonError, jsonResponse, readJsonObject } from "@functions/lib/http";
import { createServiceQueryGateway } from "@functions/lib/query-gateway";
import {
  acknowledgeTrackActivation,
  authorizeTrackActivation,
  reserveTrackActivation,
  SubscriptionAccessError,
} from "@functions/lib/subscription-access";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { AuthError, requireAuth } from "@functions/middleware";
import { apiLogger } from "@functions/shared/logger";
import { z } from "zod";
import {
  activateLearningTrack,
  classifyTrackActivation,
  readCommittedTrackActivation,
} from "./queries";

const ActivateTrackSchema = z
  .object({
    trackId: z.string().uuid("trackId must be a valid UUID"),
    operationId: z.string().uuid("operationId must be a valid UUID"),
  })
  .strict();

export async function onRequestPatch(context: PagesContext<LteEnv>): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireAuth(context.request, context.env);
    const userId = user.sub;

    let rawBody: Record<string, unknown>;
    try {
      rawBody = await readJsonObject(context.request);
    } catch (err) {
      apiLogger.error("Failed to parse JSON request body", err, { requestId });
      return jsonError("Request body must be a valid JSON object", 400, {
        code: "BAD_REQUEST",
        requestId,
      });
    }

    const parsedBody = ActivateTrackSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return jsonError(parsedBody.error.issues[0]?.message ?? "Invalid request body", 400, {
        code: "VALIDATION_ERROR",
        requestId,
      });
    }

    const { trackId, operationId } = parsedBody.data;
    const qb = createServiceQueryGateway(context.env);
    const recorded = await readCommittedTrackActivation(qb, userId, trackId, operationId);
    if (recorded?.kind === "reserved") {
      await acknowledgeTrackActivation(context.env, recorded.reservation, recorded.outcome);
    } else if (!recorded) {
      const authority = await authorizeTrackActivation(context.env, context.request, userId);
      const disposition = await classifyTrackActivation(
        qb,
        userId,
        trackId,
        operationId,
        authority,
      );
      if (disposition.kind === "reservation_required") {
        const reservation = await reserveTrackActivation(
          context.env,
          context.request,
          userId,
          operationId,
          trackId,
        );
        const outcome = await activateLearningTrack(qb, userId, trackId, operationId, reservation);
        await acknowledgeTrackActivation(context.env, reservation, outcome);
      }
    }

    return jsonResponse(
      {
        success: true,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof SubscriptionAccessError) {
      return jsonError("Subscription action denied", error.status, {
        code: "SUBSCRIPTION_ACCESS_DENIED",
        requestId,
      });
    }
    if (error instanceof AuthError) {
      return jsonError(error.message, error.code === "UNAUTHORIZED" ? 401 : 403, {
        code: error.code,
        requestId,
      });
    }

    apiLogger.error("Unhandled error in active-track PATCH", error, { requestId });
    return jsonError("Activation unavailable", 503, { code: "SERVER_ERROR", requestId });
  }
}
