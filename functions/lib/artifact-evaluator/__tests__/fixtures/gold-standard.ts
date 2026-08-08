/**
 * Gold-standard fixtures for the evaluation regression suite (Phase 3).
 *
 * Each fixture pins: input → raw model response → expected *validated*
 * output. The model response is canned (no provider calls) and intentionally
 * contains the adversarial cases the backend must fix: wrong arithmetic,
 * fabricated evidence, decisions that contradict the rubric. The suite
 * (gold-standard.test.ts) fails when prompt/template/validation changes move
 * any pinned field, so every evaluation change is reviewed against the
 * expected outcome instead of silently re-baselining.
 */
import type { ArtifactEvaluationInput } from "../../types";

export interface GoldStandardFixture {
  name: string;
  input: ArtifactEvaluationInput;
  modelRawResponse: string;
  expected: {
    decision: "pass" | "revise_and_resubmit" | "human_review";
    overallScore: number;
    confidence: number;
    evidenceValid: boolean;
  };
}

const textInput: ArtifactEvaluationInput = {
  artifactId: "gold-art-1",
  artifactType: "final",
  passingScore: 60,
  totalScore: 100,
  questions: [
    {
      id: "q-1",
      title: "Problem Analysis",
      description: "Analyze the root causes of the operational bottleneck.",
      responseType: "text",
    },
  ],
  answers: [
    {
      questionId: "q-1",
      textResponse:
        "The bottleneck is upstream capacity: the intake queue sustained 14,000 records/day " +
        "against a 10,000 capacity. Root causes are shift staffing (7 agents) and batch " +
        "processing every 30 minutes. Recommendation: raise batch frequency to 10 minutes.",
    },
  ],
  attemptNo: 1,
};

const fivePerfectRows = [
  {
    label: "Completeness",
    score: 3,
    maxScore: 3,
    level: "Strongly demonstrated",
    evidence: "14,000 records/day",
    tone: "success",
  },
  {
    label: "Accuracy",
    score: 3,
    maxScore: 3,
    level: "Strongly demonstrated",
    evidence: "10,000 capacity",
    tone: "success",
  },
  {
    label: "Evidence use",
    score: 3,
    maxScore: 3,
    level: "Strongly demonstrated",
    evidence: "7 agents",
    tone: "success",
  },
  {
    label: "Judgement",
    score: 3,
    maxScore: 3,
    level: "Strongly demonstrated",
    evidence: "30 minutes",
    tone: "success",
  },
  {
    label: "Next action",
    score: 3,
    maxScore: 3,
    level: "Strongly demonstrated",
    evidence: "10 minutes",
    tone: "success",
  },
];

const reviseInput: ArtifactEvaluationInput = {
  ...textInput,
  answers: [
    {
      questionId: "q-1",
      textResponse:
        "The intake queue handles records in batches and agents process them in shifts.",
    },
  ],
};

const reviseRows = [
  {
    label: "Completeness",
    score: 3,
    maxScore: 3,
    level: "Strongly demonstrated",
    evidence: "records in batches",
    tone: "success",
  },
  {
    label: "Accuracy",
    score: 1,
    maxScore: 3,
    level: "Partially demonstrated",
    evidence: "records in batches",
    tone: "warning",
  },
  {
    label: "Evidence use",
    score: 3,
    maxScore: 3,
    level: "Strongly demonstrated",
    evidence: "agents process them in shifts",
    tone: "success",
  },
  {
    label: "Judgement",
    score: 3,
    maxScore: 3,
    level: "Strongly demonstrated",
    evidence: "records in batches",
    tone: "success",
  },
  {
    label: "Next action",
    score: 3,
    maxScore: 3,
    level: "Strongly demonstrated",
    evidence: "agents process them in shifts",
    tone: "success",
  },
];

const fabricatedEvidenceInput: ArtifactEvaluationInput = {
  ...textInput,
  answers: [
    { questionId: "q-1", textResponse: "Bottleneck resolved by adding a second intake lane." },
  ],
};

