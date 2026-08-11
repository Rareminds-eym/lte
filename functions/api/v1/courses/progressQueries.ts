import {
  assertStageSequenceAllowed,
  getStageCompletionPercentage,
  getStageOrder,
  LTE_STAGE_COUNT,
  normalizeStageName,
} from "@functions/lib/stage-sequence";
import { apiLogger } from "@functions/shared/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function upsertLevelProgress(
  supabase: SupabaseClient,
  userId: string,
  levelId: string,
  status: string = "in_progress",
): Promise<string> {
  // Fetch level details to extract level number and capability
  const { data: levelData, error: levelError } = await supabase
    .from("levels")
    .select("id, level_code, capability_id")
    .eq("id", levelId)
    .single();

  if (levelError || !levelData) {
    throw new Error(`Level with id '${levelId}' not found: ${levelError?.message}`);
  }

  const levelCodeMatch = levelData.level_code.match(/L(\d+)/i);
  const sequenceNo = parseInt(levelCodeMatch?.[1] ?? "1", 10);
  const capabilityId = levelData.capability_id;

  // Fetch active learning track
  const { data: trackData, error: trackError } = await supabase
    .from("learning_tracks")
    .select("id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (trackError) {
    throw new Error(`Failed to query active learning path: ${trackError.message}`);
  }
  if (!trackData) {
    throw new Error("No active learning path found for this user");
  }

  // Fetch learning paths under active track
  const { data: pathsData, error: pathsError } = await supabase
    .from("learning_paths")
    .select("id, role_id")
    .eq("user_id", userId)
    .eq("learning_track_id", trackData.id);

  if (pathsError) {
    throw new Error(`Failed to query active learning path: ${pathsError.message}`);
  }
  if (!pathsData || pathsData.length === 0) {
    throw new Error("No active learning path found for this user");
  }

  // Fetch role capability sequence to match the capability to the correct role
  const roleIds = pathsData.map((p) => p.role_id);
  const { data: seqRoleData, error: seqRoleError } = await supabase
    .from("role_capability_sequence")
    .select("role_id")
    .in("role_id", roleIds)
    .eq("capability_id", capabilityId);

  if (seqRoleError) {
    throw new Error(`Failed to query active learning path: ${seqRoleError.message}`);
  }

  const matchingRoleId = seqRoleData && seqRoleData.length > 0 ? seqRoleData[0]?.role_id : null;
  const activePath = pathsData.find((p) => p.role_id === matchingRoleId) ?? pathsData[0];

  if (!activePath) {
    throw new Error("No active learning path found for this user");
  }

  const learningPathId = activePath.id;
  const roleId = activePath.role_id;

  // Check for existing progress
  const { data: existingProgress, error: fetchError } = await supabase
    .from("user_capability_level_progress")
    .select("id, status")
    .eq("user_id", userId)
    .eq("learning_path_id", learningPathId)
    .eq("level_id", levelId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to query level progress: ${fetchError.message}`);
  }

  if (existingProgress) {
    if (existingProgress.status === "not_started" && status === "in_progress") {
      const { error: updateError } = await supabase
        .from("user_capability_level_progress")
        .update({
          status: "in_progress",
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingProgress.id);

      if (updateError) {
        throw new Error(`Failed to update level progress status: ${updateError.message}`);
      }

      // Check and update learning path status to in_progress
      const { data: pathData } = await supabase
        .from("learning_paths")
        .select("status, started_at")
        .eq("id", learningPathId)
        .maybeSingle();

      if (pathData && pathData.status === "not_started") {
        await supabase
          .from("learning_paths")
          .update({
            status: "in_progress",
            started_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", learningPathId);
      }
    }
    return existingProgress.id;
  }

  // Fetch capability priority, current level, and required level for computations
  const { data: seqData, error: seqError } = await supabase
    .from("role_capability_sequence")
    .select("id, required_level, capability_priority")
    .eq("role_id", roleId)
    .eq("capability_id", capabilityId)
    .maybeSingle();

  let priorityBand = "none";
  let requiredLevelNum = 1;
  let currentLevelNum = 0;

  if (seqError) {
    throw new Error(`Failed to query role capability sequence: ${seqError.message}`);
  }

  if (seqData) {
    priorityBand = seqData.capability_priority ?? "none";
    const levelMap: Record<string, number> = { L1: 1, L2: 2, L3: 3, L4: 4, L5: 5 };
    requiredLevelNum = levelMap[seqData.required_level as string] || 1;

    // Fetch current capability level
    const { data: capData, error: capQueryError } = await supabase
      .from("user_capabilities")
      .select("current_level")
      .eq("user_id", userId)
      .eq("role_sequence_id", seqData.id)
      .maybeSingle();

    if (capQueryError) {
      throw new Error(`Failed to query user capabilities: ${capQueryError.message}`);
    }

    if (capData) {
      currentLevelNum = capData.current_level;
    } else {
      // Initialize new user capability
      const { error: capInsertError } = await supabase.from("user_capabilities").insert({
        user_id: userId,
        learning_path_id: learningPathId,
        role_sequence_id: seqData.id,
        current_level: 0,
        required_level: requiredLevelNum,
        gap: requiredLevelNum,
        has_gap: requiredLevelNum > 0,
        gap_score: 0,
        badge: "none",
        updated_at: new Date().toISOString(),
      });

      if (capInsertError) {
        throw new Error(`Failed to insert user capability: ${capInsertError.message}`);
      }
      currentLevelNum = 0;
    }
  }

  const gap = Math.max(0, requiredLevelNum - currentLevelNum);
  const hasGap = gap > 0;
  const gapScore =
    requiredLevelNum > 0 ? Math.round((currentLevelNum / requiredLevelNum) * 100) : 0;

  // Insert new level progress
  const { data: inserted, error: insertError } = await supabase
    .from("user_capability_level_progress")
    .insert({
      user_id: userId,
      learning_path_id: learningPathId,
      level_id: levelId,
      sequence_no: sequenceNo,
      from_level: Math.max(0, sequenceNo - 1),
      to_level: sequenceNo,
      current_score: 0,
      current_level: currentLevelNum,
      required_level: requiredLevelNum,
      gap,
      has_gap: hasGap,
      gap_score: gapScore,
      priority_band: priorityBand,
      status: status,
      badge: "none",
      completion_percentage: 0,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertError) {
    throw new Error(`Failed to insert level progress: ${insertError.message}`);
  }

  // Check and update learning path status to in_progress
  if (status === "in_progress") {
    const { data: pathData } = await supabase
      .from("learning_paths")
      .select("status, started_at")
      .eq("id", learningPathId)
      .maybeSingle();

    if (pathData && pathData.status === "not_started") {
      await supabase
        .from("learning_paths")
        .update({
          status: "in_progress",
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", learningPathId);
    }
  }

  return inserted.id;
}

export async function upsertModuleProgress(
  supabase: SupabaseClient,
  userId: string,
  levelId: string,
  moduleNo: number,
  status: string = "in_progress",
): Promise<string> {
  // Ensure level progress exists
  const levelProgressId = await upsertLevelProgress(supabase, userId, levelId, "in_progress");

  // Fetch module_id
  const { data: moduleData, error: moduleError } = await supabase
    .from("modules")
    .select("id")
    .eq("level_id", levelId)
    .eq("module_no", moduleNo)
    .eq("is_active", true)
    .single();

  if (moduleError || !moduleData) {
    throw new Error(`Module ${moduleNo} for level '${levelId}' not found: ${moduleError?.message}`);
  }

  const moduleId = moduleData.id;

  // Check for existing progress
  const { data: existingProgress, error: fetchError } = await supabase
    .from("user_module_progress")
    .select("id, module_status")
    .eq("user_id", userId)
    .eq("user_capability_level_progress_id", levelProgressId)
    .eq("module_id", moduleId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to query module progress: ${fetchError.message}`);
  }

  if (existingProgress) {
    if (existingProgress.module_status === "not_started" && status === "in_progress") {
      const { error: updateError } = await supabase
        .from("user_module_progress")
        .update({
          module_status: "in_progress",
          last_activity_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingProgress.id);

      if (updateError) {
        throw new Error(`Failed to update module progress status: ${updateError.message}`);
      }
    }
    return existingProgress.id;
  }

  // Insert new module progress
  const { data: inserted, error: insertError } = await supabase
    .from("user_module_progress")
    .insert({
      user_id: userId,
      user_capability_level_progress_id: levelProgressId,
      module_id: moduleId,
      module_status: status,
      current_stage: "engage",
      stages_completed: 0,
      completion_percentage: 0,
      artifact_submitted: false,
      artifact_approval_status: "not_submitted",
      last_activity_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertError) {
    throw new Error(`Failed to insert module progress: ${insertError.message}`);
  }

  return inserted.id;
}

export async function recalculateLevelProgress(
  supabase: SupabaseClient,
  userId: string,
  levelId: string,
): Promise<void> {
  const { data: modules, error: modulesError } = await supabase
    .from("modules")
    .select("id")
    .eq("level_id", levelId)
    .eq("is_active", true);

  if (modulesError) {
    throw new Error(`Failed to fetch modules for level recalculation: ${modulesError.message}`);
  }

  const moduleIds = ((modules ?? []) as Array<{ id: string }>).map((module) => module.id);
  if (moduleIds.length === 0) return;

  const { data: moduleProgressRows, error: moduleProgressError } = await supabase
    .from("user_module_progress")
    .select("module_status, completion_percentage")
    .eq("user_id", userId)
    .in("module_id", moduleIds);

  if (moduleProgressError) {
    throw new Error(
      `Failed to fetch module progress for level recalculation: ${moduleProgressError.message}`,
    );
  }

  const progressRows = (moduleProgressRows ?? []) as Array<{
    module_status: string;
    completion_percentage: number | null;
  }>;
  const progressByModule = progressRows.reduce(
    (sum, progress) => sum + (progress.completion_percentage ?? 0),
    0,
  );
  const completionPercentage = Math.round(progressByModule / moduleIds.length);
  const completedModules = progressRows.filter(
    (progress) =>
      progress.module_status === "completed" ||
      progress.module_status === "mastered" ||
      progress.completion_percentage === 100,
  ).length;
  const isCompleted = completedModules >= moduleIds.length;
  const now = new Date().toISOString();

  // Query previous status
  const { data: currentProgress } = await supabase
    .from("user_capability_level_progress")
    .select("id, status")
    .eq("user_id", userId)
    .eq("level_id", levelId)
    .maybeSingle();

  const wasCompleted = currentProgress?.status === "completed";

  const { error: updateError } = await supabase
    .from("user_capability_level_progress")
    .update({
      status: isCompleted ? "completed" : "in_progress",
      completion_percentage: completionPercentage,
      completed_at: isCompleted ? now : null,
      updated_at: now,
    })
    .eq("user_id", userId)
    .eq("level_id", levelId);

  if (updateError) {
    throw new Error(`Failed to update level progress recalculation: ${updateError.message}`);
  }

  // Trigger readiness recalculation on level completion transition
  if (isCompleted && !wasCompleted && currentProgress?.id) {
    let completeCourseOnTime: typeof import("@functions/lib/xp-engine.progress").completeCourseOnTime;
    let triggerReadinessRecalculation: typeof import("@functions/lib/xp-engine.progress").triggerReadinessRecalculation;
    try {
      const module = await import("@functions/lib/xp-engine.progress");
      completeCourseOnTime = module.completeCourseOnTime;
      triggerReadinessRecalculation = module.triggerReadinessRecalculation;
    } catch (importErr) {
      apiLogger.error("Failed to import xp-engine.progress", importErr);
      throw importErr;
    }

    try {
      const { data: levelData } = await supabase
        .from("levels")
        .select("duration_minutes")
        .eq("id", levelId)
        .single();

      const { data: modProgressRows } = await supabase
        .from("user_module_progress")
        .select("id")
        .eq("user_id", userId)
        .in("module_id", moduleIds);

      const modProgressIds = modProgressRows?.map((r) => r.id) || [];
      let totalTimeSpent = 0;

      if (modProgressIds.length > 0) {
        const { data: stageProgressRows } = await supabase
          .from("user_stage_progress")
          .select("time_spent_seconds")
          .in("user_module_progress_id", modProgressIds);

        totalTimeSpent = (stageProgressRows || []).reduce(
          (sum, r) => sum + (r.time_spent_seconds || 0),
          0,
        );
      }

      if (totalTimeSpent <= (levelData?.duration_minutes || 0) * 60) {
        await completeCourseOnTime(supabase, userId, currentProgress.id, levelId);
      }
    } catch (err) {
      apiLogger.error("Failed to check on-time course completion", err);
    }

    await triggerReadinessRecalculation(supabase, userId).catch(() => null);
  }
}

export async function upsertStageProgress(
  supabase: SupabaseClient,
  userId: string,
  levelId: string,
  moduleNo: number,
  eContentId: string,
  stageName: string,
  status: string = "in_progress",
  durationSeconds: number = 0,
): Promise<{ stageProgressId: string; stagesCompleted: number; completionPercentage: number }> {
  // Ensure module progress exists
  const moduleProgressId = await upsertModuleProgress(
    supabase,
    userId,
    levelId,
    moduleNo,
    "in_progress",
  );

  // Validate stage name and get stage order
  const normalizedStageName = normalizeStageName(stageName);
  const stageOrder = getStageOrder(normalizedStageName);
  if (!stageOrder) {
    throw new Error(`Invalid stage name: ${stageName}`);
  }

  const { data: existingCompletedStages, error: completedStagesError } = await supabase
    .from("user_stage_progress")
    .select("stage_name")
    .eq("user_module_progress_id", moduleProgressId)
    .eq("user_id", userId)
    .eq("status", "completed");

  if (completedStagesError) {
    throw new Error(`Failed to validate stage sequence: ${completedStagesError.message}`);
  }

  assertStageSequenceAllowed(
    normalizedStageName,
    existingCompletedStages?.map((stage) => stage.stage_name) ?? [],
  );

  // Upsert stage progress
  const now = new Date().toISOString();
  const sanitizedDurationSeconds = Math.max(0, Math.floor(durationSeconds));

  const { data: existingProgress } = await supabase
    .from("user_stage_progress")
    .select("id, status, time_spent_seconds")
    .eq("user_module_progress_id", moduleProgressId)
    .eq("user_id", userId)
    .eq("e_content_id", eContentId)
    .eq("stage_name", normalizedStageName)
    .maybeSingle();

  let stageProgressId = "";

  if (existingProgress) {
    stageProgressId = existingProgress.id;
    const updatePayload: Record<string, unknown> = {};
    const isCompletingStage = existingProgress.status !== "completed" && status === "completed";
    const shouldUpdateViewingTouch = status !== "completed" || sanitizedDurationSeconds > 0;

    if (shouldUpdateViewingTouch) {
      updatePayload["last_viewed_at"] = now;
      updatePayload["updated_at"] = now;
    }

    if (sanitizedDurationSeconds > 0) {
      updatePayload["time_spent_seconds"] =
        (existingProgress.time_spent_seconds ?? 0) + sanitizedDurationSeconds;
    }

    // Only transition status if moving to completed
    if (isCompletingStage) {
      updatePayload["status"] = "completed";
      updatePayload["completed_at"] = now;
      updatePayload["updated_at"] = now;
    }

    if (Object.keys(updatePayload).length > 0) {
      const { error: updateError } = await supabase
        .from("user_stage_progress")
        .update(updatePayload)
        .eq("id", existingProgress.id);

      if (updateError) {
        throw new Error(`Failed to update stage progress: ${updateError.message}`);
      }
    }
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from("user_stage_progress")
      .insert({
        user_module_progress_id: moduleProgressId,
        user_id: userId,
        e_content_id: eContentId,
        stage_name: normalizedStageName,
        stage_order: stageOrder,
        status: status,
        started_at: now,
        completed_at: status === "completed" ? now : null,
        time_spent_seconds: sanitizedDurationSeconds,
        last_viewed_at: now,
        updated_at: now,
      })
      .select("id")
      .single();

    if (insertError) {
      throw new Error(`Failed to insert stage progress: ${insertError.message}`);
    }
    stageProgressId = inserted.id;
  }

  // Recalculate module progress completion stats
  const { data: completedItems, error: completedError } = await supabase
    .from("user_stage_progress")
    .select("stage_name")
    .eq("user_module_progress_id", moduleProgressId)
    .eq("status", "completed");

  if (completedError) {
    throw new Error(
      `Failed to fetch completed stages for module recalculation: ${completedError.message}`,
    );
  }

  const completedStagesSet = new Set(
    completedItems?.map((item) => normalizeStageName(item.stage_name)) ?? [],
  );
  const stagesCompleted = completedStagesSet.size;
  const completionPercentage = getStageCompletionPercentage(stagesCompleted);

  // Update user_module_progress
  const { error: modUpdateError } = await supabase
    .from("user_module_progress")
    .update({
      current_stage: normalizedStageName,
      stages_completed: stagesCompleted,
      completion_percentage: completionPercentage,
      last_activity_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", moduleProgressId);

  if (modUpdateError) {
    throw new Error(`Failed to update module progress stats: ${modUpdateError.message}`);
  }

  // If all stages completed, set module status to completed
  if (stagesCompleted === LTE_STAGE_COUNT) {
    const { error: finalModError } = await supabase
      .from("user_module_progress")
      .update({
        module_status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", moduleProgressId);

    if (finalModError) {
      throw new Error(`Failed to finalize module status to completed: ${finalModError.message}`);
    }
  }

  await recalculateLevelProgress(supabase, userId, levelId);

  return {
    stageProgressId,
    stagesCompleted,
    completionPercentage,
  };
}
