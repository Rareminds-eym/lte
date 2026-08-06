import type { SupabaseClient } from "@supabase/supabase-js";
import { apiLogger } from "../logger";
import {
  callOpenRouterAI,
  DEFAULT_OPENROUTER_MODEL,
  type OpenRouterChatRequest,
} from "../openrouter";
import type { LteEnv } from "../types";
import { awardXp } from "../xp-engine";
import type {
  AIDebugTelemetry,
  AIEvaluationResult,
  ArtifactEvaluationInput,
  LteCriterionLabel,
  LteDecisionResult,
  RubricCriterionResult,
} from "./types";

export const LTE_CRITERIA: LteCriterionLabel[] = [
  "Completeness",
  "Accuracy",
  "Evidence use",
  "Judgement",
  "Next action",
];

function calculateArtifactXp(isPass: boolean, isPractice: boolean, attemptNo: number): number {
  if (!isPass) return 1;
  if (isPractice) return 2;
  return attemptNo === 1 ? 20 : attemptNo === 2 ? 15 : 10;
}

export function generateFallbackEvaluation(input: ArtifactEvaluationInput): AIEvaluationResult {
  const passingThreshold = input.passingScore ?? 60;
  const questionCount = Math.max(1, input.questions.length);

  // False-positive prevention: ensure ALL questions are answered with meaningful content
  const validAnswers = input.answers.filter(
    (a) =>
      (a.textResponse && a.textResponse.trim().length >= 10) ||
      (a.urlResponse && a.urlResponse.trim().length >= 5) ||
      Boolean(a.fileName),
  );

  const isComplete = validAnswers.length >= questionCount;
  const isPass = isComplete;
  const defaultScore = isPass ? 2 : 1;
  const isPractice = input.artifactType === "practice";
  const calculatedXp = calculateArtifactXp(isPass, isPractice, input.attemptNo);

  const rubricRows: RubricCriterionResult[] = LTE_CRITERIA.map((label) => {
    const isCompleteness = label === "Completeness";
    const score = isCompleteness ? (isComplete ? 3 : 1) : defaultScore;
    const level =
      score === 3
        ? "Strongly demonstrated"
        : score === 2
          ? "Demonstrated"
          : "Partially demonstrated";
    return {
      label,
      score,
      maxScore: 3,
      level,
      evidence: isComplete
        ? `Provided valid input for ${label.toLowerCase()}.`
        : "Incomplete or missing required response.",
      tone: isPass ? "success" : "warning",
      feedback: `Demonstrates ${level.toLowerCase()} performance for ${label.toLowerCase()}.`,
    };
  });

  const stage1SubmissionCheck = {
    isAssessable: isComplete,
    notes: isComplete
      ? "Submission check passed: All required artifact sections present and readable."
      : "Submission check failed: One or more required prompt responses are missing or too brief.",
  };
  const stage2CriticalFailures = { hasFailure: false, failuresFound: [] };

  return {
    overallScore: isPass ? 85 : 50,
    passingScore: passingThreshold,
    decision: isPass ? "pass" : "revise_and_resubmit",
    stage1SubmissionCheck,
    stage2CriticalFailures,
    rubricRows,
    feedback: isPass
      ? "Pass: No critical failures and all essential criteria demonstrate target mastery."
      : "Revise and resubmit: Submission incomplete or essential criteria score below 2.",
    singleImprovementPoint:
      "Elaborate further on root-cause evidence and specify concrete ownership for next steps.",
    calculatedXp,
    modelUsed: "fallback-rules-engine",
    provider: "fallback",
    debugTelemetry: {
      timestamp: new Date().toISOString(),
      latencyMs: 0,
      modelUsed: "fallback-rules-engine",
      provider: "fallback",
      rawPromptContent: "Deterministic fallback evaluator rules engine",
      rawResponseContent: "N/A (Offline Fallback Evaluator)",
      stage1Check: stage1SubmissionCheck,
      stage2Failures: stage2CriticalFailures,
      wasDecisionOverridden: false,
      validatedDecision: isPass ? "pass" : "revise_and_resubmit",
      calculatedXp,
    },
  };
}

