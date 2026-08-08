import { describe, expect, it } from "vitest";
import {
  AI_RESPONSE_SCHEMA,
  deriveTone,
  enforceValidatedDecision,
  recomputeOverallScore,
  validateRubricEvidence,
} from "../response-schema";

const makeRows = (score = 3, evidence = "operational constraints") =>
  (["Completeness", "Accuracy", "Evidence use", "Judgement", "Next action"] as const).map(
    (label) => ({
      label,
      score,
      maxScore: 3 as const,
      level: "Strongly demonstrated" as const,
      evidence,
      tone: "success" as const,
      evidenceValid: true,
    }),
  );

describe("recomputeOverallScore", () => {
  it("returns 100 for five perfect rows", () => {
    expect(recomputeOverallScore(makeRows(3))).toBe(100);
  });

  it("returns 0 for all-zero rows", () => {
    expect(recomputeOverallScore(makeRows(0))).toBe(0);
  });

  it("rounds mixed scores deterministically (3,2,1,0,3 -> 60)", () => {
    const scores = [3, 2, 1, 0, 3];
    const rows = makeRows().map((r, i) => ({ ...r, score: scores[i] ?? r.score }));
    expect(recomputeOverallScore(rows)).toBe(60);
  });

  it("ignores model arithmetic entirely (90 reported, rows say 100)", () => {
    expect(recomputeOverallScore(makeRows(3))).toBe(100);
  });
});

describe("validateRubricEvidence", () => {
  const answers = [
    { questionId: "q-1", textResponse: "The incident log shows a High risk rating." },
    {
      questionId: "q-2",
      fileName: "register.xlsx",
      fileContentSnippet: "Header: claim id | claim text\nRow 2: claim id=C-001",
    },
  ];

  it("accepts evidence found verbatim in a textResponse", () => {
    const { rows, failed } = validateRubricEvidence(makeRows(3, "incident log shows"), answers);
    expect(failed).toBe(false);
    expect(rows.every((r) => r.evidenceValid)).toBe(true);
  });

  it("accepts evidence found verbatim in a fileContentSnippet", () => {
    const { rows, failed } = validateRubricEvidence(makeRows(3, "claim id=C-001"), answers);
    expect(failed).toBe(false);
    expect(rows.every((r) => r.evidenceValid)).toBe(true);
  });

  it("rejects fabricated evidence: blanks it, zeroes the score, flags invalid", () => {
    const { rows, failed } = validateRubricEvidence(
      makeRows(3, "this text does not exist anywhere"),
      answers,
    );
    expect(failed).toBe(true);
    expect(rows.every((r) => r.evidence === "" && r.score === 0 && r.evidenceValid === false)).toBe(
      true,
    );
  });

  it.each([
    "",
    "e",
    "N/A",
    "None",
    "n/a",
    "na",
  ])("rejects banned placeholder evidence %j", (evidence) => {
    const { rows, failed } = validateRubricEvidence(makeRows(3, evidence), answers);
    expect(failed).toBe(true);
    expect(rows.every((r) => r.evidence === "")).toBe(true);
  });

  it("treats evidence as invalid when there is no submission content at all", () => {
    const { rows, failed } = validateRubricEvidence(makeRows(3, "anything"), []);
    expect(failed).toBe(true);
    expect(rows.every((r) => r.evidenceValid === false)).toBe(true);
  });
});

describe("enforceValidatedDecision", () => {
  const base = {
    llmDecision: "pass" as const,
    confidence: 90,
    evidenceFailed: false,
    hasCriticalFailure: false,
    hasSubparCriterion: false,
    isAssessable: true,
  };

  it("keeps the LLM decision when every validation rule passes", () => {
    expect(enforceValidatedDecision(base)).toBe("pass");
  });

  it("routes to human_review when confidence is below 60", () => {
    expect(enforceValidatedDecision({ ...base, confidence: 59 })).toBe("human_review");
  });

  it("routes to human_review when the submission is unassessable", () => {
    expect(enforceValidatedDecision({ ...base, isAssessable: false })).toBe("human_review");
  });

  it("forces revise_and_resubmit when a criterion scores below 2", () => {
    expect(enforceValidatedDecision({ ...base, hasSubparCriterion: true })).toBe(
      "revise_and_resubmit",
    );
  });

  it("forces revise_and_resubmit when a critical failure is found", () => {
    expect(enforceValidatedDecision({ ...base, hasCriticalFailure: true })).toBe(
      "revise_and_resubmit",
    );
  });

  it("forces revise_and_resubmit when evidence validation failed", () => {
    expect(enforceValidatedDecision({ ...base, evidenceFailed: true })).toBe("revise_and_resubmit");
  });

  it("applies spec order: low confidence overrides a subpar criterion (human_review)", () => {
    expect(enforceValidatedDecision({ ...base, confidence: 40, hasSubparCriterion: true })).toBe(
      "human_review",
    );
  });

  it("applies spec order: low confidence overrides a critical failure (human_review)", () => {
    expect(enforceValidatedDecision({ ...base, confidence: 40, hasCriticalFailure: true })).toBe(
      "human_review",
    );
  });

  it("applies spec order: evidence-failed (last rule) overrides low confidence (revise)", () => {
    expect(enforceValidatedDecision({ ...base, confidence: 40, evidenceFailed: true })).toBe(
      "revise_and_resubmit",
    );
  });

  it("applies spec order: unassessable overrides low confidence (human_review)", () => {
    expect(enforceValidatedDecision({ ...base, confidence: 40, isAssessable: false })).toBe(
      "human_review",
    );
  });
});

