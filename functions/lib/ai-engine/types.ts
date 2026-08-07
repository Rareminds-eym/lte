export type LteCriterionLabel =
  | "Completeness"
  | "Accuracy"
  | "Evidence use"
  | "Judgement"
  | "Next action";

export type LtePerformanceLevel =
  | "Not demonstrated"
  | "Partially demonstrated"
  | "Demonstrated"
  | "Strongly demonstrated";

export interface RubricCriterionResult {
  label: LteCriterionLabel | string;
  score: number; // 0 to 3
  maxScore: number; // 3
  level: LtePerformanceLevel;
  evidence: string; // evidence citation from submission
  tone: "success" | "warning" | "error";
  feedback?: string;
}

export type LteDecisionResult = "pass" | "revise_and_resubmit" | "human_review";

export interface CriticalFailureCheckResult {
  hasFailure: boolean;
  failuresFound: string[];
}

export interface SubmissionCheckResult {
  isAssessable: boolean;
  notes: string;
}

export interface AIDebugTelemetry {
  provider: "openrouter" | "fallback";
  latencyMs: number | null;
  modelUsed: string;
  timestamp: string;
  stage1Check: SubmissionCheckResult;
  stage2Failures: CriticalFailureCheckResult;
  calculatedXp: number;
  rawPromptContent: string | null;
  rawResponseContent: string | null;
  validatedDecision: LteDecisionResult;
  wasDecisionOverridden: boolean;
  extractionCharCounts: Record<string, number>;
  promptCharCount: number | null;
}

export interface AIEvaluationResult {
  overallScore: number; // percentage 0-100
  passingScore: number;
  decision: LteDecisionResult;
  stage1SubmissionCheck: SubmissionCheckResult;
  stage2CriticalFailures: CriticalFailureCheckResult;
  rubricRows: RubricCriterionResult[];
  feedback: string;
  singleImprovementPoint: string;
  calculatedXp: number;
  modelUsed: string;
  provider: "openrouter" | "fallback";
  debugTelemetry?: AIDebugTelemetry;
}

export interface ArtifactEvaluationInput {
  artifactId: string;
  artifactType: "practice" | "final";
  passingScore: number | null;
  totalScore: number;
  questions: Array<{
    id: string;
    title: string;
    description: string;
    responseType: "text" | "file" | "url";
    instructions?: Record<string, unknown> | string | null;
  }>;
  answers: Array<{
    questionId: string;
    textResponse?: string;
    urlResponse?: string;
    fileName?: string;
    fileContentSnippet?: string;
  }>;
  attemptNo: number;
}