const SYSTEM_PROMPT = `You are an expert AI evaluator for educational workplace learning artifacts in the LTE framework.
You MUST follow the LTE Basic Rubric Model Starter Guide to evaluate the learner's submission in 3 stages:

Stage 1 - Submission check:
- Correct artifact submitted, required sections present, content readable.

Stage 2 - Critical failure check:
- Check for non-negotiable critical failures:
  1. Fabricated or invented evidence
  2. Unsupported confirmation presented as fact
  3. Unsafe or prohibited recommendation
  4. Action outside learner role or authority

Stage 3 - Criterion scoring:
Score exactly these 5 standard criteria from 0 to 3:
1. "Completeness" - All required sections, fields, or outputs are present.
2. "Accuracy" - Content matches supplied case evidence and instructions.
3. "Evidence use" - Sources or case evidence are correctly identified and used.
4. "Judgement" - Learner identifies gaps, risks, mismatches, or uncertainty.
5. "Next action" - Recommended action is appropriate for the learner role.

Scoring Scale per Criterion:
- 0: "Not demonstrated" (No valid evidence, missing response, or fundamentally incorrect)
- 1: "Partially demonstrated" (Some correct elements present, but important gaps remain)
- 2: "Demonstrated" (Meets expected task and level requirements)
- 3: "Strongly demonstrated" (Accurate, complete, and usable with clear judgement)

LTE Decision Rules:
- "pass": No critical failure AND every essential criterion scores at least 2.
- "revise_and_resubmit": One or more essential criteria score below 2, OR a correctable critical failure is found.
- "human_review": AI confidence is low, evidence is unclear, or safety/regulatory complexity is found.

You must respond ONLY with a valid JSON object matching this exact JSON schema:
{
  "overallScore": number (0 to 100 percentage based on sum of 5 criteria out of 15 max),
  "decision": "pass" | "revise_and_resubmit" | "human_review",
  "stage1SubmissionCheck": {
    "isAssessable": boolean,
    "notes": "string summary"
  },
  "stage2CriticalFailures": {
    "hasFailure": boolean,
    "failuresFound": ["string list of critical failures if any"]
  },
  "rubricRows": [
    {
      "label": "Completeness",
      "score": number (0 to 3),
      "maxScore": 3,
      "level": "Not demonstrated" | "Partially demonstrated" | "Demonstrated" | "Strongly demonstrated",
      "evidence": "string quote or citation from artifact",
      "tone": "success" | "warning" | "error",
      "feedback": "string criterion feedback"
    },
    {
      "label": "Accuracy",
      "score": number (0 to 3),
      "maxScore": 3,
      "level": "Not demonstrated" | "Partially demonstrated" | "Demonstrated" | "Strongly demonstrated",
      "evidence": "string quote or citation from artifact",
      "tone": "success" | "warning" | "error",
      "feedback": "string criterion feedback"
    },
    {
      "label": "Evidence use",
      "score": number (0 to 3),
      "maxScore": 3,
      "level": "Not demonstrated" | "Partially demonstrated" | "Demonstrated" | "Strongly demonstrated",
      "evidence": "string quote or citation from artifact",
      "tone": "success" | "warning" | "error",
      "feedback": "string criterion feedback"
    },
    {
      "label": "Judgement",
      "score": number (0 to 3),
      "maxScore": 3,
      "level": "Not demonstrated" | "Partially demonstrated" | "Demonstrated" | "Strongly demonstrated",
      "evidence": "string quote or citation from artifact",
      "tone": "success" | "warning" | "error",
      "feedback": "string criterion feedback"
    },
    {
      "label": "Next action",
      "score": number (0 to 3),
      "maxScore": 3,
      "level": "Not demonstrated" | "Partially demonstrated" | "Demonstrated" | "Strongly demonstrated",
      "evidence": "string quote or citation from artifact",
      "tone": "success" | "warning" | "error",
      "feedback": "string criterion feedback"
    }
  ],
  "feedback": "string overall feedback summary",
  "singleImprovementPoint": "string one clear actionable improvement point"
}

Output raw JSON only. Do not include markdown formatting or extra text.`;