describe("deriveTone", () => {
  it("maps score 0 to error", () => {
    expect(deriveTone(0)).toBe("error");
  });

  it("maps score 1 to warning", () => {
    expect(deriveTone(1)).toBe("warning");
  });

  it.each([2, 3])("maps score %i to success", (score) => {
    expect(deriveTone(score)).toBe("success");
  });
});

describe("AI_RESPONSE_SCHEMA", () => {
  const rowLabels = ["Completeness", "Accuracy", "Evidence use", "Judgement", "Next action"];

  const makeSchemaRows = (): Array<Record<string, unknown>> =>
    rowLabels.map((label) => ({
      label,
      score: 3,
      maxScore: 3,
      level: "Strongly demonstrated",
      evidence: "operational constraints",
      tone: "success",
    }));

  const validPayload = () => ({
    overallScore: 100,
    confidence: 90,
    decision: "pass",
    stage1SubmissionCheck: { isAssessable: true, notes: "ok" },
    stage2CriticalFailures: { hasFailure: false, failuresFound: [] },
    rubricRows: makeSchemaRows(),
    feedback: "Good",
    singleImprovementPoint: "Keep going",
  });

  it("accepts a valid response", () => {
    expect(AI_RESPONSE_SCHEMA.safeParse(validPayload()).success).toBe(true);
  });

  it.each(["critical", "neutral", ""])("rejects invalid tone %j", (tone) => {
    const payload = validPayload();
    payload.rubricRows = payload.rubricRows.map((r) => ({ ...r, tone }));
    expect(AI_RESPONSE_SCHEMA.safeParse(payload).success).toBe(false);
  });

  it.each(["Brilliant", "None", ""])("rejects invalid level %j", (level) => {
    const payload = validPayload();
    payload.rubricRows = payload.rubricRows.map((r) => ({ ...r, level }));
    expect(AI_RESPONSE_SCHEMA.safeParse(payload).success).toBe(false);
  });

  it.each(["fail", "Pass", "approved"])("rejects invalid decision %j", (decision) => {
    expect(AI_RESPONSE_SCHEMA.safeParse({ ...validPayload(), decision }).success).toBe(false);
  });

  it.each([150, -5, "high", null])("rejects invalid confidence %j", (confidence) => {
    expect(AI_RESPONSE_SCHEMA.safeParse({ ...validPayload(), confidence }).success).toBe(false);
  });

  it.each([101, -1, "90"])("rejects invalid overallScore %j", (overallScore) => {
    expect(AI_RESPONSE_SCHEMA.safeParse({ ...validPayload(), overallScore }).success).toBe(false);
  });

  it("rejects a missing rubric row", () => {
    const payload = validPayload();
    payload.rubricRows = payload.rubricRows.slice(0, 4);
    expect(AI_RESPONSE_SCHEMA.safeParse(payload).success).toBe(false);
  });

  it("rejects an extra rubric row", () => {
    const payload = validPayload();
    payload.rubricRows = [...payload.rubricRows, payload.rubricRows[0] ?? {}];
    expect(AI_RESPONSE_SCHEMA.safeParse(payload).success).toBe(false);
  });

  it("rejects duplicate criterion labels", () => {
    const payload = validPayload();
    payload.rubricRows = payload.rubricRows.map((r, i) => ({
      ...r,
      label: ["Completeness", "Completeness", "Accuracy", "Evidence use", "Judgement"][i],
    }));
    expect(AI_RESPONSE_SCHEMA.safeParse(payload).success).toBe(false);
  });

  it("rejects an unknown criterion label", () => {
    const payload = validPayload();
    payload.rubricRows = payload.rubricRows.map((r) => ({ ...r, label: "Creativity" }));
    expect(AI_RESPONSE_SCHEMA.safeParse(payload).success).toBe(false);
  });

  it.each([4, -1, 1.5, "3"])("rejects out-of-bounds score %j", (score) => {
    const payload = validPayload();
    payload.rubricRows = payload.rubricRows.map((r) => ({ ...r, score }));
    expect(AI_RESPONSE_SCHEMA.safeParse(payload).success).toBe(false);
  });

  it("rejects a maxScore other than 3", () => {
    const payload = validPayload();
    payload.rubricRows = payload.rubricRows.map((r) => ({ ...r, maxScore: 5 }));
    expect(AI_RESPONSE_SCHEMA.safeParse(payload).success).toBe(false);
  });

  it("rejects missing top-level fields", () => {
    const { rubricRows: _rubricRows, ...rest } = validPayload();
    expect(AI_RESPONSE_SCHEMA.safeParse(rest).success).toBe(false);
  });

  it("rejects a response without stage1SubmissionCheck", () => {
    const { stage1SubmissionCheck: _stage1, ...rest } = validPayload();
    expect(AI_RESPONSE_SCHEMA.safeParse(rest).success).toBe(false);
  });

  it("rejects a response without stage2CriticalFailures", () => {
    const { stage2CriticalFailures: _stage2, ...rest } = validPayload();
    expect(AI_RESPONSE_SCHEMA.safeParse(rest).success).toBe(false);
  });
});
