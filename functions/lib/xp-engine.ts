import type { SupabaseClient } from "@supabase/supabase-js";
import { apiLogger } from "./logger";
import {
  assertStageSequenceAllowed,
  getStageCompletionPercentage,
  LTE_STAGE_COUNT,
} from "./stage-sequence";

// Event to XP amount mapping (TRD-DB-007 enum values)
export const XP_AMOUNTS: Record<string, number> = {
  stage_completed: 1,
  practice_artifact_accepted: 2,
  practice_artifact_failed: 1,
  final_artifact_accepted_1: 20,
  final_artifact_accepted_2: 15,
  final_artifact_accepted_3: 10,
  final_artifact_failed: 1, // +1 per attempt
  manual_eval_accepted: 5, // fallback evaluation pass / manual reviewer accept
  fallback_eval_failed: 1,
  course_completed_on_time: 10,
  fast_track_capability: 15,
  capstone_completed: 0, // Configured/Passed custom
  daily_login: 1,
  profile_completed: 50,
  streak_7_day: 5,
  consistency_30_day: 30,
  readiness_milestone_25: 10,
  readiness_milestone_50: 20,
  readiness_milestone_75: 30,
  readiness_milestone_100: 100,
  legacy_consistency_bonus: 20,
  promotional_xp: 0, // Custom/Configured
};

// Event to category mapping (TRD-DB-007)
export const XP_CATEGORIES: Record<string, "evidence" | "engagement"> = {
  stage_completed: "evidence",
  practice_artifact_accepted: "evidence",
  practice_artifact_failed: "evidence",
  final_artifact_accepted_1: "evidence",
  final_artifact_accepted_2: "evidence",
  final_artifact_accepted_3: "evidence",
  final_artifact_failed: "evidence",
  manual_eval_accepted: "evidence", // Enforce Evidence-bearing for readiness count alignment
  fallback_eval_failed: "evidence",
  course_completed_on_time: "evidence",
  fast_track_capability: "evidence",
  capstone_completed: "evidence",
  daily_login: "engagement",
  profile_completed: "engagement",
  streak_7_day: "engagement",
  consistency_30_day: "engagement",
  readiness_milestone_25: "engagement",
  readiness_milestone_50: "engagement",
  readiness_milestone_75: "engagement",
  readiness_milestone_100: "engagement",
  legacy_consistency_bonus: "engagement",
  promotional_xp: "engagement",
};

/**
 * Generate standard idempotency key for XP events (TRD §10)
 */
export function generateIdempotencyKey(
  userId: string,
  eventType: string,
  sourceId: string,
): string {
  switch (eventType) {
    case "stage_completed":
      return `stage:${userId}:${sourceId}`;
    case "practice_artifact_accepted":
      return `practice:${userId}:${sourceId}`;
    case "practice_artifact_failed":
      return `practice_fail:${userId}:${sourceId}`;
    case "final_artifact_accepted_1":
    case "final_artifact_accepted_2":
    case "final_artifact_accepted_3":
      return `final:${userId}:${sourceId}`;
    case "final_artifact_failed":
      return `final_fail:${userId}:${sourceId}`;
    case "manual_eval_accepted":
      return `manual:${userId}:${sourceId}`;
    case "fallback_eval_failed":
      return `fallback_fail:${userId}:${sourceId}`;
    case "course_completed_on_time":
      return `course:${userId}:${sourceId}`;
    case "fast_track_capability":
      return `fasttrack:${userId}:${sourceId}`;
    case "capstone_completed":
      return `capstone:${userId}:${sourceId}`;
    case "daily_login":
      return `login:${userId}:${sourceId}`;
    case "profile_completed":
      return `profile:${userId}`;
    case "streak_7_day":
      return `streak7:${userId}:${sourceId}`;
    case "consistency_30_day":
      return `consistency30:${userId}:${sourceId}`;
    case "readiness_milestone_25":
      return `milestone25:${userId}:${sourceId}`;
    case "readiness_milestone_50":
      return `milestone50:${userId}:${sourceId}`;
    case "readiness_milestone_75":
      return `milestone75:${userId}:${sourceId}`;
    case "readiness_milestone_100":
      return `milestone100:${userId}:${sourceId}`;
    case "legacy_consistency_bonus":
      return `legacy_bonus:${userId}`;
    case "promotional_xp":
      return `promo:${userId}:${sourceId}`;
    default:
      return `generic:${userId}:${eventType}:${sourceId}`;
  }
}

