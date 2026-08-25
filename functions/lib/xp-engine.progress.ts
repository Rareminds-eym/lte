import { asQueryGateway, type QueryGatewaySource } from "@functions/lib/query-gateway";
import { apiLogger } from "../shared/logger";
import { awardXp } from "./xp-engine.core";
import { evaluateMilestones } from "./xp-engine.engagement";

const readinessLevelProgressReadPolicy = {
  table: "user_capability_level_progress",
  operation: "read",
  columns: ["id", "level_id", "completion_percentage", "status", "started_at"],
  filters: ["user_id", "learning_path_id"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
} as const;

const readinessModuleProgressReadPolicy = {
  table: "user_module_progress",
  operation: "read",
  columns: ["id"],
  filters: ["user_id", "user_capability_level_progress_id"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
} as const;

const readinessStageProgressReadPolicy = {
  table: "user_stage_progress",
  operation: "read",
  columns: ["id"],
  filters: ["user_id", "user_module_progress_id"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
} as const;

const modulesByLevelReadPolicy = {
  table: "modules",
  operation: "read",
  columns: ["id"],
  filters: ["level_id", "is_active"],
} as const;

const levelsXpReadPolicy = {
  table: "levels",
  operation: "read",
  columns: ["total_xp"],
  filters: ["id"],
} as const;

const moduleContentByModuleReadPolicy = {
  table: "modules_content",
  operation: "read",
  columns: ["id"],
  filters: ["module_id", "is_active"],
} as const;

const finalArtifactsByContentReadPolicy = {
  table: "module_artifacts",
  operation: "read",
  columns: ["id"],
  filters: ["modules_content_id", "artifact_type", "is_active"],
} as const;

const readinessArtifactSubmissionsReadPolicy = {
  table: "artifact_submissions",
  operation: "read",
  select: "id, status, artifact_id, module_artifacts ( id, artifact_type )",
  filters: ["user_id", "user_module_progress_id"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
} as const;

const readinessEvaluationFlowsReadPolicy = {
  table: "artifact_evaluation_flows",
  operation: "read",
  columns: ["score"],
  filters: ["submission_id", "is_current_stage"],
} as const;

const readinessEvidenceXpReadPolicy = {
  table: "xp_events",
  operation: "read",
  columns: ["xp_amount", "source_type", "source_id"],
  filters: ["user_id", "xp_category"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
} as const;

const readinessProfileReadPolicy = {
  table: "user_profiles",
  operation: "read",
  columns: ["bio", "job_title", "skills"],
  filters: ["user_id"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
} as const;

const readinessLearningPathReadPolicy = {
  table: "learning_paths",
  operation: "read",
  columns: ["role_id", "role_readiness_percentage", "status", "started_at", "completed_at"],
  filters: ["user_id", "id"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
} as const;

const readinessLearningPathUpdatePolicy = {
  table: "learning_paths",
  operation: "update",
  updateColumns: [
    "role_readiness_percentage",
    "status",
    "started_at",
    "completed_at",
    "updated_at",
  ],
  filters: ["user_id", "id"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
  requireFilter: true,
} as const;

const latestLearningPathsReadPolicy = {
  table: "learning_paths",
  operation: "read",
  columns: ["id"],
  filters: ["user_id", "is_latest"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
} as const;

/**
 * Completes a course sequence. Maps source_id to capability_level_progress.id
 */
export async function completeCourseOnTime(
  source: QueryGatewaySource,
  userId: string,
  levelProgressId: string,
  courseId: string,
): Promise<{ success: boolean; xpAwarded: number }> {
  const xpRes = await awardXp(
    source,
    userId,
    "course_completed_on_time",
    "user_capability_level_progress",
    levelProgressId,
    { course_id: courseId },
  );
  // Trigger readiness recalculation on event
  await triggerReadinessRecalculation(source, userId);
  return { success: true, xpAwarded: xpRes.xpAwarded };
}

/**
 * Completes capability milestones. Maps source_id to user_capabilities.id
 */
export async function completeCapability(
  source: QueryGatewaySource,
  userId: string,
  userCapabilityId: string,
  capabilityId: string,
  isCapstone: boolean,
  configuredXpAmount?: number,
): Promise<{ success: boolean; xpAwarded: number }> {
  const eventType = isCapstone ? "capstone_completed" : "fast_track_capability";

  const xpRes = await awardXp(
    source,
    userId,
    eventType,
    "user_capabilities",
    userCapabilityId,
    { capability_id: capabilityId },
    configuredXpAmount,
  );
  // Trigger readiness recalculation on event
  await triggerReadinessRecalculation(source, userId);
  return { success: true, xpAwarded: xpRes.xpAwarded };
}

// Global cache map to coalesce concurrent readiness calculations for the same user + path
const activeCalculations = new Map<string, Promise<{ readinessScore: number; band: string }>>();

/**
 * Coalescing wrapper for calculateReadinessInternal to enforce transactional event coalescing.
 */
export function calculateReadiness(
  source: QueryGatewaySource,
  userId: string,
  learningPathId: string,
): Promise<{ readinessScore: number; band: string }> {
  const cacheKey = `${userId}:${learningPathId}`;
  const existing = activeCalculations.get(cacheKey);
  if (existing) {
    return existing;
  }

  const promise = (async () => {
    try {
      return await calculateReadinessInternal(source, userId, learningPathId);
    } finally {
      activeCalculations.delete(cacheKey);
    }
  })();

  activeCalculations.set(cacheKey, promise);
  return promise;
}

/**
 * Calculates Readiness metrics using the 30/25/25/10/10 formula.
 * After computing the score, automatically evaluates and awards readiness milestones.
 */
async function calculateReadinessInternal(
  source: QueryGatewaySource,
  userId: string,
  learningPathId: string,
): Promise<{ readinessScore: number; band: string }> {
  const qb = asQueryGateway(source);
  // Query level progress to identify levels associated with this learning path
  const levelProgressRows = (await qb.read(readinessLevelProgressReadPolicy, {
    auth: { userId },
    filters: [{ column: "learning_path_id", op: "eq", value: learningPathId }],
  })) as Array<{
    id: string;
    level_id: string;
    completion_percentage: number | null;
    status: string | null;
    started_at: string | null;
  }> | null;

  const levelProgressIds = levelProgressRows?.map((r) => r.id) || [];
  const levelIds = levelProgressRows?.map((r) => r.level_id) || [];
  let requiredModuleIds: string[] = [];
  let requiredArtifactIds: string[] = [];
  let expectedEvidenceXp = 0;

  let userModuleProgressIds: string[] = [];
  if (levelProgressIds.length > 0) {
    const moduleProgressList = (await qb.read(readinessModuleProgressReadPolicy, {
      auth: { userId },
      filters: [{ column: "user_capability_level_progress_id", op: "in", value: levelProgressIds }],
    })) as Array<{ id: string }> | null;
    if (moduleProgressList) {
      userModuleProgressIds = moduleProgressList.map((m) => m.id);
    }
  }

  let userStageProgressIds: string[] = [];
  if (userModuleProgressIds.length > 0) {
    const stageProgressList = (await qb.read(readinessStageProgressReadPolicy, {
      auth: { userId },
      filters: [{ column: "user_module_progress_id", op: "in", value: userModuleProgressIds }],
    })) as Array<{ id: string }> | null;
    if (stageProgressList) {
      userStageProgressIds = stageProgressList.map((s) => s.id);
    }
  }

  if (levelIds.length > 0) {
    // 1. Fetch required modules for these levels
    const modules = (await qb.read(modulesByLevelReadPolicy, {
      filters: [
        { column: "level_id", op: "in", value: levelIds },
        { column: "is_active", op: "eq", value: true },
      ],
    })) as Array<{ id: string }> | null;
    if (modules) {
      requiredModuleIds = modules.map((m) => m.id);
    }

    // 2. Fetch expected evidence XP from the levels
    const levelsData = (await qb.read(levelsXpReadPolicy, {
      filters: [{ column: "id", op: "in", value: levelIds }],
    })) as Array<{ total_xp: number | null }> | null;
    if (levelsData) {
      expectedEvidenceXp = levelsData.reduce((sum, lvl) => sum + (lvl.total_xp || 0), 0);
    }

    // 3. Fetch required mandatory artifacts for these levels
    if (requiredModuleIds.length > 0) {
      const stages = (await qb.read(moduleContentByModuleReadPolicy, {
        filters: [
          { column: "module_id", op: "in", value: requiredModuleIds },
          { column: "is_active", op: "eq", value: true },
        ],
      })) as Array<{ id: string }> | null;
      const stageIds = stages?.map((s) => s.id) || [];
      if (stageIds.length > 0) {
        const artifacts = (await qb.read(finalArtifactsByContentReadPolicy, {
          filters: [
            { column: "modules_content_id", op: "in", value: stageIds },
            { column: "artifact_type", op: "eq", value: "final" },
            { column: "is_active", op: "eq", value: true },
          ],
        })) as Array<{ id: string }> | null;
        if (artifacts) {
          requiredArtifactIds = artifacts.map((a) => a.id);
        }
      }
    }
  }

  // 1. Course Completion (30%)
  const progressList = levelProgressRows || [];
  const courseCompletion =
    progressList.length > 0
      ? progressList.reduce((sum, r) => sum + (r.completion_percentage || 0), 0) /
        progressList.length
      : 0;

  // 2. Artifact Completion (25%)
  interface ArtifactSubmissionWithArtifact {
    id: string;
    status: string;
    artifact_id: string;
    module_artifacts:
      | {
          id: string;
          artifact_type: string;
        }
      | {
          id: string;
          artifact_type: string;
        }[];
  }

  let artifactSubmissions: ArtifactSubmissionWithArtifact[] = [];
  if (userModuleProgressIds.length > 0) {
    artifactSubmissions = ((await qb.read(readinessArtifactSubmissionsReadPolicy, {
      auth: { userId },
      filters: [{ column: "user_module_progress_id", op: "in", value: userModuleProgressIds }],
    })) || []) as ArtifactSubmissionWithArtifact[];
  }

  const finalSubmissions = (artifactSubmissions || []).filter((s) => {
    const ma =
      Array.isArray(s.module_artifacts) && s.module_artifacts.length > 0
        ? s.module_artifacts[0]
        : (s.module_artifacts as { artifact_type: string } | null);
    return ma?.artifact_type === "final";
  });

  const totalMandatoryArtifacts = requiredArtifactIds.length;
  const acceptedMandatoryArtifacts =
    totalMandatoryArtifacts > 0 && finalSubmissions.length > 0
      ? finalSubmissions.filter((s) => {
          const isAccepted = s.status === "accepted";
          return isAccepted && requiredArtifactIds.includes(s.artifact_id);
        }).length
      : 0;
  const artifactCompletion =
    totalMandatoryArtifacts > 0 ? (acceptedMandatoryArtifacts / totalMandatoryArtifacts) * 100 : 0;

  // 3. AI Authoritative Score (25%)
  const acceptedFinalSubmissions =
    requiredArtifactIds.length > 0 && finalSubmissions.length > 0
      ? finalSubmissions.filter((s) => {
          const isAccepted = s.status === "accepted";
          return isAccepted && requiredArtifactIds.includes(s.artifact_id);
        })
      : [];

  const submissionIds = acceptedFinalSubmissions.map((s) => s.id);
  let aiAverageScore = 0;
  if (submissionIds.length > 0) {
    const flows = ((await qb.read(readinessEvaluationFlowsReadPolicy, {
      filters: [
        { column: "submission_id", op: "in", value: submissionIds },
        { column: "is_current_stage", op: "eq", value: true },
      ],
    })) || []) as Array<{ score: number | null }>;
    const scores = flows.map((f) => f.score).filter((s) => s !== null) as number[];
    if (scores.length > 0) {
      aiAverageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    }
  }

  // 4. XP Achievement (10%)
  const xpData = ((await qb.read(readinessEvidenceXpReadPolicy, {
    auth: { userId },
    filters: [{ column: "xp_category", op: "eq", value: "evidence" }],
  })) || []) as Array<{ xp_amount: number; source_type: string; source_id: string }>;

  const evidenceXpEarned = (xpData || [])
    .filter((item) => {
      if (item.source_type === "user_stage_progress") {
        return userStageProgressIds.includes(item.source_id);
      }
      if (item.source_type === "user_capability_level_progress") {
        return levelProgressIds.includes(item.source_id);
      }
      return false;
    })
    .reduce((sum, item) => sum + item.xp_amount, 0);
  const xpAchievement =
    expectedEvidenceXp > 0 ? Math.min((evidenceXpEarned / expectedEvidenceXp) * 100, 100) : 0;

  // 5. Profile Completion (10%)
  const profile = (await qb.read(readinessProfileReadPolicy, {
    auth: { userId },
    result: "maybeSingle",
  })) as { bio?: string | null; job_title?: string | null; skills?: unknown[] | null } | null;

  let completedFields = 0;
  const totalFields = 3;
  if (profile) {
    if (profile.bio && profile.bio.trim().length > 0) completedFields++;
    if (profile.job_title && profile.job_title.trim().length > 0) completedFields++;
    if (profile.skills && Array.isArray(profile.skills) && profile.skills.length > 0) {
      completedFields++;
    }
  }
  const profileCompletion = (completedFields / totalFields) * 100;

  // 6. Apply weights
  const readinessScore = Math.min(
    Math.round(
      courseCompletion * 0.3 +
        artifactCompletion * 0.25 +
        aiAverageScore * 0.25 +
        xpAchievement * 0.1 +
        profileCompletion * 0.1,
    ),
    100,
  );

  // Determine band
  let band = "Not Ready";
  if (readinessScore >= 80) band = "Job Ready";
  else if (readinessScore >= 60) band = "Internship Ready";
  else if (readinessScore >= 40) band = "Learning in Progress";

  // Update learning path role readiness percentage, status, started_at, completed_at, and updated_at
  const learningPath = (await qb.read(readinessLearningPathReadPolicy, {
    auth: { userId },
    filters: [{ column: "id", op: "eq", value: learningPathId }],
    result: "maybeSingle",
  })) as {
    role_id?: string | null;
    role_readiness_percentage?: number | null;
    status?: string | null;
    started_at?: string | null;
    completed_at?: string | null;
  } | null;

  const currentPercentage = learningPath?.role_readiness_percentage || 0;

  let newStatus = "not_started";
  const hasStartedAnyLevel = (levelProgressRows || []).some(
    (row) => row.status === "in_progress" || row.status === "completed",
  );

  const allLevelsCompleted =
    (levelProgressRows || []).length > 0 &&
    (levelProgressRows || []).every((row) => row.status === "completed");

  if (allLevelsCompleted) {
    newStatus = "completed";
  } else if (hasStartedAnyLevel) {
    newStatus = "in_progress";
  }

  const now = new Date().toISOString();

  // Comply with learning_paths database check constraints:
  // 1. If status is not_started: started_at and completed_at MUST be null.
  // 2. If status is in_progress: started_at MUST be non-null and completed_at MUST be null.
  // 3. If status is completed: both started_at and completed_at MUST be non-null.
  let startedAt: string | null = null;
  let completedAt: string | null = null;

  if (newStatus === "in_progress" || newStatus === "completed") {
    // Find the earliest started_at timestamp from the user's capability level progress rows
    const activeLevelsWithStart = (levelProgressRows || []).filter(
      (row) => (row.status === "in_progress" || row.status === "completed") && row.started_at,
    );

    if (activeLevelsWithStart.length > 0) {
      const dates = activeLevelsWithStart
        .map((row) => (row.started_at ? new Date(row.started_at).getTime() : 0))
        .filter((time) => !Number.isNaN(time) && time > 0);
      if (dates.length > 0) {
        const earliestTime = Math.min(...dates);
        startedAt = new Date(earliestTime).toISOString();
      } else {
        startedAt = learningPath?.started_at ?? now;
      }
    } else {
      startedAt = learningPath?.started_at ?? now;
    }
  }

  if (newStatus === "completed") {
    completedAt = learningPath?.completed_at ?? now;
  }

  await qb.update(readinessLearningPathUpdatePolicy, {
    auth: { userId },
    data: {
      role_readiness_percentage: readinessScore,
      status: newStatus,
      started_at: startedAt,
      completed_at: completedAt,
      updated_at: now,
    },
    filters: [{ column: "id", op: "eq", value: learningPathId }],
  });

  // Auto-evaluate and award readiness milestones after score update
  if (readinessScore > currentPercentage && learningPath?.role_id) {
    try {
      await evaluateMilestones(qb, userId, learningPath.role_id, readinessScore);
    } catch (err) {
      // Non-fatal: milestone evaluation failure should not break readiness calculation
      apiLogger.error("[XP] evaluateMilestones failed", err, {
        userId,
        roleId: learningPath.role_id,
      });
    }
  }

  return { readinessScore, band };
}

/**
 * Triggers readiness recalculation for all active learning paths of the user.
 */
export async function triggerReadinessRecalculation(
  source: QueryGatewaySource,
  userId: string,
): Promise<void> {
  const qb = asQueryGateway(source);
  try {
    const paths = (await qb.read(latestLearningPathsReadPolicy, {
      auth: { userId },
      filters: [{ column: "is_latest", op: "eq", value: true }],
    })) as Array<{ id: string }> | null;

    if (paths && paths.length > 0) {
      await Promise.all(
        paths.map((path) =>
          calculateReadiness(qb, userId, path.id).catch((err) => {
            apiLogger.error(
              "[XP] calculateReadiness failed in triggerReadinessRecalculation",
              err,
              {
                userId,
                pathId: path.id,
              },
            );
            return null;
          }),
        ),
      );
    }
  } catch (err) {
    apiLogger.error("[XP] triggerReadinessRecalculation failed", err, { userId });
  }
}
