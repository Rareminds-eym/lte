/** Shared service policy; these are evidence criteria, not AI usage quotas. */
export const LEARNING_POLICY = {
  maxRequestedLevels: 100,
  maxSnapshotLevels: 500,
  maxRecommendationLevels: 50,
  maxCapabilityNameChars: 300,
  maxLevelTitleChars: 500,
  minLevelNumber: 1,
  maxLevelNumber: 5,
  minEvidenceChars: 200,
  maxEvidenceChars: 10_000,
  maxEvaluationBytes: 65_536,
  maxFeedbackChars: 4_000,
  passingScore: 60,
  minimumConfidence: 60,
  totalScore: 15,
  rubricSize: 5,
  minimumRubricScore: 2,
  deliveryConcurrency: 5,
  claimBatchSize: 25,
} as const;
export const LEARNING_MESSAGES = {
  invalidQualification: "Invalid qualification request",
  invalidRecommendationSummary: "Invalid learning summary request.",
  evaluationPolicyChanged: "Learning evaluation policy changed.",
  unavailable: "Qualification evidence unavailable",
  invalidEvidence: "Provide assessable evidence content.",
  changed: "Learning content changed.",
  changedDuringEvaluation: "Learning content changed during evaluation.",
  criteriaUnavailable: "Learning criteria unavailable.",
  maintenanceFailed: "One or more learning maintenance tasks failed.",
  deliveryFailed: "Learning progress delivery failed.",
} as const;
export const EQUIVALENCE_INSTRUCTION =
  "Evaluate the actual submitted work, not claims of holding a credential or unvisited external links.";