/**
 * Core XP Awarding logic. Enforces category, unique idempotency key,
 * and records database events securely.
 */
export async function awardXp(
  supabase: SupabaseClient,
  userId: string,
  eventType: string,
  sourceType: string,
  sourceId: string,
  metadata: Record<string, unknown> = {},
  customXpAmount?: number,
): Promise<{ success: boolean; xpAwarded: number; alreadyAwarded: boolean }> {
  const xpAmount = customXpAmount !== undefined ? customXpAmount : (XP_AMOUNTS[eventType] ?? 0);
  const xpCategory = XP_CATEGORIES[eventType] ?? "engagement";
  const idempotencyKey = generateIdempotencyKey(userId, eventType, sourceId);

  try {
    const { error } = await supabase.from("xp_events").insert({
      user_id: userId,
      event_type: eventType,
      xp_category: xpCategory,
      xp_amount: xpAmount,
      source_type: sourceType,
      source_id: sourceId,
      idempotency_key: idempotencyKey,
      metadata,
    });

    if (error) {
      // Postgres unique constraint violation code is '23505'
      if (error.code === "23505") {
        return { success: true, xpAwarded: 0, alreadyAwarded: true };
      }
      throw error;
    }

    return { success: true, xpAwarded: xpAmount, alreadyAwarded: false };
  } catch (error) {
    apiLogger.error("Error awarding XP", error);
    throw error;
  }
}

/**
 * Marks a 6E module stage as completed.
 * Creates/Updates user_stage_progress and links the xp_event source_id to it.
 */
