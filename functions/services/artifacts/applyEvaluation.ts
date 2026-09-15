/**
 * Application of a validated evaluation proposal (cutover-ready, used by the
 * current inline path today).
 *
 * Extracted verbatim from `processAndSaveArtifactEvaluation` in
 * `functions/lib/artifact-evaluator/artifact-evaluator.ts`: the same
 * fallback enforcement, status mapping, event-type computation, telemetry
 * redaction and four writes (flow upsert, submission status, module
 * progress, XP award). At cutover the worker's `grade-submission` proposal
 * enters here instead of the inline result — the function accepts the
 * normalized proposal shape both produce.
 *
 * Revision safety: pass the submission's current attempt number as
 * `currentAttemptNo` and the queued/intended revision as
 * `expectedAttemptNo`; a mismatch throws before any write (stale completion
 * guard). `processAndSaveArtifactEvaluation` passes the same value twice
 * today, so current behavior is unchanged.
 */

import { apiLogger } from "@functions/shared/logger";
import { asQueryGateway, type QueryGatewaySource } from "@functions/lib/query-gateway";
import {
  artifactModuleProgressUpdatePolicy,
  artifactSubmissionStatusUpdatePolicy,
  evaluationFlowUpsertPolicy,
} from "@functions/lib/artifact-evaluator/artifact-evaluator";
import { METRIC, metrics } from "@functions/lib/artifact-evaluator/metrics";
import type { AIEvaluationResult } from "@functions/lib/artifact-evaluator/types";

export type ApplyOverallStatus = "accepted" | "human_review" | "resubmission_required";

/** Normalized proposal: everything the apply path reads, nothing it doesn't. */
export interface EvaluationProposal {
  decision: AIEvaluationResult["decision"];
  overallScore: number;
  passingScore: number;
  feedback: string;
  singleImprovementPoint: string;
  rubricRows: AIEvaluationResult["rubricRows"];
  stage1SubmissionCheck: AIEvaluationResult["stage1SubmissionCheck"];
  stage2CriticalFailures: AIEvaluationResult["stage2CriticalFailures"];
  modelUsed: string;
  provider: AIEvaluationResult["provider"];
  confidence: number;
  calculatedXp: number;
  requiresManualReview: boolean;
  evaluationSource: AIEvaluationResult["evaluationSource"];
  eventType?: string;
  /**
   * P1-3-safe telemetry subset (raw prompt/response excluded by
   * construction; timestamp preserved from evaluation for dual-run
   * comparability). `toEvaluationProposal` strips the raw fields off the
   * inline result; worker proposals already exclude them (their adapter
   * stamps `timestamp` at mapping time).
   */
  debugTelemetry?: {
    provider: "openrouter" | "fallback";
    latencyMs: number | null;
    modelUsed: string;
    timestamp: string;
    calculatedXp: number;
    confidence: number;
    validatedDecision: AIEvaluationResult["decision"];
    wasDecisionOverridden: boolean;
    extractionCharCounts: Record<string, number>;
    promptCharCount: number | null;
    stage1Check: AIEvaluationResult["stage1SubmissionCheck"];
    stage2Failures: AIEvaluationResult["stage2CriticalFailures"];
  } | null;
}

export interface ApplyEvaluationArgs {
  submissionId: string;
  moduleProgressId: string;
  userId: string;
  artifactId: string;
  artifactType: "practice" | "final";
  attemptNo: number;
  /** Fresh-read attempt number of the submission row (stale-completion guard). */
  currentAttemptNo?: number;
  /**
   * Intended revision. When present, `currentAttemptNo` must be provided
   * and equal — otherwise this throws before any write. Omitted entirely
   * by the inline path (no new reads, behavior unchanged).
   */
  expectedAttemptNo?: number;
  proposal: EvaluationProposal;
}

export interface ApplyEvaluationResult {
  evalResult: AIEvaluationResult;
  overallStatus: ApplyOverallStatus;
}

export type AwardXpFn = (
  userId: string,
  eventType: string,
  score: number,
  attemptNo: number,
  provider: string,
  calculatedXp: number,
) => Promise<void>;