const fabricatedRows = [
  {
    label: "Completeness",
    score: 3,
    maxScore: 3,
    level: "Strongly demonstrated",
    evidence: "incident log 2026-07",
    tone: "success",
  },
  {
    label: "Accuracy",
    score: 3,
    maxScore: 3,
    level: "Strongly demonstrated",
    evidence: "incident log 2026-07",
    tone: "success",
  },
  {
    label: "Evidence use",
    score: 3,
    maxScore: 3,
    level: "Strongly demonstrated",
    evidence: "incident log 2026-07",
    tone: "success",
  },
  {
    label: "Judgement",
    score: 3,
    maxScore: 3,
    level: "Strongly demonstrated",
    evidence: "incident log 2026-07",
    tone: "success",
  },
  {
    label: "Next action",
    score: 3,
    maxScore: 3,
    level: "Strongly demonstrated",
    evidence: "incident log 2026-07",
    tone: "success",
  },
];

export const goldStandardFixtures: GoldStandardFixture[] = [
  {
    // Model arithmetic says 100; rubric rows recompute to 100 too (5x3/15).
    // Model claims pass with confidence 90; both survive validation.
    name: "pass with correct arithmetic and verbatim evidence",
    input: textInput,
    modelRawResponse: JSON.stringify({
      overallScore: 100,
      confidence: 90,
      decision: "pass",
      stage1SubmissionCheck: { isAssessable: true, notes: "ok" },
      stage2CriticalFailures: { hasFailure: false, failuresFound: [] },
      rubricRows: fivePerfectRows,
      feedback: "Well structured.",
      singleImprovementPoint: "Keep it up.",
    }),
    expected: { decision: "pass", overallScore: 100, confidence: 90, evidenceValid: true },
  },
  {
    // Model says pass with confidence 90, but a criterion scores 1 -> the
    // backend must force revise_and_resubmit and recompute the score.
    name: "revise forced when a criterion scores below 2",
    input: reviseInput,
    modelRawResponse: JSON.stringify({
      overallScore: 90,
      confidence: 90,
      decision: "pass",
      stage1SubmissionCheck: { isAssessable: true, notes: "ok" },
      stage2CriticalFailures: { hasFailure: false, failuresFound: [] },
      rubricRows: reviseRows,
      feedback: "Nearly there.",
      singleImprovementPoint: "Add numbers.",
    }),
    expected: {
      decision: "revise_and_resubmit",
      overallScore: 87,
      confidence: 90,
      evidenceValid: true,
    },
  },
  {
    // Evidence cites "incident log 2026-07" which is nowhere in the answer;
    // the backend must blank it, zero the row scores, and force revise.
    name: "fabricated evidence is rejected and forces revise",
    input: fabricatedEvidenceInput,
    modelRawResponse: JSON.stringify({
      overallScore: 100,
      confidence: 95,
      decision: "pass",
      stage1SubmissionCheck: { isAssessable: true, notes: "ok" },
      stage2CriticalFailures: { hasFailure: false, failuresFound: [] },
      rubricRows: fabricatedRows,
      feedback: "Great evidence.",
      singleImprovementPoint: "Nothing.",
    }),
    expected: {
      decision: "revise_and_resubmit",
      overallScore: 0,
      confidence: 95,
      evidenceValid: false,
    },
  },
  {
    // Model confidence 50 (below the 60 floor) with otherwise clean rows:
    // decision must be human_review, score stays 100.
    name: "low confidence routes to human_review",
    input: textInput,
    modelRawResponse: JSON.stringify({
      overallScore: 100,
      confidence: 50,
      decision: "pass",
      stage1SubmissionCheck: { isAssessable: true, notes: "ok" },
      stage2CriticalFailures: { hasFailure: false, failuresFound: [] },
      rubricRows: fivePerfectRows,
      feedback: "Looks good.",
      singleImprovementPoint: "Nothing.",
    }),
    expected: { decision: "human_review", overallScore: 100, confidence: 50, evidenceValid: true },
  },
];