export async function completeStage(
  supabase: SupabaseClient,
  userId: string,
  modulesContentId: string,
  eContentId?: string,
): Promise<{ success: boolean; xpAwarded: number; userStageProgressId: string }> {
  // 1. Fetch modules content stage details
  const { data: stageContent, error: stageError } = await supabase
    .from("modules_content")
    .select("module_id, stage_name, stage_order")
    .eq("id", modulesContentId)
    .single();

  if (stageError || !stageContent) {
    throw new Error(`Modules content stage not found: ${modulesContentId}`);
  }

  // 2. Resolve e_content ID for this modules_content stage (Required NOT NULL for stage progress)
  let content = eContentId ? { id: eContentId } : null;

  if (!content) {
    const { data: contentData, error: contentError } = await supabase
      .from("e_content")
      .select("id")
      .eq("modules_content_id", modulesContentId)
      .limit(1)
      .maybeSingle();

    if (contentError || !contentData) {
      throw new Error(`Associated e_content item not found for stage: ${modulesContentId}`);
    }

    content = contentData;
  }

  // 3. Fetch or Create user_module_progress
  const { data: progressList, error: progressQueryError } = await supabase
    .from("user_module_progress")
    .select("id, stages_completed, module_status")
    .eq("user_id", userId)
    .eq("module_id", stageContent.module_id);

  if (progressQueryError) throw progressQueryError;

  let progressRecord = progressList?.[0];

  if (!progressRecord) {
    assertStageSequenceAllowed(stageContent.stage_name, []);

    const { data: moduleData } = await supabase
      .from("modules")
      .select("level_id")
      .eq("id", stageContent.module_id)
      .single();

    if (!moduleData) throw new Error("Module not found");

    const { data: lvlProgress } = await supabase
      .from("user_capability_level_progress")
      .select("id")
      .eq("user_id", userId)
      .eq("level_id", moduleData.level_id)
      .single();

    if (!lvlProgress) {
      throw new Error(`Level progress not found for level: ${moduleData.level_id}`);
    }

    const { data: newProgress, error: insertError } = await supabase
      .from("user_module_progress")
      .insert({
        user_id: userId,
        module_id: stageContent.module_id,
        user_capability_level_progress_id: lvlProgress.id,
        module_status: "in_progress",
        current_stage: stageContent.stage_name,
        stages_completed: 1,
        completion_percentage: Math.round((1 / 6) * 100),
      })
      .select()
      .single();

    if (insertError) throw insertError;
    progressRecord = newProgress;
  }

  if (!progressRecord) throw new Error("Failed to create or retrieve module progress");

  const { data: completedStages, error: completedStagesError } = await supabase
    .from("user_stage_progress")
    .select("stage_name")
    .eq("user_module_progress_id", progressRecord.id)
    .eq("user_id", userId)
    .eq("status", "completed");

  if (completedStagesError) throw completedStagesError;

  assertStageSequenceAllowed(
    stageContent.stage_name,
    completedStages?.map((stage) => stage.stage_name) ?? [],
  );

  // 4. Fetch or Create user_stage_progress record
  const { data: stageProgress, error: stageProgressQueryError } = await supabase
    .from("user_stage_progress")
    .select("id, status")
    .eq("user_module_progress_id", progressRecord.id)
    .eq("user_id", userId)
    .eq("e_content_id", content.id)
    .eq("stage_name", stageContent.stage_name)
    .maybeSingle();

  if (stageProgressQueryError) throw stageProgressQueryError;

  let stageProgressId = "";
  let isNewCompletion = false;

  if (!stageProgress) {
    const { data: newStageProgress, error: insertStageError } = await supabase
      .from("user_stage_progress")
      .insert({
        user_module_progress_id: progressRecord.id,
        user_id: userId,
        e_content_id: content.id,
        stage_name: stageContent.stage_name,
        stage_order: stageContent.stage_order,
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertStageError) throw insertStageError;
    stageProgressId = newStageProgress.id;
    isNewCompletion = true;
  } else {
    stageProgressId = stageProgress.id;
    if (stageProgress.status !== "completed") {
      const { error: updateStageError } = await supabase
        .from("user_stage_progress")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", stageProgress.id);

      if (updateStageError) throw updateStageError;
      isNewCompletion = true;
    }
  }

  // 5. Award Stage Completion XP (+1 Evidence)
  // Mapping source_id to user_stage_progress.id and source_type to 'user_stage_progress'
  const xpResult = await awardXp(
    supabase,
    userId,
    "stage_completed",
    "user_stage_progress",
    stageProgressId,
    { modules_content_id: modulesContentId, stage_name: stageContent.stage_name },
  );

  // 6. Update user_module_progress progress counters if this is a newly completed stage
  if (isNewCompletion && !xpResult.alreadyAwarded) {
    const nextStagesCompleted = Math.min(
      LTE_STAGE_COUNT,
      (progressRecord as NonNullable<typeof progressRecord>).stages_completed + 1,
    );
    const completionPercentage = getStageCompletionPercentage(nextStagesCompleted);

    const updatePayload: Record<string, unknown> = {
      stages_completed: nextStagesCompleted,
      completion_percentage: completionPercentage,
      current_stage: stageContent.stage_name,
      last_activity_at: new Date().toISOString(),
    };
    if (nextStagesCompleted >= LTE_STAGE_COUNT) {
      updatePayload["module_status"] = "completed";
    }

    const { error: updateError } = await supabase
      .from("user_module_progress")
      .update(updatePayload)
      .eq("id", (progressRecord as NonNullable<typeof progressRecord>).id);

    if (updateError) throw updateError;
  }

  return { success: true, xpAwarded: xpResult.xpAwarded, userStageProgressId: stageProgressId };
}

/**
 * Handles AI and Authorized Manual evaluations for artifact submissions.
 * Awards attempt-tiered XP, transition statuses, and manages idempotency.
 */
export async function evaluateArtifact(
  supabase: SupabaseClient,
  submissionId: string,
): Promise<{ success: boolean; evidenceXpAwarded: number; engagementXpAwarded: number }> {
  // 1. Query the latest evaluation flow record
  const { data: flow, error: flowError } = await supabase
    .from("artifact_evaluation_flows")
    .select("decision, evaluated_by")
    .eq("submission_id", submissionId)
    .eq("is_current_stage", true)
    .single();

  if (flowError || !flow) {
    throw new Error(`Current evaluation flow not found for submission: ${submissionId}`);
  }

  // 2. Fetch submission details and join artifact type
  const { data: submission, error: subError } = await supabase
    .from("artifact_submissions")
    .select(`
      id,
      artifact_id,
      user_id,
      attempt_no,
      user_module_progress_id,
      module_artifacts (
        id,
        artifact_type,
        passing_score,
        total_score
      )
    `)
    .eq("id", submissionId)
    .single();

  if (subError || !submission) {
    throw new Error(`Submission not found: ${submissionId}`);
  }

  const userId = submission.user_id;
  const attemptNo = submission.attempt_no;
  const artifact = (
    Array.isArray(submission.module_artifacts)
      ? submission.module_artifacts[0]
      : submission.module_artifacts
  ) as { artifact_type: "practice" | "final" };
  const isPractice = artifact.artifact_type === "practice";

  let evidenceXp = 0;
  let engagementXp = 0;

  // 3. State Transitions & XP Calculations based on decision
  // Decision mappings: 'pass' -> accepted, 'fail' / 'return' -> resubmission_required
  if (flow.decision === "pass") {
    // Update Submission status
    await supabase
      .from("artifact_submissions")
      .update({ status: "accepted", sealed_at: new Date().toISOString() })
      .eq("id", submissionId);

    if (isPractice) {
      // Practice Artifact accepted: +2 Evidence XP (source_id: submissionId)
      const xpRes = await awardXp(
        supabase,
        userId,
        "practice_artifact_accepted",
        "artifact_submissions",
        submissionId,
      );
      evidenceXp = xpRes.xpAwarded;
    } else {
      // Final Artifact accepted: tiered Evidence XP (Attempt 1: +20, Attempt 2: +15, Attempt 3+: +10)
      // Preserving idempotency constraint final:{userId}:{moduleArtifactId}
      let eventType = "final_artifact_accepted_1";
      if (attemptNo === 2) {
        eventType = "final_artifact_accepted_2";
      } else if (attemptNo >= 3) {
        eventType = "final_artifact_accepted_3";
      }

      const xpRes = await awardXp(
        supabase,
        userId,
        eventType,
        "artifact_submissions",
        submissionId,
      );
      evidenceXp = xpRes.xpAwarded;

      // Transition user_module_progress to mastered
      await supabase
        .from("user_module_progress")
        .update({
          module_status: "mastered",
          artifact_submitted: true,
          artifact_approval_status: "approved",
          updated_at: new Date().toISOString(),
        })
        .eq("id", submission.user_module_progress_id);
    }

    // Award Manual Review metadata (+5 Engagement XP) if evaluated_by is set
    if (flow.evaluated_by) {
      const xpRes = await awardXp(
        supabase,
        userId,
        "manual_eval_accepted",
        "artifact_submissions",
        submissionId,
      );
      engagementXp = xpRes.xpAwarded;
    }
  } else if (flow.decision === "fail" || flow.decision === "return") {
    // resubmission_required
    await supabase
      .from("artifact_submissions")
      .update({ status: "resubmission_required" })
      .eq("id", submissionId);

    await supabase
      .from("user_module_progress")
      .update({
        artifact_approval_status: "resubmission_required",
        updated_at: new Date().toISOString(),
      })
      .eq("id", submission.user_module_progress_id);

    // Failures award engagement participation XP
    if (isPractice) {
      const xpRes = await awardXp(
        supabase,
        userId,
        "practice_artifact_failed",
        "artifact_submissions",
        submissionId,
      );
      engagementXp = xpRes.xpAwarded;
    } else {
      const xpRes = await awardXp(
        supabase,
        userId,
        "final_artifact_failed",
        "artifact_submissions",
        submissionId,
      );
      engagementXp = xpRes.xpAwarded;
    }
  }

  return { success: true, evidenceXpAwarded: evidenceXp, engagementXpAwarded: engagementXp };
}

/**
 * Handles Fallback Evaluation results.
 * Pass -> manual_eval_accepted (+5 XP)
 * Fail -> fallback_eval_failed (+1 XP)
 */
export async function evaluateFallback(
  supabase: SupabaseClient,
  submissionId: string,
): Promise<{ success: boolean; xpAwarded: number }> {
  // Query the latest evaluation flow record
  const { data: flow, error: flowError } = await supabase
    .from("artifact_evaluation_flows")
    .select("decision, evaluated_by")
    .eq("submission_id", submissionId)
    .eq("is_current_stage", true)
    .single();

  if (flowError || !flow) {
    throw new Error(`Current evaluation flow not found for submission: ${submissionId}`);
  }

  // Fetch user_id from submission
  const { data: submission, error: subError } = await supabase
    .from("artifact_submissions")
    .select("user_id")
    .eq("id", submissionId)
    .single();

  if (subError || !submission) {
    throw new Error(`Submission not found: ${submissionId}`);
  }

  const userId = submission.user_id;

  if (flow.decision === "pass") {
    // Pass awards +5 Evidence XP under manual_eval_accepted enum value
    const xpRes = await awardXp(
      supabase,
      userId,
      "manual_eval_accepted",
      "artifact_submissions",
      submissionId,
      { reviewer_id: flow.evaluated_by, fallback_type: "pass" },
    );
    return { success: true, xpAwarded: xpRes.xpAwarded };
  } else {
    // Fail awards +1 Evidence XP under fallback_eval_failed enum value
    const xpRes = await awardXp(
      supabase,
      userId,
      "fallback_eval_failed",
      "artifact_submissions",
      submissionId,
      { reviewer_id: flow.evaluated_by, fallback_type: "fail" },
    );
    return { success: true, xpAwarded: xpRes.xpAwarded };
  }
}

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
  return { success: true, xpAwarded: xpRes.xpAwarded };
}

