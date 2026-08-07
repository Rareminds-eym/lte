import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assertStageSequenceAllowed,
  getStageCompletionPercentage,
  LTE_STAGE_COUNT,
} from "./stage-sequence";
import { awardXp } from "./xp-engine.core";
import { triggerReadinessRecalculation } from "./xp-engine.progress";

/**
 * Marks a 6E module stage as completed.
 * Creates/Updates user_stage_progress and links the xp_event source_id to it.
 */
export async function completeStage(
  supabase: SupabaseClient,
  userId: string,
  modulesContentId: string,
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
  const { data: content, error: contentError } = await supabase
    .from("e_content")
    .select("id")
    .eq("modules_content_id", modulesContentId)
    .limit(1)
    .maybeSingle();

  if (contentError || !content) {
    throw new Error(`Associated e_content item not found for stage: ${modulesContentId}`);
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

  // Trigger readiness recalculation on event
  await triggerReadinessRecalculation(supabase, userId);

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
  const artifactArray = Array.isArray(submission.module_artifacts)
    ? submission.module_artifacts
    : [submission.module_artifacts];
  const artifact = artifactArray[0];
  if (!artifact || typeof artifact !== "object" || !("artifact_type" in artifact)) {
    throw new Error(`Invalid artifact structure in submission: ${submissionId}`);
  }
  const typedArtifact = artifact as { artifact_type: "practice" | "final" };
  const isPractice = typedArtifact.artifact_type === "practice";

  let evidenceXp = 0;
  let engagementXp = 0;

  // 3. State Transitions & XP Calculations based on decision
  if (flow.decision === "pass") {
    await supabase
      .from("artifact_submissions")
      .update({ status: "accepted", sealed_at: new Date().toISOString() })
      .eq("id", submissionId);

    if (isPractice) {
      const xpRes = await awardXp(
        supabase,
        userId,
        "practice_artifact_accepted",
        "artifact_submissions",
        submissionId,
      );
      evidenceXp = xpRes.xpAwarded;
    } else {
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

  // Trigger readiness recalculation on event
  await triggerReadinessRecalculation(supabase, userId);

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
  const { data: flow, error: flowError } = await supabase
    .from("artifact_evaluation_flows")
    .select("decision, evaluated_by")
    .eq("submission_id", submissionId)
    .eq("is_current_stage", true)
    .single();

  if (flowError || !flow) {
    throw new Error(`Current evaluation flow not found for submission: ${submissionId}`);
  }

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
    const xpRes = await awardXp(
      supabase,
      userId,
      "manual_eval_accepted",
      "artifact_submissions",
      submissionId,
      { reviewer_id: flow.evaluated_by, fallback_type: "pass" },
    );
    await triggerReadinessRecalculation(supabase, userId);
    return { success: true, xpAwarded: xpRes.xpAwarded };
  } else {
    const xpRes = await awardXp(
      supabase,
      userId,
      "fallback_eval_failed",
      "artifact_submissions",
      submissionId,
      { reviewer_id: flow.evaluated_by, fallback_type: "fail" },
    );
    await triggerReadinessRecalculation(supabase, userId);
    return { success: true, xpAwarded: xpRes.xpAwarded };
  }
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

  const { data: submission } = await supabase
    .from("artifact_submissions")
    .select("artifact_id, module_artifacts(passing_score)")
    .eq("id", submissionId)
    .single();

  const moduleArtifacts = submission?.module_artifacts;
  const singleArtifact = Array.isArray(moduleArtifacts) ? moduleArtifacts[0] : moduleArtifacts;
  const passingScore = (singleArtifact as { passing_score?: number } | null)?.passing_score ?? 60;
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

  // Trigger readiness recalculation on event
  if (subDetail?.user_id) {
    await triggerReadinessRecalculation(supabase, subDetail.user_id);
  }

  return { success: true };
}