export async function evaluateArtifactSubmission(
  env: Pick<LteEnv, "OPENROUTER_API_KEY">,
  input: ArtifactEvaluationInput,
): Promise<AIEvaluationResult> {
  const passingScore = input.passingScore ?? 60;
  const modelToUse = DEFAULT_OPENROUTER_MODEL;

  if (!env.OPENROUTER_API_KEY) {
    apiLogger.info("OPENROUTER_API_KEY not configured. Using deterministic fallback evaluator.");
    return generateFallbackEvaluation(input);
  }

  const promptContent = JSON.stringify({
    artifactType: input.artifactType,
    passingScore,
    attemptNo: input.attemptNo,
    questions: input.questions.map((q) => ({
      title: q.title,
      description: q.description,
      responseType: q.responseType,
    })),
    answers: input.answers.map((a) => ({
      questionId: a.questionId,
      textResponse: a.textResponse || null,
      urlResponse: a.urlResponse || null,
      fileName: a.fileName || null,
      fileContentSnippet: a.fileContentSnippet || null,
    })),
  });

  const requestPayload: OpenRouterChatRequest = {
    model: modelToUse,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Evaluate this learner artifact submission:\n${promptContent}` },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  };

  const startTime = performance.now();

  try {
    const rawContent = await callOpenRouterAI(env, requestPayload);
    const latencyMs = Math.round(performance.now() - startTime);
    const cleaned = rawContent.replace(/```(json)?/g, "").trim();
    const parsed = JSON.parse(cleaned) as {
      overallScore?: number;
      decision?: LteDecisionResult;
      stage1SubmissionCheck?: { isAssessable: boolean; notes: string };
      stage2CriticalFailures?: { hasFailure: boolean; failuresFound: string[] };
      rubricRows?: RubricCriterionResult[];
      feedback?: string;
      singleImprovementPoint?: string;
    };

    const fallback = generateFallbackEvaluation(input);
    const stage1SubmissionCheck = parsed.stage1SubmissionCheck || fallback.stage1SubmissionCheck;
    const stage2CriticalFailures = parsed.stage2CriticalFailures || fallback.stage2CriticalFailures;
    const rubricRows =
      Array.isArray(parsed.rubricRows) && parsed.rubricRows.length
        ? parsed.rubricRows
        : fallback.rubricRows;

    // False-positive prevention guardrails (Section 7 decision enforcement)
    const hasCriticalFailure =
      Boolean(stage2CriticalFailures.hasFailure) ||
      (stage2CriticalFailures.failuresFound && stage2CriticalFailures.failuresFound.length > 0);
    const hasSubparCriterion = rubricRows.some((r) => r.score < 2);
    const isSubmissionIncomplete = !stage1SubmissionCheck.isAssessable;

    let validatedDecision: LteDecisionResult =
      parsed.decision ||
      (hasSubparCriterion || hasCriticalFailure || isSubmissionIncomplete
        ? "revise_and_resubmit"
        : "pass");

    const wasDecisionOverridden =
      parsed.decision === "pass" &&
      (hasCriticalFailure || hasSubparCriterion || isSubmissionIncomplete);

    // Override AI hallucinated pass if criteria or critical failure rules are violated
    if (wasDecisionOverridden) {
      apiLogger.warn(
        "Overriding false-positive AI pass decision due to rubric/critical failure violation.",
      );
      validatedDecision = "revise_and_resubmit";
    }

    const isPass = validatedDecision === "pass";
    const isPractice = input.artifactType === "practice";
    const calculatedXp = calculateArtifactXp(isPass, isPractice, input.attemptNo);

    const debugTelemetry: AIDebugTelemetry = {
      timestamp: new Date().toISOString(),
      latencyMs,
      modelUsed: modelToUse,
      provider: "openrouter",
      rawPromptContent: `SYSTEM PROMPT:\n${SYSTEM_PROMPT}\n\nUSER SUBMISSION PAYLOAD:\n${promptContent}`,
      rawResponseContent: rawContent,
      stage1Check: stage1SubmissionCheck,
      stage2Failures: stage2CriticalFailures,
      wasDecisionOverridden,
      validatedDecision,
      calculatedXp,
    };

    apiLogger.info("[AI_DEBUG_FLOW] OpenRouter Evaluation Complete", {
      latencyMs: debugTelemetry.latencyMs,
      modelUsed: debugTelemetry.modelUsed,
      provider: debugTelemetry.provider,
      validatedDecision: debugTelemetry.validatedDecision,
      wasDecisionOverridden: debugTelemetry.wasDecisionOverridden,
      calculatedXp: debugTelemetry.calculatedXp,
    });

    return {
      overallScore: Math.min(100, Math.max(0, Number(parsed.overallScore) || (isPass ? 85 : 50))),
      passingScore,
      decision: validatedDecision,
      stage1SubmissionCheck,
      stage2CriticalFailures,
      rubricRows,
      feedback:
        parsed.feedback ||
        (isPass ? "Pass: All essential criteria demonstrated." : "Revise and resubmit required."),
      singleImprovementPoint: parsed.singleImprovementPoint || fallback.singleImprovementPoint,
      calculatedXp,
      modelUsed: modelToUse,
      provider: "openrouter",
      debugTelemetry,
    };
  } catch (error) {
    const latencyMs = Math.round(performance.now() - startTime);
    apiLogger.error(
      "Failed to run OpenRouter AI evaluation. Falling back to deterministic rules.",
      error,
    );
    const fallback = generateFallbackEvaluation(input);
    const fallbackTelemetry = fallback.debugTelemetry;
    return {
      ...fallback,
      debugTelemetry: fallbackTelemetry ? { ...fallbackTelemetry, latencyMs } : undefined,
    };
  }
}

