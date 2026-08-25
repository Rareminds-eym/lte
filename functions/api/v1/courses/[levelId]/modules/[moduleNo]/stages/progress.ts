import { emitStageCompletedEvent } from "@functions/api/v1/courses/lteSyncQueue";
import { upsertStageProgress } from "@functions/api/v1/courses/queries";
import { LevelModuleParamsSchema } from "@functions/api/v1/courses/schemas";
import { jsonError, jsonResponse, readJsonObject } from "@functions/lib/http";
import { createServiceQueryGateway } from "@functions/lib/query-gateway";
import { QueryGatewayDatabaseError } from "@functions/lib/query-gateway/errors";
import { LTE_STAGE_SEQUENCE, StageSequenceError } from "@functions/lib/stage-sequence";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { awardXp } from "@functions/lib/xp-engine";
import { AuthError, requireAuth } from "@functions/middleware";
import { apiLogger } from "@functions/shared/logger";
import { z } from "zod";

const eContentModuleContentReadPolicy = {
  table: "e_content",
  operation: "read",
  columns: ["modules_content_id"],
  filters: ["id"],
} as const;

const routeLevelProgressReadPolicy = {
  table: "user_capability_level_progress",
  operation: "read",
  columns: ["id", "status"],
  filters: ["user_id", "level_id"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
} as const;

const routeXpEventReadPolicy = {
  table: "xp_events",
  operation: "read",
  columns: ["xp_amount"],
  filters: ["user_id", "event_type", "source_id"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
} as const;

const routeXpTotalReadPolicy = {
  table: "xp_events",
  operation: "read",
  columns: ["xp_amount"],
  filters: ["user_id"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
  maxPageSize: 1000,
} as const;

const routeStageProgressReadPolicy = {
  table: "user_stage_progress",
  operation: "read",
  columns: ["user_module_progress_id", "time_spent_seconds"],
  filters: ["id"],
} as const;

const routeModuleProgressCountersReadPolicy = {
  table: "user_module_progress",
  operation: "read",
  columns: ["stages_completed", "completion_percentage"],
  filters: ["id"],
} as const;

const StageProgressBodySchema = z.object({
  eContentId: z.string().uuid("Invalid eContentId format"),
  stageName: z.enum(LTE_STAGE_SEQUENCE),
  status: z.enum(["in_progress", "completed"]),
  durationSeconds: z
    .number()
    .int()
    .min(0)
    .max(24 * 60 * 60)
    .optional(),
});

async function getRouteUserTotalXp(
  qb: ReturnType<typeof createServiceQueryGateway>,
  userId: string,
): Promise<number> {
  let page = 1;
  let total = 0;

  while (true) {
    const rows = (await qb.read(routeXpTotalReadPolicy, {
      auth: { userId },
      page,
      pageSize: 1000,
    })) as Array<{ xp_amount: number | null }> | null;

    const batch = rows ?? [];
    total += batch.reduce((sum, row) => sum + (row.xp_amount ?? 0), 0);
    if (batch.length < 1000) return total;
    page += 1;
  }
}

export async function onRequestPost(context: PagesContext<LteEnv>): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireAuth(context.request, context.env);
    const userId = user.sub;

    const parsedParams = LevelModuleParamsSchema.safeParse(context.params);
    if (!parsedParams.success) {
      return jsonError(parsedParams.error.issues[0]?.message ?? "Invalid route parameters", 400, {
        code: "VALIDATION_ERROR",
        requestId,
      });
    }

    const { levelId, moduleNo } = parsedParams.data;
    const moduleNumber = parseInt(moduleNo, 10);

    let rawBody: Record<string, unknown>;
    try {
      rawBody = await readJsonObject(context.request);
    } catch {
      return jsonError("Request body must be a valid JSON object", 400, {
        code: "BAD_REQUEST",
        requestId,
      });
    }

    const parsedBody = StageProgressBodySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return jsonError(parsedBody.error.issues[0]?.message ?? "Invalid request body", 400, {
        code: "VALIDATION_ERROR",
        requestId,
      });
    }

    const { eContentId, stageName, status, durationSeconds } = parsedBody.data;
    const qb = createServiceQueryGateway(context.env);

    let progressData: {
      stageProgressId: string;
      stagesCompleted: number | null | undefined;
      completionPercentage: number | null | undefined;
    };
    let xpAwarded = 0;
    let totalXp = 0;
    let levelCompleted = false;
    let levelXpAwarded = 0;

    if (status === "completed") {
      // 1. Resolve modules_content_id from e_content
      let eContent: { modules_content_id?: string | null } | null;
      try {
        eContent = (await qb.read(eContentModuleContentReadPolicy, {
          filters: [{ column: "id", op: "eq", value: eContentId }],
          result: "single",
        })) as { modules_content_id?: string | null } | null;
      } catch (error) {
        if (error instanceof QueryGatewayDatabaseError) {
          return jsonError("Associated modules_content stage not found for eContentId", 404, {
            code: "NOT_FOUND",
            requestId,
          });
        }
        throw error;
      }

      if (!eContent?.modules_content_id) {
        return jsonError("Associated modules_content stage not found for eContentId", 404, {
          code: "NOT_FOUND",
          requestId,
        });
      }

      // Query level progress status before recalculation
      const levelProgressBefore = (await qb.read(routeLevelProgressReadPolicy, {
        auth: { userId },
        filters: [{ column: "level_id", op: "eq", value: levelId }],
        result: "maybeSingle",
      })) as { id?: string; status?: string | null } | null;

      const wasLevelCompleted = levelProgressBefore?.status === "completed";

      // 2. Complete stage progress through the gateway and award idempotent XP.
      progressData = await upsertStageProgress(
        qb,
        userId,
        levelId,
        moduleNumber,
        eContentId,
        stageName,
        status,
        durationSeconds,
      );
      const xpResult = await awardXp(
        qb,
        userId,
        "stage_completed",
        "user_stage_progress",
        String(progressData.stageProgressId),
        { modules_content_id: eContent.modules_content_id, stage_name: stageName },
      );
      xpAwarded = xpResult.xpAwarded;

      // Query level progress status and XP events after recalculation
      const levelProgressAfter = (await qb.read(routeLevelProgressReadPolicy, {
        auth: { userId },
        filters: [{ column: "level_id", op: "eq", value: levelId }],
        result: "maybeSingle",
      })) as { id?: string; status?: string | null } | null;

      const isLevelCompleted = levelProgressAfter?.status === "completed";
      if (isLevelCompleted && !wasLevelCompleted && levelProgressAfter?.id) {
        levelCompleted = true;
        const xpEvent = (await qb.read(routeXpEventReadPolicy, {
          auth: { userId },
          filters: [
            { column: "event_type", op: "eq", value: "course_completed_on_time" },
            { column: "source_id", op: "eq", value: levelProgressAfter.id },
          ],
          result: "maybeSingle",
        })) as { xp_amount?: number | null } | null;

        if (xpEvent) {
          levelXpAwarded = xpEvent.xp_amount ?? 0;
        }
      }

      totalXp = await getRouteUserTotalXp(qb, userId);

      // 3. Fetch the updated progress counters from user_module_progress to return to client
      let stageProg: {
        user_module_progress_id?: string | null;
        time_spent_seconds?: number | null;
      } | null;
      try {
        stageProg = (await qb.read(routeStageProgressReadPolicy, {
          filters: [{ column: "id", op: "eq", value: progressData.stageProgressId }],
          result: "single",
        })) as {
          user_module_progress_id?: string | null;
          time_spent_seconds?: number | null;
        } | null;
      } catch (error) {
        if (error instanceof QueryGatewayDatabaseError) {
          throw new Error("Failed to find module progress ID for returning status data");
        }
        throw error;
      }

      if (!stageProg) {
        throw new Error("Failed to find module progress ID for returning status data");
      }

      let updatedProgress: {
        stages_completed?: number | null;
        completion_percentage?: number | null;
      } | null;
      try {
        updatedProgress = (await qb.read(routeModuleProgressCountersReadPolicy, {
          filters: [{ column: "id", op: "eq", value: stageProg.user_module_progress_id }],
          result: "single",
        })) as { stages_completed?: number | null; completion_percentage?: number | null } | null;
      } catch (error) {
        if (error instanceof QueryGatewayDatabaseError) {
          throw new Error("Failed to fetch updated progress counters");
        }
        throw error;
      }

      if (!updatedProgress) {
        throw new Error("Failed to fetch updated progress counters");
      }

      progressData = {
        stageProgressId: progressData.stageProgressId,
        stagesCompleted: updatedProgress.stages_completed,
        completionPercentage: updatedProgress.completion_percentage,
      };
    } else {
      // Standard in-progress update
      progressData = await upsertStageProgress(
        qb,
        userId,
        levelId,
        moduleNumber,
        eContentId,
        stageName,
        status,
        durationSeconds,
      );
    }

    // Emit self-contained sync event to Cloudflare Queue ONLY AFTER DB writes succeeded!
    if (status === "completed") {
      await emitStageCompletedEvent(qb, context.env, {
        userId,
        levelId,
        moduleNumber,
        durationSeconds,
        levelCompleted,
        status,
      });
    }

    return jsonResponse({
      success: true,
      ...progressData,
      xpAwarded,
      totalXp,
      xpCategory: "evidence",
      levelCompleted,
      levelXpAwarded,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.message, error.code === "UNAUTHORIZED" ? 401 : 403, {
        code: error.code,
        requestId,
      });
    }

    if (error instanceof StageSequenceError) {
      return jsonError(error.message, 409, {
        code: error.code,
        requestId,
      });
    }

    apiLogger.error("Failed to update stage progress", error, { requestId });
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return jsonError(errorMessage, 500, { code: "SERVER_ERROR", requestId });
  }
}
