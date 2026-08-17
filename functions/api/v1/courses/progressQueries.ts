import {
  asQueryGateway,
  QueryGatewayDatabaseError,
  type QueryGatewaySource,
} from "@functions/lib/query-gateway";
import {
  assertStageSequenceAllowed,
  getStageCompletionPercentage,
  getStageOrder,
  LTE_STAGE_COUNT,
  normalizeStageName,
} from "@functions/lib/stage-sequence";
import { apiLogger } from "@functions/shared/logger";

const levelLookupPolicy = {
  table: "levels",
  operation: "read",
  columns: ["id", "level_code", "capability_id", "duration_minutes"],
  filters: ["id"],
} as const;

const activeLearningTrackPolicy = {
  table: "learning_tracks",
  operation: "read",
  columns: ["id"],
  filters: ["user_id", "is_active"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
} as const;

const learningPathsPolicy = {
  table: "learning_paths",
  operation: "read",
  columns: ["id", "role_id"],
  filters: ["user_id", "learning_track_id"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
  maxPageSize: 100,
} as const;

const roleCapabilityRolesPolicy = {
  table: "role_capability_sequence",
  operation: "read",
  columns: ["role_id"],
  filters: ["role_id", "capability_id"],
  maxPageSize: 100,
} as const;

const levelProgressReadPolicy = {
  table: "user_capability_level_progress",
  operation: "read",
  columns: ["id", "status"],
  filters: ["user_id", "learning_path_id", "level_id"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
} as const;

const levelProgressUpdateStatusPolicy = {
  table: "user_capability_level_progress",
  operation: "update",
  updateColumns: ["status", "started_at", "updated_at"],
  filters: ["id"],
  requireFilter: true,
} as const;

const roleCapabilitySequencePolicy = {
  table: "role_capability_sequence",
  operation: "read",
  columns: ["id", "required_level", "capability_priority"],
  filters: ["role_id", "capability_id"],
} as const;

const userCapabilityReadPolicy = {
  table: "user_capabilities",
  operation: "read",
  columns: ["current_level"],
  filters: ["user_id", "role_sequence_id"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
} as const;

const userCapabilityInsertPolicy = {
  table: "user_capabilities",
  operation: "insert",
  insertColumns: [
    "user_id",
    "learning_path_id",
    "role_sequence_id",
    "current_level",
    "required_level",
    "gap",
    "has_gap",
    "gap_score",
    "badge",
    "updated_at",
  ],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
} as const;

const levelProgressInsertPolicy = {
  table: "user_capability_level_progress",
  operation: "insert",
  insertColumns: [
    "user_id",
    "learning_path_id",
    "level_id",
    "sequence_no",
    "from_level",
    "to_level",
    "current_score",
    "current_level",
    "required_level",
    "gap",
    "has_gap",
    "gap_score",
    "priority_band",
    "status",
    "badge",
    "completion_percentage",
    "started_at",
    "updated_at",
  ],
  returningColumns: ["id"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
} as const;

const activeModuleLookupPolicy = {
  table: "modules",
  operation: "read",
  columns: ["id"],
  filters: ["level_id", "module_no", "is_active"],
} as const;

const modulesForLevelPolicy = {
  table: "modules",
  operation: "read",
  columns: ["id"],
  filters: ["level_id", "is_active"],
  maxPageSize: 100,
} as const;

const moduleProgressReadPolicy = {
  table: "user_module_progress",
  operation: "read",
  columns: ["id", "module_status", "completion_percentage"],
  filters: ["user_id", "user_capability_level_progress_id", "module_id"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
  maxPageSize: 500,
} as const;

const stageProgressTimeSpentReadPolicy = {
  table: "user_stage_progress",
  operation: "read",
  columns: ["time_spent_seconds"],
  filters: ["user_module_progress_id"],
  maxPageSize: 500,
} as const;

const moduleProgressUpdateStatusPolicy = {
  table: "user_module_progress",
  operation: "update",
  updateColumns: [
    "module_status",
    "current_stage",
    "stages_completed",
    "completion_percentage",
    "last_activity_at",
    "updated_at",
  ],
  filters: ["id"],
  requireFilter: true,
} as const;

const moduleProgressUpsertPolicy = {
  table: "user_module_progress",
  operation: "upsert",
  upsertColumns: [
    "user_id",
    "user_capability_level_progress_id",
    "module_id",
    "module_status",
    "current_stage",
    "stages_completed",
    "completion_percentage",
    "artifact_submitted",
    "artifact_approval_status",
    "last_activity_at",
    "updated_at",
  ],
  onConflict: "user_id,user_capability_level_progress_id,module_id",
  returningColumns: ["id"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
} as const;

const levelProgressRecalcReadPolicy = {
  table: "user_capability_level_progress",
  operation: "read",
  columns: ["id", "status"],
  filters: ["user_id", "level_id"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
} as const;

const levelProgressRecalcUpdatePolicy = {
  table: "user_capability_level_progress",
  operation: "update",
  updateColumns: ["status", "completion_percentage", "completed_at", "updated_at"],
  filters: ["user_id", "level_id"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
  requireFilter: true,
} as const;

const completedStageNamesPolicy = {
  table: "user_stage_progress",
  operation: "read",
  columns: ["stage_name"],
  filters: ["user_id", "user_module_progress_id", "status"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
  maxPageSize: 100,
} as const;

const stageProgressReadPolicy = {
  table: "user_stage_progress",
  operation: "read",
  columns: ["id", "status", "time_spent_seconds"],
  filters: ["user_id", "user_module_progress_id", "e_content_id", "stage_name"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
} as const;

const stageProgressUpdatePolicy = {
  table: "user_stage_progress",
  operation: "update",
  updateColumns: ["last_viewed_at", "updated_at", "time_spent_seconds", "status", "completed_at"],
  filters: ["id"],
  requireFilter: true,
} as const;

const stageProgressInsertPolicy = {
  table: "user_stage_progress",
  operation: "insert",
  insertColumns: [
    "user_module_progress_id",
    "user_id",
    "e_content_id",
    "stage_name",
    "stage_order",
    "status",
    "started_at",
    "completed_at",
    "time_spent_seconds",
    "last_viewed_at",
    "updated_at",
  ],
  returningColumns: ["id"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
} as const;

function databaseErrorMessage(error: unknown): string | null {
  return error instanceof QueryGatewayDatabaseError ? error.message : null;
}

interface RoleCapabilitySequenceRow {
  id: string;
  required_level: string | null;
  capability_priority: string | null;
}

export async function upsertLevelProgress(
  source: QueryGatewaySource,
  userId: string,
  levelId: string,
  status: string = "in_progress",
): Promise<string> {
  const qb = asQueryGateway(source);

  // Fetch level details to extract level number and capability
  let levelData: { id: string; level_code: string; capability_id: string } | null = null;
  try {
    levelData = (await qb.read(levelLookupPolicy, {
      filters: [{ column: "id", op: "eq", value: levelId }],
      result: "single",
    })) as { id: string; level_code: string; capability_id: string } | null;
  } catch (error) {
    throw new Error(`Level with id '${levelId}' not found: ${databaseErrorMessage(error) ?? ""}`);
  }
  if (!levelData) {
    throw new Error(`Level with id '${levelId}' not found`);
  }

  const levelCodeMatch = levelData.level_code.match(/L(\d+)/i);
  const sequenceNo = parseInt(levelCodeMatch?.[1] ?? "1", 10);
  const capabilityId = levelData.capability_id;

  // Fetch active learning track
  let trackData: { id: string } | null = null;
  try {
    trackData = (await qb.read(activeLearningTrackPolicy, {
      auth: { userId },
      filters: [{ column: "is_active", op: "eq", value: true }],
      result: "maybeSingle",
    })) as { id: string } | null;
  } catch (error) {
    throw new Error(`Failed to query active learning path: ${databaseErrorMessage(error)}`);
  }
  if (!trackData) {
    throw new Error("No active learning path found for this user");
  }

  // Fetch learning paths under active track
  let pathsData: Array<{ id: string; role_id: string }> | null = null;
  try {
    pathsData = (await qb.read(learningPathsPolicy, {
      auth: { userId },
      filters: [{ column: "learning_track_id", op: "eq", value: trackData.id }],
    })) as Array<{ id: string; role_id: string }> | null;
  } catch (error) {
    throw new Error(`Failed to query active learning path: ${databaseErrorMessage(error)}`);
  }
  if (!pathsData || pathsData.length === 0) {
    throw new Error("No active learning path found for this user");
  }

  // Fetch role capability sequence to match the capability to the correct role
  const roleIds = pathsData.map((p) => p.role_id);
  let seqRoleData: Array<{ role_id: string }> | null = null;
  try {
    seqRoleData = (await qb.read(roleCapabilityRolesPolicy, {
      filters: [
        { column: "role_id", op: "in", value: roleIds },
        { column: "capability_id", op: "eq", value: capabilityId },
      ],
    })) as Array<{ role_id: string }> | null;
  } catch (error) {
    throw new Error(`Failed to query active learning path: ${databaseErrorMessage(error)}`);
  }

  const matchingRoleId = seqRoleData && seqRoleData.length > 0 ? seqRoleData[0]?.role_id : null;
  const activePath = pathsData.find((p) => p.role_id === matchingRoleId) ?? pathsData[0];

  if (!activePath) {
    throw new Error("No active learning path found for this user");
  }

  const learningPathId = activePath.id;
  const roleId = activePath.role_id;

  // Check for existing progress
  let existingProgress: { id: string; status: string } | null = null;
  try {
    existingProgress = (await qb.read(levelProgressReadPolicy, {
      auth: { userId },
      filters: [
        { column: "learning_path_id", op: "eq", value: learningPathId },
        { column: "level_id", op: "eq", value: levelId },
      ],
      result: "maybeSingle",
    })) as { id: string; status: string } | null;
  } catch (error) {
    throw new Error(`Failed to query level progress: ${databaseErrorMessage(error)}`);
  }

  if (existingProgress) {
    if (existingProgress.status === "not_started" && status === "in_progress") {
      try {
        await qb.update(levelProgressUpdateStatusPolicy, {
          data: {
            status: "in_progress",
            started_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          filters: [{ column: "id", op: "eq", value: existingProgress.id }],
        });
      } catch (error) {
        throw new Error(`Failed to update level progress status: ${databaseErrorMessage(error)}`);
      }
    }
    return existingProgress.id;
  }

  // Fetch capability priority, current level, and required level for computations
  let seqData: RoleCapabilitySequenceRow | null = null;

  let priorityBand = "none";
  let requiredLevelNum = 1;
  let currentLevelNum = 0;

  try {
    const sequenceRow = await qb.read(roleCapabilitySequencePolicy, {
      filters: [
        { column: "role_id", op: "eq", value: roleId },
        { column: "capability_id", op: "eq", value: capabilityId },
      ],
      result: "maybeSingle",
    });
    seqData = sequenceRow as RoleCapabilitySequenceRow | null;
  } catch (error) {
    throw new Error(`Failed to query role capability sequence: ${databaseErrorMessage(error)}`);
  }

  if (seqData) {
    priorityBand = seqData.capability_priority ?? "none";
    const levelMap: Record<string, number> = { L1: 1, L2: 2, L3: 3, L4: 4, L5: 5 };
    requiredLevelNum = levelMap[seqData.required_level as string] || 1;

    // Fetch current capability level
    let capData: { current_level: number } | null = null;
    try {
      capData = (await qb.read(userCapabilityReadPolicy, {
        auth: { userId },
        filters: [{ column: "role_sequence_id", op: "eq", value: seqData.id }],
        result: "maybeSingle",
      })) as { current_level: number } | null;
    } catch (error) {
      throw new Error(`Failed to query user capabilities: ${databaseErrorMessage(error)}`);
    }

    if (capData) {
      currentLevelNum = capData.current_level;
    } else {
      // Initialize new user capability
      try {
        await qb.insert(
          userCapabilityInsertPolicy,
          {
            learning_path_id: learningPathId,
            role_sequence_id: seqData.id,
            current_level: 0,
            required_level: requiredLevelNum,
            gap: requiredLevelNum,
            has_gap: requiredLevelNum > 0,
            gap_score: 0,
            badge: "none",
            updated_at: new Date().toISOString(),
          },
          {
            auth: { userId },
          },
        );
      } catch (error) {
        throw new Error(`Failed to insert user capability: ${databaseErrorMessage(error)}`);
      }
      currentLevelNum = 0;
    }
  }

  const gap = Math.max(0, requiredLevelNum - currentLevelNum);
  const hasGap = gap > 0;
  const gapScore =
    requiredLevelNum > 0 ? Math.round((currentLevelNum / requiredLevelNum) * 100) : 0;

  // Insert new level progress
  try {
    const inserted = (await qb.insert(
      levelProgressInsertPolicy,
      {
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
      },
      {
        auth: { userId },
        result: "single",
      },
    )) as { id: string };
    return inserted.id;
  } catch (error) {
    throw new Error(`Failed to insert level progress: ${databaseErrorMessage(error)}`);
  }
}

export async function upsertModuleProgress(
  source: QueryGatewaySource,
  userId: string,
  levelId: string,
  moduleNo: number,
  status: string = "in_progress",
): Promise<string> {
  const qb = asQueryGateway(source);

  // Ensure level progress exists
  const levelProgressId = await upsertLevelProgress(qb, userId, levelId, "in_progress");

  // Fetch module_id
  let moduleData: { id: string } | null = null;
  try {
    moduleData = (await qb.read(activeModuleLookupPolicy, {
      filters: [
        { column: "level_id", op: "eq", value: levelId },
        { column: "module_no", op: "eq", value: moduleNo },
        { column: "is_active", op: "eq", value: true },
      ],
      result: "single",
    })) as { id: string } | null;
  } catch (error) {
    throw new Error(
      `Module ${moduleNo} for level '${levelId}' not found: ${databaseErrorMessage(error) ?? ""}`,
    );
  }
  if (!moduleData) {
    throw new Error(`Module ${moduleNo} for level '${levelId}' not found`);
  }

  const moduleId = moduleData.id;

  // Check for existing progress
  let existingProgress: { id: string; module_status: string } | null = null;
  try {
    existingProgress = (await qb.read(moduleProgressReadPolicy, {
      auth: { userId },
      filters: [
        { column: "user_capability_level_progress_id", op: "eq", value: levelProgressId },
        { column: "module_id", op: "eq", value: moduleId },
      ],
      result: "maybeSingle",
    })) as { id: string; module_status: string } | null;
  } catch (error) {
    throw new Error(`Failed to query module progress: ${databaseErrorMessage(error)}`);
  }

  if (existingProgress) {
    if (existingProgress.module_status === "not_started" && status === "in_progress") {
      try {
        await qb.update(moduleProgressUpdateStatusPolicy, {
          data: {
            module_status: "in_progress",
            last_activity_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          filters: [{ column: "id", op: "eq", value: existingProgress.id }],
        });
      } catch (error) {
        throw new Error(`Failed to update module progress status: ${databaseErrorMessage(error)}`);
      }
    }
    return existingProgress.id;
  }

  // Insert new module progress, or return the existing row if a concurrent request created it.
  try {
    const inserted = (await qb.upsert(
      moduleProgressUpsertPolicy,
      {
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
      },
      {
        auth: { userId },
        result: "single",
      },
    )) as { id: string };
    return inserted.id;
  } catch (error) {
    throw new Error(`Failed to upsert module progress: ${databaseErrorMessage(error)}`);
  }
}

export async function recalculateLevelProgress(
  source: QueryGatewaySource,
  userId: string,
  levelId: string,
): Promise<void> {
  const qb = asQueryGateway(source);

  let modules: Array<{ id: string }> | null = null;
  try {
    modules = (await qb.read(modulesForLevelPolicy, {
      filters: [
        { column: "level_id", op: "eq", value: levelId },
        { column: "is_active", op: "eq", value: true },
      ],
    })) as Array<{ id: string }> | null;
  } catch (error) {
    throw new Error(
      `Failed to fetch modules for level recalculation: ${databaseErrorMessage(error)}`,
    );
  }

  const moduleIds = ((modules ?? []) as Array<{ id: string }>).map((module) => module.id);
  if (moduleIds.length === 0) return;

  let moduleProgressRows: Array<{
    module_status: string;
    completion_percentage: number | null;
  }> | null = null;
  try {
    moduleProgressRows = (await qb.read(moduleProgressReadPolicy, {
      auth: { userId },
      filters: [{ column: "module_id", op: "in", value: moduleIds }],
    })) as Array<{ module_status: string; completion_percentage: number | null }> | null;
  } catch (error) {
    throw new Error(
      `Failed to fetch module progress for level recalculation: ${databaseErrorMessage(error)}`,
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
  const currentProgress = (await qb.read(levelProgressRecalcReadPolicy, {
    auth: { userId },
    filters: [{ column: "level_id", op: "eq", value: levelId }],
    result: "maybeSingle",
  })) as { id: string; status: string } | null;

  const wasCompleted = currentProgress?.status === "completed";

  try {
    await qb.update(levelProgressRecalcUpdatePolicy, {
      auth: { userId },
      data: {
        status: isCompleted ? "completed" : "in_progress",
        completion_percentage: completionPercentage,
        completed_at: isCompleted ? now : null,
        updated_at: now,
      },
      filters: [{ column: "level_id", op: "eq", value: levelId }],
    });
  } catch (error) {
    throw new Error(
      `Failed to update level progress recalculation: ${databaseErrorMessage(error)}`,
    );
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
      const levelData = (await qb.read(levelLookupPolicy, {
        filters: [{ column: "id", op: "eq", value: levelId }],
        result: "single",
      })) as { duration_minutes?: number | null } | null;

      const modProgressRows = (await qb.read(moduleProgressReadPolicy, {
        auth: { userId },
        filters: [{ column: "module_id", op: "in", value: moduleIds }],
      })) as Array<{ id: string }> | null;

      const modProgressIds = modProgressRows?.map((r) => r.id) || [];
      let totalTimeSpent = 0;

      if (modProgressIds.length > 0) {
        const stageProgressRows = (await qb.read(stageProgressTimeSpentReadPolicy, {
          filters: [{ column: "user_module_progress_id", op: "in", value: modProgressIds }],
        })) as Array<{ time_spent_seconds: number | null }> | null;

        totalTimeSpent = (stageProgressRows || []).reduce(
          (sum, r) => sum + (r.time_spent_seconds || 0),
          0,
        );
      }

      if (totalTimeSpent <= (levelData?.duration_minutes || 0) * 60) {
        await completeCourseOnTime(qb, userId, currentProgress.id, levelId);
      }
    } catch (err) {
      apiLogger.error("Failed to check on-time course completion", err);
    }

    await triggerReadinessRecalculation(qb, userId).catch(() => null);
  }
}

export async function upsertStageProgress(
  source: QueryGatewaySource,
  userId: string,
  levelId: string,
  moduleNo: number,
  eContentId: string,
  stageName: string,
  status: string = "in_progress",
  durationSeconds: number = 0,
): Promise<{ stageProgressId: string; stagesCompleted: number; completionPercentage: number }> {
  const qb = asQueryGateway(source);

  // Ensure module progress exists
  const moduleProgressId = await upsertModuleProgress(qb, userId, levelId, moduleNo, "in_progress");

  // Validate stage name and get stage order
  const normalizedStageName = normalizeStageName(stageName);
  const stageOrder = getStageOrder(normalizedStageName);
  if (!stageOrder) {
    throw new Error(`Invalid stage name: ${stageName}`);
  }

  let existingCompletedStages: Array<{ stage_name: string }> | null = null;
  try {
    existingCompletedStages = (await qb.read(completedStageNamesPolicy, {
      auth: { userId },
      filters: [
        { column: "user_module_progress_id", op: "eq", value: moduleProgressId },
        { column: "status", op: "eq", value: "completed" },
      ],
    })) as Array<{ stage_name: string }> | null;
  } catch (error) {
    throw new Error(`Failed to validate stage sequence: ${databaseErrorMessage(error)}`);
  }

  assertStageSequenceAllowed(
    normalizedStageName,
    existingCompletedStages?.map((stage) => stage.stage_name) ?? [],
  );

  // Upsert stage progress
  const now = new Date().toISOString();
  const sanitizedDurationSeconds = Math.max(0, Math.floor(durationSeconds));

  const existingProgress = (await qb.read(stageProgressReadPolicy, {
    auth: { userId },
    filters: [
      { column: "user_module_progress_id", op: "eq", value: moduleProgressId },
      { column: "e_content_id", op: "eq", value: eContentId },
      { column: "stage_name", op: "eq", value: normalizedStageName },
    ],
    result: "maybeSingle",
  })) as { id: string; status: string; time_spent_seconds: number | null } | null;

  let stageProgressId = "";

  if (existingProgress) {
    stageProgressId = existingProgress.id;
    const updatePayload: {
      last_viewed_at?: string;
      updated_at?: string;
      time_spent_seconds?: number;
      status?: string;
      completed_at?: string;
    } = {};
    const isCompletingStage = existingProgress.status !== "completed" && status === "completed";
    const shouldUpdateViewingTouch = status !== "completed" || sanitizedDurationSeconds > 0;

    if (shouldUpdateViewingTouch) {
      updatePayload.last_viewed_at = now;
      updatePayload.updated_at = now;
    }

    if (sanitizedDurationSeconds > 0) {
      updatePayload.time_spent_seconds =
        (existingProgress.time_spent_seconds ?? 0) + sanitizedDurationSeconds;
    }

    // Only transition status if moving to completed
    if (isCompletingStage) {
      updatePayload.status = "completed";
      updatePayload.completed_at = now;
      updatePayload.updated_at = now;
    }

    if (Object.keys(updatePayload).length > 0) {
      try {
        await qb.update(stageProgressUpdatePolicy, {
          data: updatePayload,
          filters: [{ column: "id", op: "eq", value: existingProgress.id }],
        });
      } catch (error) {
        throw new Error(`Failed to update stage progress: ${databaseErrorMessage(error)}`);
      }
    }
  } else {
    try {
      const inserted = (await qb.insert(
        stageProgressInsertPolicy,
        {
          user_module_progress_id: moduleProgressId,
          e_content_id: eContentId,
          stage_name: normalizedStageName,
          stage_order: stageOrder,
          status: status,
          started_at: now,
          completed_at: status === "completed" ? now : null,
          time_spent_seconds: sanitizedDurationSeconds,
          last_viewed_at: now,
          updated_at: now,
        },
        {
          auth: { userId },
          result: "single",
        },
      )) as { id: string };
      stageProgressId = inserted.id;
    } catch (error) {
      throw new Error(`Failed to insert stage progress: ${databaseErrorMessage(error)}`);
    }
  }

  // Recalculate module progress completion stats
  let completedItems: Array<{ stage_name: string }> | null = null;
  try {
    completedItems = (await qb.read(completedStageNamesPolicy, {
      auth: { userId },
      filters: [
        { column: "user_module_progress_id", op: "eq", value: moduleProgressId },
        { column: "status", op: "eq", value: "completed" },
      ],
    })) as Array<{ stage_name: string }> | null;
  } catch (error) {
    throw new Error(
      `Failed to fetch completed stages for module recalculation: ${databaseErrorMessage(error)}`,
    );
  }

  const completedStagesSet = new Set(
    completedItems?.map((item) => normalizeStageName(item.stage_name)) ?? [],
  );
  const stagesCompleted = completedStagesSet.size;
  const completionPercentage = getStageCompletionPercentage(stagesCompleted);

  // Update user_module_progress
  try {
    await qb.update(moduleProgressUpdateStatusPolicy, {
      data: {
        current_stage: normalizedStageName,
        stages_completed: stagesCompleted,
        completion_percentage: completionPercentage,
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      filters: [{ column: "id", op: "eq", value: moduleProgressId }],
    });
  } catch (error) {
    throw new Error(`Failed to update module progress stats: ${databaseErrorMessage(error)}`);
  }

  // If all stages completed, set module status to completed
  if (stagesCompleted === LTE_STAGE_COUNT) {
    try {
      await qb.update(moduleProgressUpdateStatusPolicy, {
        data: {
          module_status: "completed",
          updated_at: new Date().toISOString(),
        },
        filters: [{ column: "id", op: "eq", value: moduleProgressId }],
      });
    } catch (error) {
      throw new Error(
        `Failed to finalize module status to completed: ${databaseErrorMessage(error)}`,
      );
    }
  }

  await recalculateLevelProgress(qb, userId, levelId);

  return {
    stageProgressId,
    stagesCompleted,
    completionPercentage,
  };
}