/**
 * Awards daily active login XP and streak bonuses.
 */
export async function triggerDailyLogin(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ success: boolean; xpAwarded: number }> {
  const todayDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  if (!todayDate) throw new Error("Invalid date");

  const xpResult = await awardXp(supabase, userId, "daily_login", "users", userId, {
    login_date: todayDate,
  });

  return { success: true, xpAwarded: xpResult.xpAwarded };
}

/**
 * Awards profile completion XP.
 */
export async function completeProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ success: boolean; xpAwarded: number }> {
  const xpRes = await awardXp(supabase, userId, "profile_completed", "users", userId);
  return { success: true, xpAwarded: xpRes.xpAwarded };
}

/**
 * Evaluates readiness milestones based on score and awards engagement XP.
 */
export async function evaluateMilestones(
  supabase: SupabaseClient,
  userId: string,
  roleId: string,
  readinessScore: number,
): Promise<{ success: boolean; milestonesAwarded: string[] }> {
  const thresholds = [
    { score: 25, event: "readiness_milestone_25" },
    { score: 50, event: "readiness_milestone_50" },
    { score: 75, event: "readiness_milestone_75" },
    { score: 100, event: "readiness_milestone_100" },
  ];

  const awarded: string[] = [];

  for (const t of thresholds) {
    if (readinessScore >= t.score) {
      const res = await awardXp(supabase, userId, t.event, "roles", roleId);
      if (!res.alreadyAwarded && res.xpAwarded > 0) {
        awarded.push(t.event);
      }
    }
  }

  return { success: true, milestonesAwarded: awarded };
}

