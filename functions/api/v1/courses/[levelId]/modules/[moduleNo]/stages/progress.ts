import { jsonError, jsonResponse, readJsonObject } from "@functions/lib/http";
import { LTE_STAGE_SEQUENCE, StageSequenceError } from "@functions/lib/stage-sequence";
import { createServiceSupabase } from "@functions/lib/supabase";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { completeStage, getUserTotalXp } from "@functions/lib/xp-engine";
import { AuthError, requireAuth } from "@functions/middleware";
import { apiLogger } from "@functions/shared/logger";
import { z } from "zod";
import { recalculateLevelProgress, upsertStageProgress } from "../../../../queries";
import { LevelModuleParamsSchema } from "../../../../schemas";

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
    const supabase = createServiceSupabase(context.env);

    let progressData: Record<string, unknown>;
    let xpAwarded = 0;
    let totalXp = 0;
    let levelCompleted = false;
    let levelXpAwarded = 0;

    if (status === "completed") {
      // 1. Resolve modules_content_id from e_content
      const { data: eContent, error: eError } = await supabase
        .from("e_content")
        .select("modules_content_id")
        .eq("id", eContentId)
        .single();

      if (eError || !eContent) {
        return jsonError("Associated modules_content stage not found for eContentId", 404, {
          code: "NOT_FOUND",
          requestId,
        });
      }

      // Query level progress status before recalculation
      const { data: levelProgressBefore } = await supabase
        .from("user_capability_level_progress")
        .select("status")
        .eq("user_id", userId)
        .eq("level_id", levelId)
        .maybeSingle();

      const wasLevelCompleted = levelProgressBefore?.status === "completed";

      // 2. Call completeStage from the unified XP engine
      const xpResult = await completeStage(supabase, userId, eContent.modules_content_id);
      xpAwarded = xpResult.xpAwarded;

      // Recalculate level progress to trigger level completions and on-time rewards
      try {
        await recalculateLevelProgress(supabase, userId, levelId);
      } catch (err) {
        apiLogger.error("Failed to recalculate level progress", err, { userId, levelId });
      }

      // Query level progress status and XP events after recalculation
      const { data: levelProgressAfter } = await supabase
        .from("user_capability_level_progress")
        .select("id, status")
        .eq("user_id", userId)
        .eq("level_id", levelId)
        .maybeSingle();

      const isLevelCompleted = levelProgressAfter?.status === "completed";
      if (isLevelCompleted && !wasLevelCompleted && levelProgressAfter?.id) {
        levelCompleted = true;
        const { data: xpEvent } = await supabase
          .from("xp_events")
          .select("xp_amount")
          .eq("user_id", userId)
          .eq("event_type", "course_completed_on_time")
          .eq("source_id", levelProgressAfter.id)
          .maybeSingle();

        if (xpEvent) {
          levelXpAwarded = xpEvent.xp_amount;
        }
      }

      totalXp = await getUserTotalXp(supabase, userId);

      // 3. Fetch the updated progress counters from user_module_progress to return to client
      const { data: stageProg, error: stageProgErr } = await supabase
        .from("user_stage_progress")
        .select("user_module_progress_id, time_spent_seconds")
        .eq("id", xpResult.userStageProgressId)
        .single();

      if (stageProgErr || !stageProg) {
        throw new Error("Failed to find module progress ID for returning status data");
      }

      if (durationSeconds && durationSeconds > 0) {
        const { error: timerUpdateError } = await supabase
          .from("user_stage_progress")
          .update({
            time_spent_seconds: (stageProg.time_spent_seconds ?? 0) + durationSeconds,
            last_viewed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", xpResult.userStageProgressId);

        if (timerUpdateError) {
          throw new Error(`Failed to update content viewing time: ${timerUpdateError.message}`);
        }
      }

      const { data: updatedProgress, error: progressFetchErr } = await supabase
        .from("user_module_progress")
        .select("stages_completed, completion_percentage")
        .eq("id", stageProg.user_module_progress_id)
        .single();

      if (progressFetchErr || !updatedProgress) {
        throw new Error("Failed to fetch updated progress counters");
      }

      progressData = {
        stageProgressId: xpResult.userStageProgressId,
        stagesCompleted: updatedProgress.stages_completed,
        completionPercentage: updatedProgress.completion_percentage,
      };
    } else {
      // Standard in-progress update
      progressData = await upsertStageProgress(
        supabase,
        userId,
        levelId,
        moduleNumber,
        eContentId,
        stageName,
        status,
        durationSeconds,
      );
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