export async function processAndSaveArtifactEvaluation(
  supabase: SupabaseClient,
  env: Pick<LteEnv, "OPENROUTER_API_KEY">,
  submissionId: string,
  input: ArtifactEvaluationInput,
  userId: string,
  moduleProgressId: string,
): Promise<AIEvaluationResult> {
  const evalResult = await evaluateArtifactSubmission(env, input);
  const now = new Date().toISOString();

  const overallStatus =
    evalResult.decision === "pass"
      ? "accepted"
      : evalResult.decision === "human_review"
        ? "human_review"
        : "resubmission_required";

  // 1. Update artifact_evaluation_flows table
  const { error: flowError } = await supabase.from("artifact_evaluation_flows").upsert(
    {
      submission_id: submissionId,
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
        calculated_xp: evalResult.calculatedXp,
        attempt_no: input.attemptNo,
        debug_telemetry: evalResult.debugTelemetry,
      },
      updated_at: now,
    },
    { onConflict: "submission_id,stage" },
  );

  if (flowError) apiLogger.error("Failed to save artifact evaluation flow", flowError);

  // 2. Update artifact_submissions table status
  const { error: subError } = await supabase
    .from("artifact_submissions")
    .update({
      status: overallStatus,
      sealed_at: evalResult.decision === "pass" ? now : null,
      updated_at: now,
    })
    .eq("id", submissionId);

  if (subError) apiLogger.error("Failed to update submission status", subError);

  // 3. Update user_module_progress in single payload
  const progressPayload: Record<string, unknown> = {
    artifact_approval_status: evalResult.decision === "pass" ? "approved" : overallStatus,
    updated_at: now,
    ...(evalResult.decision === "pass" && { artifact_submitted: true }),
    ...(evalResult.decision === "pass" &&
      input.artifactType !== "practice" && { module_status: "mastered" }),
  };

  await supabase.from("user_module_progress").update(progressPayload).eq("id", moduleProgressId);

  // 4. Award AI-determined XP via xp-engine
  const eventType =
    input.artifactType === "practice"
      ? evalResult.decision === "pass"
        ? "practice_artifact_accepted"
        : "practice_artifact_failed"
      : evalResult.decision === "pass"
        ? input.attemptNo === 1
          ? "final_artifact_accepted_1"
          : input.attemptNo === 2
            ? "final_artifact_accepted_2"
            : "final_artifact_accepted_3"
        : "final_artifact_failed";

  await awardXp(
    supabase,
    userId,
    eventType,
    "artifact_submissions",
    submissionId,
    {
      score: evalResult.overallScore,
      attempt_no: input.attemptNo,
      provider: evalResult.provider,
    },
    evalResult.calculatedXp,
  );

  return evalResult;
}