/**
 * Authorized Admin Score correction logic. Fully audited and immutable.
 */
export async function adminOverrideArtifact(
  supabase: SupabaseClient,
  adminId: string,
  submissionId: string,
  newScore: number,
  justification: string,
): Promise<{ success: boolean }> {
  // 1. Fetch current active flow
  const { data: previousFlow, error: flowQueryError } = await supabase
    .from("artifact_evaluation_flows")
    .select("*")
    .eq("submission_id", submissionId)
    .eq("is_current_stage", true)
    .single();

  if (flowQueryError || !previousFlow) {
    throw new Error(`Current evaluation flow not found for submission: ${submissionId}`);
  }

  // 2. Set previous flows to current = false
  await supabase
    .from("artifact_evaluation_flows")
    .update({ is_current_stage: false })
    .eq("submission_id", submissionId);

  // Determine decision based on score
  const { data: submission } = await supabase
    .from("artifact_submissions")
    .select("artifact_id, module_artifacts(passing_score)")
    .eq("id", submissionId)
    .single();

  const passingScore =
    (submission?.module_artifacts as { passing_score?: number } | null)?.passing_score ?? 60;
  const decision = newScore >= passingScore ? "pass" : "fail";

  // 3. Create a NEW evaluation entry reflecting correction
  const { error: insertError } = await supabase.from("artifact_evaluation_flows").insert({
    submission_id: submissionId,
    stage: "ai",
    status: "completed",
    evaluated_by: adminId,
    score: newScore,
    decision,
    completed_at: new Date().toISOString(),
    overall_status: decision === "pass" ? "accepted" : "resubmission_required",
    is_current_stage: true,
    progression_triggered: true,
    metadata: {
      admin_override: true,
      acting_admin_id: adminId,
      justification,
      prior_score: previousFlow.score,
      prior_decision: previousFlow.decision,
      prior_flow_id: previousFlow.id,
      timestamp: new Date().toISOString(),
    },
  });

  if (insertError) throw insertError;

  // 4. Update the user_module_progress module status if changed
  const { data: subDetail } = await supabase
    .from("artifact_submissions")
    .select("user_id, user_module_progress_id")
    .eq("id", submissionId)
    .single();

  if (subDetail) {
    if (decision === "pass") {
      await supabase
        .from("user_module_progress")
        .update({
          module_status: "mastered",
          artifact_approval_status: "approved",
          updated_at: new Date().toISOString(),
        })
        .eq("id", subDetail.user_module_progress_id);
    } else {
      await supabase
        .from("user_module_progress")
        .update({
          module_status: "in_progress",
          artifact_approval_status: "resubmission_required",
          updated_at: new Date().toISOString(),
        })
        .eq("id", subDetail.user_module_progress_id);
    }
  }

  return { success: true };
}

