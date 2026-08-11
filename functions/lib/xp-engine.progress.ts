import type { SupabaseClient } from "@supabase/supabase-js";
import { apiLogger } from "../shared/logger";
import { awardXp } from "./xp-engine.core";
import { evaluateMilestones } from "./xp-engine.engagement";

/**
 * Completes a course sequence. Maps source_id to capability_level_progress.id
 */
export async function completeCourseOnTime(
  supabase: SupabaseClient,
  userId: string,
  levelProgressId: string,
  courseId: string,
): Promise<{ success: boolean; xpAwarded: number }> {
  const xpRes = await awardXp(
    supabase,
    userId,
    "course_completed_on_time",
    "user_capability_level_progress",
    levelProgressId,
    { course_id: courseId },
  );
  // Trigger readiness recalculation on event
  await triggerReadinessRecalculation(supabase, userId);
  return { success: true, xpAwarded: xpRes.xpAwarded };
}

/**
 * Completes capability milestones. Maps source_id to user_capabilities.id
 */
export async function completeCapability(
  supabase: SupabaseClient,
  userId: string,
  userCapabilityId: string,
  capabilityId: string,
  isCapstone: boolean,
  configuredXpAmount?: number,
): Promise<{ success: boolean; xpAwarded: number }> {
  const eventType = isCapstone ? "capstone_completed" : "fast_track_capability";

  const xpRes = await awardXp(
    supabase,
    userId,
    eventType,
    "user_capabilities",
    userCapabilityId,
    { capability_id: capabilityId },
    configuredXpAmount,
  );
  // Trigger readiness recalculation on event
  await triggerReadinessRecalculation(supabase, userId);
  return { success: true, xpAwarded: xpRes.xpAwarded };
}

// Global cache map to coalesce concurrent readiness calculations for the same user + path
const activeCalculations = new Map<string, Promise<{ readinessScore: number; band: string }>>();

/**
 * Coalescing wrapper for calculateReadinessInternal to enforce transactional event coalescing.
 */
export function calculateReadiness(
  supabase: SupabaseClient,
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
      return await calculateReadinessInternal(supabase, userId, learningPathId);
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
  supabase: SupabaseClient,
  userId: string,
  learningPathId: string,
): Promise<{ readinessScore: number; band: string }> {
  // Query level progress to identify levels associated with this learning path
  const { data: levelProgressRows, error: levelProgressErr } = await supabase
    .from("user_capability_level_progress")
    .select("id, level_id, completion_percentage, status, started_at")
    .eq("learning_path_id", learningPathId);

  if (levelProgressErr) throw levelProgressErr;

  const levelProgressIds = levelProgressRows?.map((r) => r.id) || [];
  const levelIds = levelProgressRows?.map((r) => r.level_id) || [];
  let requiredModuleIds: string[] = [];
  let requiredArtifactIds: string[] = [];
  let expectedEvidenceXp = 0;

  let userModuleProgressIds: string[] = [];
  if (levelProgressIds.length > 0) {
    const { data: moduleProgressList, error: modulesErr } = await supabase
      .from("user_module_progress")
      .select("id")
      .in("user_capability_level_progress_id", levelProgressIds);
    if (modulesErr) throw modulesErr;
    if (moduleProgressList) {
      userModuleProgressIds = moduleProgressList.map((m) => m.id);
    }
  }

  let userStageProgressIds: string[] = [];
  if (userModuleProgressIds.length > 0) {
    const { data: stageProgressList, error: stageProgressErr } = await supabase
      .from("user_stage_progress")
      .select("id")
      .in("user_module_progress_id", userModuleProgressIds);
    if (stageProgressErr) throw stageProgressErr;
    if (stageProgressList) {
      userStageProgressIds = stageProgressList.map((s) => s.id);
    }
  }

  if (levelIds.length > 0) {
    // 1. Fetch required modules for these levels
    const { data: modules, error: modulesLookupErr } = await supabase
      .from("modules")
      .select("id")
      .in("level_id", levelIds)
      .eq("is_active", true);

    if (modulesLookupErr) throw modulesLookupErr;
    if (modules) {
      requiredModuleIds = modules.map((m) => m.id);
    }

    // 2. Fetch expected evidence XP from the levels
    const { data: levelsData, error: levelsErr } = await supabase
      .from("levels")
      .select("total_xp")
      .in("id", levelIds);

    if (levelsErr) throw levelsErr;
    if (levelsData) {
      expectedEvidenceXp = levelsData.reduce((sum, lvl) => sum + (lvl.total_xp || 0), 0);
    }

    // 3. Fetch required mandatory artifacts for these levels
    if (requiredModuleIds.length > 0) {
      const { data: stages, error: stagesErr } = await supabase
        .from("modules_content")
        .select("id")
        .in("module_id", requiredModuleIds)
        .eq("is_active", true);

      if (stagesErr) throw stagesErr;
      const stageIds = stages?.map((s) => s.id) || [];
      if (stageIds.length > 0) {
        const { data: artifacts, error: artifactsErr } = await supabase
          .from("module_artifacts")
          .select("id")
          .in("modules_content_id", stageIds)
          .eq("artifact_type", "final")
          .eq("is_active", true);

        if (artifactsErr) throw artifactsErr;
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
    const { data, error: subErr } = await supabase
      .from("artifact_submissions")
      .select("id, status, artifact_id, module_artifacts ( id, artifact_type )")
      .eq("user_id", userId)
      .in("user_module_progress_id", userModuleProgressIds);

    if (subErr) throw subErr;
    artifactSubmissions = (data || []) as ArtifactSubmissionWithArtifact[];
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
    const { data: flows, error: flowsErr } = await supabase
      .from("artifact_evaluation_flows")
      .select("score")
      .in("submission_id", submissionIds)
      .eq("is_current_stage", true);

    if (flowsErr) throw flowsErr;
    const scores = flows.map((f) => f.score).filter((s) => s !== null) as number[];
    if (scores.length > 0) {
      aiAverageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    }
  }

  // 4. XP Achievement (10%)
  const { data: xpData, error: xpErr } = await supabase
    .from("xp_events")
    .select("xp_amount, source_type, source_id")
    .eq("user_id", userId)
    .eq("xp_category", "evidence");

  if (xpErr) throw xpErr;

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
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("bio, job_title, skills")
    .eq("user_id", userId)
    .maybeSingle();

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
  const { data: learningPath } = await supabase
    .from("learning_paths")
    .select("role_id, role_readiness_percentage, status, started_at, completed_at")
    .eq("id", learningPathId)
    .maybeSingle();

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

  await supabase
    .from("learning_paths")
    .update({
      role_readiness_percentage: readinessScore,
      status: newStatus,
      started_at: startedAt,
      completed_at: completedAt,
      updated_at: now,
    })
    .eq("id", learningPathId);

  // Auto-evaluate and award readiness milestones after score update
  if (readinessScore > currentPercentage && learningPath?.role_id) {
    try {
      await evaluateMilestones(supabase, userId, learningPath.role_id, readinessScore);
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
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  try {
    const { data: paths } = await supabase
      .from("learning_paths")
      .select("id")
      .eq("user_id", userId)
      .eq("is_latest", true);

    if (paths && paths.length > 0) {
      await Promise.all(
        paths.map((path) =>
          calculateReadiness(supabase, userId, path.id).catch((err) => {
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
