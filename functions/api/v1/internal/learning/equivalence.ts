import { evaluateArtifactSubmission } from "@functions/lib/artifact-evaluator";
import { internalEndpoint } from "@functions/lib/catalog/internal-auth";
import { learningCriteriaPolicy, learningSnapshotPolicy } from "@functions/lib/learningQueries";
import { createServiceQueryGateway } from "@functions/lib/query-gateway";
import {
  equivalenceRequestSchema,
  learningCriteriaSchema,
  learningSnapshotSchema,
} from "@functions/schemas/learning";
import {
  EQUIVALENCE_INSTRUCTION,
  LEARNING_MESSAGES,
  LEARNING_POLICY,
} from "@functions/shared/learningConfig";
/** Reuses the validated LTE evaluator; links/claims alone cannot receive credit. */
export const onRequestPost = internalEndpoint(async (context, body, correlation) => {
  const parsed = equivalenceRequestSchema.safeParse(JSON.parse(body));
  if (!parsed.success)
    return Response.json({ error: LEARNING_MESSAGES.invalidEvidence }, { status: 400 });
  const qb = createServiceQueryGateway(context.env, correlation),
    r = parsed.data;
  const before = learningSnapshotSchema.parse(
    await qb.rpc(learningSnapshotPolicy, {
      args: { p_user: null, p_levels: [r.levelId], p_policy: "human" },
    }),
  );
  const current = before.levels[0];
  if (!current || current.fingerprint !== r.fingerprint)
    return Response.json({ error: LEARNING_MESSAGES.changed }, { status: 409 });
  const level = learningCriteriaSchema.parse(
    await qb.read(learningCriteriaPolicy, {
      filters: [{ column: "id", op: "eq", value: r.levelId }],
      result: "maybeSingle",
    }),
  );
  const result = await evaluateArtifactSubmission(context.env, {
    artifactId: r.levelId,
    artifactType: "final",
    passingScore: LEARNING_POLICY.passingScore,
    totalScore: LEARNING_POLICY.totalScore,
    attemptNo: 1,
    questions: [
      {
        id: r.levelId,
        title: level.title,
        description: `Demonstrate the published level outcomes: ${level.description || ""}. Observable behaviors: ${JSON.stringify(level.observable_behavior || {})}. ${EQUIVALENCE_INSTRUCTION}`,
        responseType: "text",
      },
    ],
    answers: [{ questionId: r.levelId, textResponse: r.evidenceContent }],
    evaluationContext: {
      capabilityName: current.capabilityName,
      levelTitle: level.title,
      observableBehavior: level.observable_behavior,
    },
  });
  const after = learningSnapshotSchema.parse(
    await qb.rpc(learningSnapshotPolicy, {
      args: { p_user: null, p_levels: [r.levelId], p_policy: "human" },
    }),
  );
  if (after.levels[0]?.fingerprint !== r.fingerprint)
    return Response.json({ error: LEARNING_MESSAGES.changedDuringEvaluation }, { status: 409 });
  const reliable =
    result.provider === "openrouter" &&
    result.evaluationSource === "ai" &&
    !result.requiresManualReview &&
    result.confidence >= LEARNING_POLICY.minimumConfidence &&
    result.decision !== "human_review";
  const approved =
    reliable &&
    result.decision === "pass" &&
    result.confidence >= LEARNING_POLICY.minimumConfidence &&
    result.stage1SubmissionCheck.isAssessable &&
    !result.stage2CriticalFailures.hasFailure &&
    result.rubricRows.length === LEARNING_POLICY.rubricSize &&
    result.rubricRows.every(
      (row) => row.score >= LEARNING_POLICY.minimumRubricScore && row.evidenceValid,
    );
  return Response.json({
    decision: approved ? "approved" : reliable ? "rejected" : "pending",
    feedback: result.feedback.slice(0, LEARNING_POLICY.maxFeedbackChars),
    model: result.modelUsed,
    score: result.overallScore,
    fingerprint: r.fingerprint,
  });
}, LEARNING_POLICY.maxEvaluationBytes);
