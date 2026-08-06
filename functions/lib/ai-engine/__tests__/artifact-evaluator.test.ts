import { describe, expect, it } from "vitest";
import { evaluateArtifactSubmission, generateFallbackEvaluation } from "../artifact-evaluator";
import type { ArtifactEvaluationInput } from "../types";

describe("ai-engine / artifact-evaluator", () => {
  const sampleInput: ArtifactEvaluationInput = {
    artifactId: "art-1",
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
        textResponse: "Detailed analysis showing operational constraints and throughput metrics.",
      },
    ],
    attemptNo: 1,
  };

  describe("generateFallbackEvaluation", () => {
    it("generates passing score and 5 LTE criteria for valid answers", () => {
      const result = generateFallbackEvaluation(sampleInput);
      expect(result.overallScore).toBeGreaterThanOrEqual(60);
      expect(result.decision).toBe("pass");
      expect(result.calculatedXp).toBe(20);
      expect(result.provider).toBe("fallback");
      expect(result.rubricRows).toHaveLength(5);
      expect(result.rubricRows.map((r) => r.label)).toEqual([
        "Completeness",
        "Accuracy",
        "Evidence use",
        "Judgement",
        "Next action",
      ]);
    });

    it("calculates lower XP for attempt 2", () => {
      const result = generateFallbackEvaluation({ ...sampleInput, attemptNo: 2 });
      expect(result.calculatedXp).toBe(15);
    });

    it("calculates revise_and_resubmit decision for empty answers", () => {
      const result = generateFallbackEvaluation({ ...sampleInput, answers: [] });
      expect(result.overallScore).toBe(50);
      expect(result.decision).toBe("revise_and_resubmit");
      expect(result.calculatedXp).toBe(1);
    });
  });

  describe("evaluateArtifactSubmission", () => {
    it("uses fallback evaluator when OPENROUTER_API_KEY is missing", async () => {
      const result = await evaluateArtifactSubmission({}, sampleInput);
      expect(result.provider).toBe("fallback");
      expect(result.overallScore).toBeGreaterThanOrEqual(60);
      expect(result.rubricRows).toHaveLength(5);
    });
  });
});