export function toEvaluationProposal(result: AIEvaluationResult): EvaluationProposal {
  const telemetry = result.debugTelemetry;
  return {
    decision: result.decision,
    overallScore: result.overallScore,
    passingScore: result.passingScore,
    feedback: result.feedback,
    singleImprovementPoint: result.singleImprovementPoint,
    rubricRows: result.rubricRows,
    stage1SubmissionCheck: result.stage1SubmissionCheck,
    stage2CriticalFailures: result.stage2CriticalFailures,
    modelUsed: result.modelUsed,
    provider: result.provider,
    confidence: result.confidence,
    calculatedXp: result.calculatedXp,
    requiresManualReview: result.requiresManualReview,
    evaluationSource: result.evaluationSource,
    eventType: result.eventType,
    debugTelemetry: telemetry
      ? {
          provider: telemetry.provider,
          latencyMs: telemetry.latencyMs,
          modelUsed: telemetry.modelUsed,
          timestamp: telemetry.timestamp,
          calculatedXp: telemetry.calculatedXp,
          confidence: telemetry.confidence,
          validatedDecision: telemetry.validatedDecision,
          wasDecisionOverridden: telemetry.wasDecisionOverridden,
          extractionCharCounts: telemetry.extractionCharCounts,
          promptCharCount: telemetry.promptCharCount,
          stage1Check: telemetry.stage1Check,
          stage2Failures: telemetry.stage2Failures,
        }
      : telemetry ?? null,
  };
}

