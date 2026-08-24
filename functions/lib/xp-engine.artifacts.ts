import { asQueryGateway, type QueryGatewayFilter, type QueryGatewaySource } from "./query-gateway";
import {
  assertStageSequenceAllowed,
  getStageCompletionPercentage,
  LTE_STAGE_COUNT,
} from "./stage-sequence";
import { awardXp } from "./xp-engine.core";
import { triggerReadinessRecalculation } from "./xp-engine.progress";

const moduleContentStageReadPolicy = {
  table: "modules_content",
  operation: "read",
  columns: ["module_id", "stage_name", "stage_order"],
  filters: ["id"],
} as const;

const eContentByModuleContentReadPolicy = {
  table: "e_content",
  operation: "read",
  columns: ["id"],
  filters: ["modules_content_id"],
} as const;

const moduleLevelReadPolicy = {
  table: "modules",
  operation: "read",
  columns: ["level_id"],
  filters: ["id"],
} as const;

const levelProgressReadPolicy = {
  table: "user_capability_level_progress",
  operation: "read",
  columns: ["id"],
  filters: ["user_id", "level_id"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
} as const;

const moduleProgressReadPolicy = {
  table: "user_module_progress",
  operation: "read",
  columns: ["id", "stages_completed", "module_status"],
  filters: ["user_id", "module_id"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
} as const;

const moduleProgressInsertPolicy = {
  table: "user_module_progress",
  operation: "insert",
  insertColumns: [
    "user_id",
    "module_id",
    "user_capability_level_progress_id",
    "module_status",
    "current_stage",
    "stages_completed",
    "completion_percentage",
  ],
  returningColumns: ["id", "stages_completed", "module_status"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
} as const;

const moduleProgressUpdatePolicy = {
  table: "user_module_progress",
  operation: "update",
  updateColumns: [
    "stages_completed",
    "completion_percentage",
    "current_stage",
    "last_activity_at",
    "module_status",
    "artifact_submitted",
    "artifact_approval_status",
    "updated_at",
  ],
  filters: ["id", "user_id"],
  requireFilter: true,
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
} as const;

const completedStageNamesReadPolicy = {
  table: "user_stage_progress",
  operation: "read",
  columns: ["stage_name"],
  filters: ["user_id", "user_module_progress_id", "status"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
} as const;

const stageProgressReadPolicy = {
  table: "user_stage_progress",
  operation: "read",
  columns: ["id", "status"],
  filters: ["user_id", "user_module_progress_id", "e_content_id", "stage_name"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
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
    "completed_at",
  ],
  returningColumns: ["id"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
} as const;

const stageProgressCompleteUpdatePolicy = {
  table: "user_stage_progress",
  operation: "update",
  updateColumns: ["status", "completed_at", "updated_at"],
  filters: ["id", "user_id"],
  requireFilter: true,
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
} as const;

const currentEvaluationFlowReadPolicy = {
  table: "artifact_evaluation_flows",
  operation: "read",
  columns: ["id", "decision", "evaluated_by", "score"],
  filters: ["submission_id", "is_current_stage"],
} as const;

const evaluationFlowDemotePolicy = {
  table: "artifact_evaluation_flows",
  operation: "update",
  updateColumns: ["is_current_stage"],
  filters: ["submission_id"],
  requireFilter: true,
} as const;

const evaluationFlowInsertPolicy = {
  table: "artifact_evaluation_flows",
  operation: "insert",
  insertColumns: [
    "submission_id",
    "stage",
    "status",
    "evaluated_by",
    "score",
    "decision",
    "completed_at",
    "overall_status",
    "is_current_stage",
    "progression_triggered",
    "metadata",
  ],
} as const;

const artifactSubmissionEvaluationReadPolicy = {
  table: "artifact_submissions",
  operation: "read",
  select: `
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
  `,
  filters: ["id"],
} as const;

const artifactSubmissionUserReadPolicy = {
  table: "artifact_submissions",
  operation: "read",
  columns: ["user_id"],
  filters: ["id"],
} as const;

const artifactSubmissionOverrideReadPolicy = {
  table: "artifact_submissions",
  operation: "read",
  select: "artifact_id, module_artifacts(passing_score)",
  filters: ["id"],
} as const;

const artifactSubmissionProgressReadPolicy = {
  table: "artifact_submissions",
  operation: "read",
  columns: ["user_id", "user_module_progress_id"],
  filters: ["id"],
} as const;

const artifactSubmissionStatusUpdatePolicy = {
  table: "artifact_submissions",
  operation: "update",
  updateColumns: ["status", "sealed_at"],
  filters: ["id", "user_id"],
  requireFilter: true,
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
} as const;

type StageContentRow = {
  module_id: string;
  stage_name: string;
  stage_order: number;
};

type IdRow = { id: string };

type ModuleProgressRow = {
  id: string;
  stages_completed: number;
  module_status?: string | null;
};

type StageProgressRow = {
  id: string;
  status?: string | null;
};

type EvaluationFlowRow = {
  id: string;
  decision?: string | null;
  evaluated_by?: string | null;
  score?: number | null;
};

type ArtifactSubmissionEvaluationRow = {
  id: string;
  artifact_id: string;
  user_id: string;
  attempt_no: number;
  user_module_progress_id: string;
  module_artifacts:
    | {
        id: string;
        artifact_type?: string | null;
        passing_score?: number | null;
        total_score?: number | null;
      }
    | Array<{
        id: string;
        artifact_type?: string | null;
        passing_score?: number | null;
        total_score?: number | null;
      }>
    | null;
};

type ArtifactSubmissionOverrideRow = {
  artifact_id: string;
  module_artifacts:
    | { passing_score?: number | null }
    | Array<{ passing_score?: number | null }>
    | null;
};

function byId(id: string): QueryGatewayFilter {
  return { column: "id", op: "eq", value: id };
}

async function readRequired<T>(read: Promise<unknown>, message: string): Promise<T> {
  try {
    const row = (await read) as T | null;
    if (!row) throw new Error(message);
    return row;
  } catch {
    throw new Error(message);
  }
}

async function readOptional<T>(read: Promise<unknown>): Promise<T | null> {
  try {
    return (await read) as T | null;
  } catch {
    return null;
  }
}

/**
 * Marks a 6E module stage as completed.
 * Creates/Updates user_stage_progress and links the xp_event source_id to it.
 */
export async function completeStage(
  source: QueryGatewaySource,
  userId: string,
  modulesContentId: string,
): Promise<{ success: boolean; xpAwarded: number; userStageProgressId: string }> {
  const qb = asQueryGateway(source);

  // 1. Fetch modules content stage details
  const stageContent = await readRequired<StageContentRow>(
    qb.read(moduleContentStageReadPolicy, {
      filters: [byId(modulesContentId)],
      result: "single",
    }),
    `Modules content stage not found: ${modulesContentId}`,
  );

  // 2. Resolve e_content ID for this modules_content stage (Required NOT NULL for stage progress)
  const content = await readRequired<IdRow>(
    qb.read(eContentByModuleContentReadPolicy, {
      filters: [{ column: "modules_content_id", op: "eq", value: modulesContentId }],
      limit: 1,
      result: "maybeSingle",
    }),
    `Associated e_content item not found for stage: ${modulesContentId}`,
  );

  // 3. Fetch or Create user_module_progress
  const progressList = (await qb.read(moduleProgressReadPolicy, {
    auth: { userId },
    filters: [{ column: "module_id", op: "eq", value: stageContent.module_id }],
  })) as ModuleProgressRow[] | null;

  let progressRecord: ModuleProgressRow | null = progressList?.[0] ?? null;

  if (!progressRecord) {
    assertStageSequenceAllowed(stageContent.stage_name, []);

    const moduleData = (await qb.read(moduleLevelReadPolicy, {
      filters: [byId(stageContent.module_id)],
      result: "single",
    })) as { level_id: string } | null;

    if (!moduleData) throw new Error("Module not found");

    const lvlProgress = (await qb.read(levelProgressReadPolicy, {
      auth: { userId },
      filters: [{ column: "level_id", op: "eq", value: moduleData.level_id }],
      result: "single",
    })) as IdRow | null;

    if (!lvlProgress) {
      throw new Error(`Level progress not found for level: ${moduleData.level_id}`);
    }

    progressRecord = (await qb.insert(
      moduleProgressInsertPolicy,
      {
        module_id: stageContent.module_id,
        user_capability_level_progress_id: lvlProgress.id,
        module_status: "in_progress",
        current_stage: stageContent.stage_name,
        stages_completed: 1,
        completion_percentage: Math.round((1 / 6) * 100),
      },
      { auth: { userId }, result: "single" },
    )) as ModuleProgressRow | null;
  }

  if (!progressRecord) throw new Error("Failed to create or retrieve module progress");

  const completedStages = (await qb.read(completedStageNamesReadPolicy, {
    auth: { userId },
    filters: [
      { column: "user_module_progress_id", op: "eq", value: progressRecord.id },
      { column: "status", op: "eq", value: "completed" },
    ],
  })) as Array<{ stage_name: string }> | null;

  assertStageSequenceAllowed(
    stageContent.stage_name,
    completedStages?.map((stage) => stage.stage_name) ?? [],
  );

  // 4. Fetch or Create user_stage_progress record
  const stageProgress = (await qb.read(stageProgressReadPolicy, {
    auth: { userId },
    filters: [
      { column: "user_module_progress_id", op: "eq", value: progressRecord.id },
      { column: "e_content_id", op: "eq", value: content.id },
      { column: "stage_name", op: "eq", value: stageContent.stage_name },
    ],
    result: "maybeSingle",
  })) as StageProgressRow | null;

  let stageProgressId = "";
  let isNewCompletion = false;

  if (!stageProgress) {
    const newStageProgress = (await qb.insert(
      stageProgressInsertPolicy,
      {
        user_module_progress_id: progressRecord.id,
        e_content_id: content.id,
        stage_name: stageContent.stage_name,
        stage_order: stageContent.stage_order,
        status: "completed",
        completed_at: new Date().toISOString(),
      },
      { auth: { userId }, result: "single" },
    )) as IdRow | null;

    if (!newStageProgress) throw new Error("Failed to create stage progress");
    stageProgressId = newStageProgress.id;
    isNewCompletion = true;
  } else {
    stageProgressId = stageProgress.id;
    if (stageProgress.status !== "completed") {
      await qb.update(stageProgressCompleteUpdatePolicy, {
        auth: { userId },
        filters: [byId(stageProgress.id)],
        data: {
          status: "completed",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });
      isNewCompletion = true;
    }
  }

  // 5. Award Stage Completion XP (+1 Evidence)
  const xpResult = await awardXp(
    source,
    userId,
    "stage_completed",
    "user_stage_progress",
    stageProgressId,
    { modules_content_id: modulesContentId, stage_name: stageContent.stage_name },
  );

  // 6. Update user_module_progress progress counters if this is a newly completed stage
  if (isNewCompletion && !xpResult.alreadyAwarded) {
    const nextStagesCompleted = Math.min(LTE_STAGE_COUNT, progressRecord.stages_completed + 1);
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

    await qb.update(moduleProgressUpdatePolicy, {
      auth: { userId },
      filters: [byId(progressRecord.id)],
      data: updatePayload,
    });
  }

  // Trigger readiness recalculation on event
  await triggerReadinessRecalculation(source, userId);

  return { success: true, xpAwarded: xpResult.xpAwarded, userStageProgressId: stageProgressId };
}

/**
 * Handles AI and Authorized Manual evaluations for artifact submissions.
 * Awards attempt-tiered XP, transition statuses, and manages idempotency.
 */
export async function evaluateArtifact(
  source: QueryGatewaySource,
  submissionId: string,
): Promise<{ success: boolean; evidenceXpAwarded: number; engagementXpAwarded: number }> {
  const qb = asQueryGateway(source);

  // 1. Query the latest evaluation flow record
  const flow = await readRequired<EvaluationFlowRow>(
    qb.read(currentEvaluationFlowReadPolicy, {
      filters: [
        { column: "submission_id", op: "eq", value: submissionId },
        { column: "is_current_stage", op: "eq", value: true },
      ],
      result: "single",
    }),
    `Current evaluation flow not found for submission: ${submissionId}`,
  );

  // 2. Fetch submission details and join artifact type
  const submission = await readRequired<ArtifactSubmissionEvaluationRow>(
    qb.read(artifactSubmissionEvaluationReadPolicy, {
      filters: [byId(submissionId)],
      result: "single",
    }),
    `Submission not found: ${submissionId}`,
  );

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
    await qb.update(artifactSubmissionStatusUpdatePolicy, {
      auth: { userId },
      filters: [byId(submissionId)],
      data: { status: "accepted", sealed_at: new Date().toISOString() },
    });

    if (isPractice) {
      const xpRes = await awardXp(
        source,
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

      const xpRes = await awardXp(source, userId, eventType, "artifact_submissions", submissionId);
      evidenceXp = xpRes.xpAwarded;

      await qb.update(moduleProgressUpdatePolicy, {
        auth: { userId },
        filters: [byId(submission.user_module_progress_id)],
        data: {
          module_status: "mastered",
          artifact_submitted: true,
          artifact_approval_status: "approved",
          updated_at: new Date().toISOString(),
        },
      });
    }

    if (flow.evaluated_by) {
      const xpRes = await awardXp(
        source,
        userId,
        "manual_eval_accepted",
        "artifact_submissions",
        submissionId,
      );
      engagementXp = xpRes.xpAwarded;
    }
  } else if (flow.decision === "fail" || flow.decision === "return") {
    await qb.update(artifactSubmissionStatusUpdatePolicy, {
      auth: { userId },
      filters: [byId(submissionId)],
      data: { status: "resubmission_required" },
    });

    await qb.update(moduleProgressUpdatePolicy, {
      auth: { userId },
      filters: [byId(submission.user_module_progress_id)],
      data: {
        artifact_approval_status: "resubmission_required",
        updated_at: new Date().toISOString(),
      },
    });

    if (isPractice) {
      const xpRes = await awardXp(
        source,
        userId,
        "practice_artifact_failed",
        "artifact_submissions",
        submissionId,
      );
      engagementXp = xpRes.xpAwarded;
    } else {
      const xpRes = await awardXp(
        source,
        userId,
        "final_artifact_failed",
        "artifact_submissions",
        submissionId,
      );
      engagementXp = xpRes.xpAwarded;
    }
  }

  // Trigger readiness recalculation on event
  await triggerReadinessRecalculation(source, userId);

  return { success: true, evidenceXpAwarded: evidenceXp, engagementXpAwarded: engagementXp };
}

/**
 * Handles Fallback Evaluation results.
 * Pass -> manual_eval_accepted (+5 XP)
 * Fail -> fallback_eval_failed (+1 XP)
 */
export async function evaluateFallback(
  source: QueryGatewaySource,
  submissionId: string,
): Promise<{ success: boolean; xpAwarded: number }> {
  const qb = asQueryGateway(source);

  const flow = await readRequired<EvaluationFlowRow>(
    qb.read(currentEvaluationFlowReadPolicy, {
      filters: [
        { column: "submission_id", op: "eq", value: submissionId },
        { column: "is_current_stage", op: "eq", value: true },
      ],
      result: "single",
    }),
    `Current evaluation flow not found for submission: ${submissionId}`,
  );

  const submission = await readRequired<{ user_id: string }>(
    qb.read(artifactSubmissionUserReadPolicy, {
      filters: [byId(submissionId)],
      result: "single",
    }),
    `Submission not found: ${submissionId}`,
  );

  const userId = submission.user_id;

  if (flow.decision === "pass") {
    const xpRes = await awardXp(
      source,
      userId,
      "manual_eval_accepted",
      "artifact_submissions",
      submissionId,
      { reviewer_id: flow.evaluated_by, fallback_type: "pass" },
    );
    await triggerReadinessRecalculation(source, userId);
    return { success: true, xpAwarded: xpRes.xpAwarded };
  }

  const xpRes = await awardXp(
    source,
    userId,
    "fallback_eval_failed",
    "artifact_submissions",
    submissionId,
    { reviewer_id: flow.evaluated_by, fallback_type: "fail" },
  );
  await triggerReadinessRecalculation(source, userId);
  return { success: true, xpAwarded: xpRes.xpAwarded };
}

/**
 * Authorized Admin Score correction logic. Fully audited and immutable.
 */
export async function adminOverrideArtifact(
  source: QueryGatewaySource,
  adminId: string,
  submissionId: string,
  newScore: number,
  justification: string,
): Promise<{ success: boolean }> {
  const qb = asQueryGateway(source);

  // 1. Fetch current active flow
  const previousFlow = await readRequired<EvaluationFlowRow>(
    qb.read(currentEvaluationFlowReadPolicy, {
      filters: [
        { column: "submission_id", op: "eq", value: submissionId },
        { column: "is_current_stage", op: "eq", value: true },
      ],
      result: "single",
    }),
    `Current evaluation flow not found for submission: ${submissionId}`,
  );

  // 2. Set previous flows to current = false
  await qb.update(evaluationFlowDemotePolicy, {
    filters: [{ column: "submission_id", op: "eq", value: submissionId }],
    data: { is_current_stage: false },
  });

  const submission = await readOptional<ArtifactSubmissionOverrideRow>(
    qb.read(artifactSubmissionOverrideReadPolicy, {
      filters: [byId(submissionId)],
      result: "single",
    }),
  );

  const moduleArtifacts = submission?.module_artifacts;
  const singleArtifact = Array.isArray(moduleArtifacts) ? moduleArtifacts[0] : moduleArtifacts;
  const passingScore = singleArtifact?.passing_score ?? 60;
  const decision = newScore >= passingScore ? "pass" : "fail";

  // 3. Create a NEW evaluation entry reflecting correction
  await qb.insert(evaluationFlowInsertPolicy, {
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

  // 4. Update the user_module_progress module status if changed
  const subDetail = await readOptional<{ user_id: string; user_module_progress_id: string }>(
    qb.read(artifactSubmissionProgressReadPolicy, {
      filters: [byId(submissionId)],
      result: "single",
    }),
  );

  if (subDetail) {
    if (decision === "pass") {
      await qb.update(moduleProgressUpdatePolicy, {
        auth: { userId: subDetail.user_id },
        filters: [byId(subDetail.user_module_progress_id)],
        data: {
          module_status: "mastered",
          artifact_approval_status: "approved",
          updated_at: new Date().toISOString(),
        },
      });
    } else {
      await qb.update(moduleProgressUpdatePolicy, {
        auth: { userId: subDetail.user_id },
        filters: [byId(subDetail.user_module_progress_id)],
        data: {
          module_status: "in_progress",
          artifact_approval_status: "resubmission_required",
          updated_at: new Date().toISOString(),
        },
      });
    }
  }

  // Trigger readiness recalculation on event
  if (subDetail?.user_id) {
    await triggerReadinessRecalculation(source, subDetail.user_id);
  }

  return { success: true };
}