/**
 * Calculates Readiness metrics using the 30/25/25/10/10 formula.
 */
export async function calculateReadiness(
  supabase: SupabaseClient,
  userId: string,
  learningPathId: string,
): Promise<{ readinessScore: number; band: string }> {
  // 1. Fetch total and mastered modules for Course Completion (30%)
  const { data: modulesProgress, error: modErr } = await supabase
    .from("user_module_progress")
    .select("module_status, id")
    .eq("user_id", userId);

  if (modErr) throw modErr;

  const totalModules = modulesProgress.length || 1;
  const masteredModules = modulesProgress.filter((m) => m.module_status === "mastered").length;
  const courseCompletion = (masteredModules / totalModules) * 100;

  // 2. Fetch accepted mandatory artifacts for Artifact Completion (25%)
  const { data: artifactSubmissions, error: subErr } = await supabase
    .from("artifact_submissions")
    .select("id, status, module_artifacts ( artifact_type )")
    .eq("user_id", userId);

  if (subErr) throw subErr;

  const finalSubmissions = (
    artifactSubmissions as Array<{
      id: unknown;
      status: unknown;
      module_artifacts: Array<{ artifact_type?: string }>;
    }>
  ).filter((s) => {
    const artifacts = s.module_artifacts?.[0];
    return artifacts?.artifact_type === "final";
  });
  const totalMandatoryArtifacts = finalSubmissions.length || 1;
  const acceptedMandatoryArtifacts = finalSubmissions.filter((s) => s.status === "accepted").length;
  const artifactCompletion = (acceptedMandatoryArtifacts / totalMandatoryArtifacts) * 100;

  // 3. Fetch accepted AI scores for AI Authoritative Score (25%)
  const submissionIds = finalSubmissions.map((s) => s.id);
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

  // 4. Fetch Evidence XP for XP Achievement (10%) (excluding engagement category)
  const { data: xpData, error: xpErr } = await supabase
    .from("xp_events")
    .select("xp_amount")
    .eq("user_id", userId)
    .eq("xp_category", "evidence");

  if (xpErr) throw xpErr;

  const evidenceXpEarned = xpData.reduce((sum, item) => sum + item.xp_amount, 0);
  const expectedEvidenceXp = 50; // default configuration fallback
  const xpAchievement = Math.min((evidenceXpEarned / expectedEvidenceXp) * 100, 100);

  // 5. Fetch Profile Completion (10%)
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
  const readinessScore = Math.round(
    courseCompletion * 0.3 +
      artifactCompletion * 0.25 +
      aiAverageScore * 0.25 +
      xpAchievement * 0.1 +
      profileCompletion * 0.1,
  );

  // Determine band
  let band = "Not Ready";
  if (readinessScore >= 80) band = "Job Ready";
  else if (readinessScore >= 60) band = "Internship Ready";
  else if (readinessScore >= 40) band = "Learning in Progress";

  // Update learning path role readiness percentage
  await supabase
    .from("learning_paths")
    .update({
      role_readiness_percentage: readinessScore,
      updated_at: new Date().toISOString(),
    })
    .eq("id", learningPathId);

  return { readinessScore, band };
}

/**
 * Calculates the total XP for a user from the xp_events table.
 * Optionally filters to events created at or after `since`.
 */
export async function getUserTotalXp(
  supabase: SupabaseClient,
  userId: string,
  since?: Date,
): Promise<number> {
  let query = supabase.from("xp_events").select("xp_amount").eq("user_id", userId);

  if (since) {
    query = query.gte("created_at", since.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []).reduce((sum, item) => sum + (item.xp_amount ?? 0), 0);
}