export async function applyEvaluationProposal(
  source: QueryGatewaySource,
  awardXp: AwardXpFn,
  args: ApplyEvaluationArgs,
): Promise<ApplyEvaluationResult> {
  if (args.expectedAttemptNo !== undefined) {
    if (args.currentAttemptNo === undefined || args.expectedAttemptNo !== args.currentAttemptNo) {
      throw new Error(
        `Stale evaluation result (submission ${args.submissionId}): ` +
          `expected attempt ${args.expectedAttemptNo}, submission is at attempt ${args.currentAttemptNo ?? "unknown"}.`,
      );
    }
  }

  const qb = asQueryGateway(source);
  const evalContext = {
    submissionId: args.submissionId,
    artifactId: args.artifactId,
    attemptNo: args.attemptNo,
  };

  // P0-1 hard guarantee: no matter which path produced a fallback result
  // (missing key, LLM failure, unreadable file), it can never pass or award XP.
  // Field-for-field mirror of the enforcement in processAndSave: only the
  // listed fields are forced, everything else (rows, tones, telemetry
  // timestamp, improvement text) is preserved from the proposal.
  const p = args.proposal;
  const evalResult: AIEvaluationResult =
    p.provider === "fallback"
      ? {
          overallScore: 0,
          passingScore: p.passingScore,
          confidence: p.confidence,
          decision: "human_review",
          stage1SubmissionCheck: p.stage1SubmissionCheck,
          stage2CriticalFailures: p.stage2CriticalFailures,
          rubricRows: p.rubricRows,
          feedback: "AI evaluation is unavailable; a human reviewer must evaluate this submission.",
          singleImprovementPoint: p.singleImprovementPoint,
          calculatedXp: 0,
          modelUsed: p.modelUsed,
          provider: "fallback",
          requiresManualReview: true,
          evaluationSource: "fallback",
          eventType: p.eventType,
          debugTelemetry: p.debugTelemetry
            ? {
                ...p.debugTelemetry,
                rawPromptContent: null,
                rawResponseContent: null,
              }
            : undefined,
        }
      : {
          overallScore: p.overallScore,
          passingScore: p.passingScore,
          confidence: p.confidence,
          decision: p.decision,
          stage1SubmissionCheck: p.stage1SubmissionCheck,
          stage2CriticalFailures: p.stage2CriticalFailures,
          rubricRows: p.rubricRows,
          feedback: p.feedback,
          singleImprovementPoint: p.singleImprovementPoint,
          calculatedXp: p.calculatedXp,
          modelUsed: p.modelUsed,
          provider: p.provider,
          requiresManualReview: p.requiresManualReview,
          evaluationSource: p.evaluationSource,
          eventType: p.eventType,
          debugTelemetry: p.debugTelemetry
            ? {
                ...p.debugTelemetry,
                rawPromptContent: null,
                rawResponseContent: null,
              }
            : undefined,
        };
  if (evalResult.decision === "human_review") metrics.inc(METRIC.HUMAN_REVIEW);
  const now = new Date().toISOString();

  const overallStatus: ApplyOverallStatus =
    evalResult.decision === "pass"
      ? "accepted"
      : evalResult.decision === "human_review"
        ? "human_review"
        : "resubmission_required";

  // Compute eventType early so it gets persisted correctly in the database flow row
  let eventType: string | undefined;
  if (evalResult.decision !== "human_review") {
    eventType =
      args.artifactType === "practice"
        ? evalResult.decision === "pass"
          ? "practice_artifact_accepted"
          : "practice_artifact_failed"
        : evalResult.decision === "pass"
          ? `final_artifact_accepted_${Math.min(3, args.attemptNo)}`
          : "final_artifact_failed";
    evalResult.eventType = eventType;
  }

  // P1-3: the raw prompt/response are never persisted (learner content +
  // model output); telemetry keeps latency/charCounts/model for observability.
  const debugTelemetry = evalResult.debugTelemetry
    ? { ...evalResult.debugTelemetry, rawPromptContent: null, rawResponseContent: null }
    : null;

  // 1. Update artifact_evaluation_flows table
  try {
    await qb.upsert(evaluationFlowUpsertPolicy, {
      submission_id: args.submissionId,
      stage: "ai",
      stage_order: 1,
      status: "completed",
      score: evalResult.overallScore,
      decision: evalResult.decision,
      feedback: evalResult.feedback,
      improvements: evalResult.singleImprovementPoint,
      overall_status: overallStatus,
      is_current_stage: true,
      progression_triggered: evalResult.decision === "pass",
      completed_at: now,
      metadata: {
        rubric_rows: evalResult.rubricRows,
        stage1_submission_check: evalResult.stage1SubmissionCheck,
        stage2_critical_failures: evalResult.stage2CriticalFailures,
        model_used: evalResult.modelUsed,
        provider: evalResult.provider,
        confidence: evalResult.confidence,
        calculated_xp: evalResult.calculatedXp,
        event_type: evalResult.eventType,
        attempt_no: args.attemptNo,
        requires_manual_review: evalResult.requiresManualReview,
        evaluation_source: evalResult.evaluationSource,
        debug_telemetry: debugTelemetry,
      },
      updated_at: now,
    });
  } catch (flowError) {
    apiLogger.error("Failed to save artifact evaluation flow", flowError, evalContext);
    throw new Error(
      `Failed to save artifact evaluation flow (submission ${args.submissionId}): ${
        flowError instanceof Error ? flowError.message : "Unknown error"
      }`,
    );
  }

  // 2. Update artifact_submissions table status
  try {
    await qb.update(artifactSubmissionStatusUpdatePolicy, {
      data: {
        status: overallStatus,
        sealed_at: evalResult.decision === "pass" ? now : null,
        updated_at: now,
      },
      filters: [{ column: "id", op: "eq", value: args.submissionId }],
    });
  } catch (subError) {
    apiLogger.error("Failed to update submission status", subError, evalContext);
    throw new Error(
      `Failed to update submission status (submission ${args.submissionId}): ${
        subError instanceof Error ? subError.message : "Unknown error"
      }`,
    );
  }

  // 3. Update user_module_progress in single payload
  const progressPayload: Record<string, unknown> = {
    artifact_approval_status: evalResult.decision === "pass" ? "approved" : overallStatus,
    updated_at: now,
    ...(evalResult.decision === "pass" && { artifact_submitted: true }),
    ...(evalResult.decision === "pass" &&
      args.artifactType !== "practice" && { module_status: "mastered" }),
  };

  try {
    await qb.update(artifactModuleProgressUpdatePolicy, {
      data: progressPayload,
      filters: [{ column: "id", op: "eq", value: args.moduleProgressId }],
    });
  } catch (progressError) {
    apiLogger.error("Failed to update module progress", progressError, evalContext);
    throw new Error(
      `Failed to update module progress (submission ${args.submissionId}): ${
        progressError instanceof Error ? progressError.message : "Unknown error"
      }`,
    );
  }

  // 4. Award AI-determined XP via xp-engine (human_review is neutral: no
  // failure event, no engagement XP - a pending review is not a failure).
  // XP insert failures must not surface as a 500 to the learner after the
  // evaluation is already persisted - log and let the idempotent upsert retry.
  if (eventType) {
    try {
      await awardXp(
        args.userId,
        eventType,
        evalResult.overallScore,
        args.attemptNo,
        evalResult.provider,
        evalResult.calculatedXp,
      );
    } catch (error) {
      apiLogger.error(`Failed to award artifact XP (${eventType})`, error, {
        submissionId: args.submissionId,
        artifactId: args.artifactId,
        attemptNo: args.attemptNo,
      });
    }
  }

  return { evalResult, overallStatus };
}
