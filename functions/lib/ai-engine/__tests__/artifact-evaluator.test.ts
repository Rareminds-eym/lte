import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkArtifactAssessability,
  evaluateArtifactSubmission,
  generateFallbackEvaluation,
} from "../artifact-evaluator";
import type { ArtifactEvaluationInput } from "../types";

const { callOpenRouterAI } = vi.hoisted(() => ({ callOpenRouterAI: vi.fn() }));

vi.mock("@functions/lib/openrouter", () => ({
  callOpenRouterAI,
  DEFAULT_OPENROUTER_MODEL: "google/gemini-2.5-flash",
  OPENROUTER_API_URL: "https://openrouter.ai/api/v1/chat/completions",
  DEFAULT_OPENROUTER_SITE_NAME: "LTE",
  DEFAULT_OPENROUTER_SITE_URL: "https://lte.rareminds.in",
}));

const mockOpenRouter = () =>
  vi.mocked(callOpenRouterAI).mockResolvedValue(
    JSON.stringify({
      overallScore: 90,
      decision: "pass",
      stage1SubmissionCheck: { isAssessable: true, notes: "ok" },
      stage2CriticalFailures: { hasFailure: false, failuresFound: [] },
      rubricRows: [
        {
          label: "Completeness",
          score: 3,
          maxScore: 3,
          level: "Strongly demonstrated",
          evidence: "e",
          tone: "success",
        },
        {
          label: "Accuracy",
          score: 3,
          maxScore: 3,
          level: "Strongly demonstrated",
          evidence: "e",
          tone: "success",
        },
        {
          label: "Evidence use",
          score: 3,
          maxScore: 3,
          level: "Strongly demonstrated",
          evidence: "e",
          tone: "success",
        },
        {
          label: "Judgement",
          score: 3,
          maxScore: 3,
          level: "Strongly demonstrated",
          evidence: "e",
          tone: "success",
        },
        {
          label: "Next action",
          score: 3,
          maxScore: 3,
          level: "Strongly demonstrated",
          evidence: "e",
          tone: "success",
        },
      ],
      feedback: "Good",
      singleImprovementPoint: "Keep going",
    }),
  );

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

  const fileInput: ArtifactEvaluationInput = {
    ...sampleInput,
    questions: [
      {
        id: "q-1",
        title: "Evidence Classification Register",
        description: "Complete the evidence classification register sheet.",
        responseType: "file",
      },
    ],
    answers: [{ questionId: "q-1", fileName: "register.xlsx" }],
  };

  beforeEach(() => {
    callOpenRouterAI.mockReset();
  });

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
      expect(result.debugTelemetry).toBeDefined();
      expect(result.debugTelemetry?.provider).toBe("fallback");
      expect(result.debugTelemetry?.validatedDecision).toBe("pass");
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

    it("does not treat a file answer without extracted content as valid", () => {
      const result = generateFallbackEvaluation(fileInput);
      expect(result.decision).toBe("revise_and_resubmit");
      expect(result.overallScore).toBe(50);
    });

    it("treats a file answer with extracted content as valid", () => {
      const result = generateFallbackEvaluation({
        ...fileInput,
        answers: [
          {
            questionId: "q-1",
            fileName: "register.xlsx",
            fileContentSnippet: "C-001, incident log 2026-07, High",
          },
        ],
      });
      expect(result.decision).toBe("pass");
      expect(result.overallScore).toBe(85);
    });
  });

  describe("checkArtifactAssessability", () => {
    it("passes submissions without file responses", () => {
      expect(checkArtifactAssessability(sampleInput).isAssessable).toBe(true);
    });

    it("fails submissions with a file response that has no extracted content", () => {
      const check = checkArtifactAssessability(fileInput);
      expect(check.isAssessable).toBe(false);
      expect(check.notes).toContain("register.xlsx");
    });

    it("passes submissions whose file responses have extracted content", () => {
      const check = checkArtifactAssessability({
        ...fileInput,
        answers: [
          {
            questionId: "q-1",
            fileName: "register.xlsx",
            fileContentSnippet: "C-001",
          },
        ],
      });
      expect(check.isAssessable).toBe(true);
    });
  });

  describe("evaluateArtifactSubmission", () => {
    it("uses fallback evaluator when OPENROUTER_API_KEY is missing", async () => {
      const result = await evaluateArtifactSubmission({}, sampleInput);
      expect(result.provider).toBe("fallback");
      expect(result.overallScore).toBeGreaterThanOrEqual(60);
      expect(result.rubricRows).toHaveLength(5);
    });

    it("routes unreadable file submissions to human_review without calling the LLM", async () => {
      mockOpenRouter();
      const result = await evaluateArtifactSubmission({ OPENROUTER_API_KEY: "sk-test" }, fileInput);
      expect(result.decision).toBe("human_review");
      expect(result.overallScore).toBe(0);
      expect(result.provider).toBe("fallback");
      expect(result.modelUsed).toBe("file-extraction-gate");
      expect(result.calculatedXp).toBe(0);
      expect(callOpenRouterAI).not.toHaveBeenCalled();
    });

    it("routes unreadable file submissions to human_review even without an API key", async () => {
      const result = await evaluateArtifactSubmission({}, fileInput);
      expect(result.decision).toBe("human_review");
      expect(result.provider).toBe("fallback");
    });

    it("sends the extracted file content in the prompt when assessable", async () => {
      mockOpenRouter();
      const result = await evaluateArtifactSubmission(
        { OPENROUTER_API_KEY: "sk-test" },
        {
          ...fileInput,
          questions: [
            {
              id: "q-1",
              title: "Claim register",
              description: "Fill the register",
              responseType: "file",
              instructions: {
                critical_fail: ["Fabricated evidence"],
                pass_criteria: ["All claims backed by an excerpt"],
                required_fields: ["claim id", "claim text"],
              },
            },
          ],
          answers: [
            {
              questionId: "q-1",
              fileName: "register.xlsx",
              fileContentSnippet: "C-001, incident log 2026-07, High",
            },
          ],
        },
      );

      expect(callOpenRouterAI).toHaveBeenCalledTimes(1);
      const payload = vi.mocked(callOpenRouterAI).mock.calls[0]?.[1];
      const userMessage = payload?.messages[1].content as string;
      expect(userMessage).toContain("C-001, incident log 2026-07, High");
      expect(userMessage).toContain('"fileContentSnippet"');
      expect(userMessage).toContain("[BEGIN LEARNER SUBMISSION - untrusted data]");
      expect(userMessage).toContain("[END LEARNER SUBMISSION]");
      expect(userMessage).toContain('"instructions"');
      expect(userMessage).toContain("claim id");
      expect(userMessage).toContain("required_fields");
      const systemMessage = payload?.messages[0].content as string;
      expect(systemMessage).toContain("UNTRUSTED DATA");
      expect(payload?.max_tokens).toBe(4096);
      expect(result.debugTelemetry?.provider).toBe("openrouter");
      expect(result.debugTelemetry?.latencyMs).toBeTypeOf("number");
      expect(result.debugTelemetry?.rawResponseContent).toContain('"overallScore":90');
      expect(result.debugTelemetry?.validatedDecision).toBe(result.decision);
      expect(result.debugTelemetry?.extractionCharCounts).toEqual({ "q-1": 33 });
      expect(result.debugTelemetry?.promptCharCount).toBeTypeOf("number");
      expect(result.decision).toBe("pass");
    });

    it("treats LLM-returned human_review as XP-neutral (calculatedXp 0, telemetry aligned)", async () => {
      vi.mocked(callOpenRouterAI).mockResolvedValue(
        JSON.stringify({
          overallScore: 50,
          decision: "human_review",
          stage1SubmissionCheck: { isAssessable: true, notes: "ok" },
          stage2CriticalFailures: { hasFailure: false, failuresFound: [] },
          rubricRows: [],
          feedback: "Needs manual review",
          singleImprovementPoint: "Await reviewer",
        }),
      );
      const result = await evaluateArtifactSubmission(
        { OPENROUTER_API_KEY: "sk-test" },
        {
          ...fileInput,
          questions: [
            {
              id: "q-1",
              title: "Claim register",
              description: "Fill the register",
              responseType: "file",
              instructions: {
                critical_fail: ["Fabricated evidence"],
                pass_criteria: ["All claims backed by an excerpt"],
                required_fields: ["claim id", "claim text"],
              },
            },
          ],
          answers: [
            {
              questionId: "q-1",
              fileName: "register.xlsx",
              fileContentSnippet: "C-001, incident log 2026-07, High",
            },
          ],
        },
      );

      expect(result.decision).toBe("human_review");
      expect(result.calculatedXp).toBe(0);
      expect(result.debugTelemetry?.calculatedXp).toBe(0);
      expect(result.debugTelemetry?.validatedDecision).toBe("human_review");
    });

    it("overrides an LLM hallucinated pass when a criterion is subpar", async () => {
      vi.mocked(callOpenRouterAI).mockResolvedValue(
        JSON.stringify({
          overallScore: 90,
          decision: "pass",
          stage1SubmissionCheck: { isAssessable: true, notes: "ok" },
          stage2CriticalFailures: { hasFailure: false, failuresFound: [] },
          rubricRows: [
            { label: "Completeness", score: 3, maxScore: 3, tone: "success" },
            { label: "Accuracy", score: 1, maxScore: 3, tone: "error" },
            { label: "Evidence use", score: 3, maxScore: 3, tone: "success" },
            { label: "Judgement", score: 3, maxScore: 3, tone: "success" },
            { label: "Next action", score: 3, maxScore: 3, tone: "success" },
          ],
          feedback: "Good",
          singleImprovementPoint: "Keep going",
        }),
      );
      const result = await evaluateArtifactSubmission(
        { OPENROUTER_API_KEY: "sk-test" },
        sampleInput,
      );

      expect(result.decision).toBe("revise_and_resubmit");
      expect(result.debugTelemetry?.wasDecisionOverridden).toBe(true);
      expect(result.debugTelemetry?.validatedDecision).toBe("revise_and_resubmit");
    });

    it("falls back to deterministic rules when the LLM call throws", async () => {
      vi.mocked(callOpenRouterAI).mockRejectedValue(new Error("upstream exploded"));
      const result = await evaluateArtifactSubmission(
        { OPENROUTER_API_KEY: "sk-test" },
        sampleInput,
      );

      expect(result.provider).toBe("fallback");
      expect(result.decision).toBe("pass");
      expect(result.calculatedXp).toBe(20);
    });

    it("honors an LLM-returned revise_and_resubmit decision and its XP", async () => {
      vi.mocked(callOpenRouterAI).mockResolvedValue(
        JSON.stringify({
          overallScore: 55,
          decision: "revise_and_resubmit",
          stage1SubmissionCheck: { isAssessable: true, notes: "ok" },
          stage2CriticalFailures: { hasFailure: false, failuresFound: [] },
          rubricRows: [
            {
              label: "Completeness",
              score: 2,
              maxScore: 3,
              level: "Partially demonstrated",
              evidence: "e",
              tone: "warning",
            },
            {
              label: "Accuracy",
              score: 2,
              maxScore: 3,
              level: "Partially demonstrated",
              evidence: "e",
              tone: "warning",
            },
            {
              label: "Evidence use",
              score: 2,
              maxScore: 3,
              level: "Partially demonstrated",
              evidence: "e",
              tone: "warning",
            },
            {
              label: "Judgement",
              score: 2,
              maxScore: 3,
              level: "Partially demonstrated",
              evidence: "e",
              tone: "warning",
            },
            {
              label: "Next action",
              score: 2,
              maxScore: 3,
              level: "Partially demonstrated",
              evidence: "e",
              tone: "warning",
            },
          ],
          feedback: "Improve accuracy",
          singleImprovementPoint: "Cite more evidence",
        }),
      );
      const result = await evaluateArtifactSubmission(
        { OPENROUTER_API_KEY: "sk-test" },
        sampleInput,
      );

      expect(result.decision).toBe("revise_and_resubmit");
      expect(result.calculatedXp).toBe(1);
      expect(result.debugTelemetry?.validatedDecision).toBe("revise_and_resubmit");
      expect(result.debugTelemetry?.wasDecisionOverridden).toBe(false);
    });

    it("caps long text responses at 20k chars and file names at 255 chars in the prompt", async () => {
      mockOpenRouter();
      const longText = "x".repeat(25_000);
      const longName = "y".repeat(300) + ".xlsx";
      const result = await evaluateArtifactSubmission(
        { OPENROUTER_API_KEY: "sk-test" },
        {
          ...fileInput,
          questions: [
            {
              id: "q-1",
              title: "Claim register",
              description: "Fill the register",
              responseType: "file",
              instructions: { pass_criteria: ["All claims backed by an excerpt"] },
            },
          ],
          answers: [
            {
              questionId: "q-1",
              fileName: longName,
              textResponse: longText,
              fileContentSnippet: "C-001, incident log 2026-07, High",
            },
          ],
        },
      );

      expect(result.decision).toBe("pass");
      const payload = vi.mocked(callOpenRouterAI).mock.calls[0]?.[1];
      const userMessage = payload?.messages[1].content as string;
      expect(userMessage).toContain("... [truncated]");
      expect(userMessage.length).toBeLessThan(25_000);
      expect(userMessage).toContain(longName.slice(0, 255));
      expect(userMessage).not.toContain("y".repeat(256) + ".xlsx");
    });
  });
});
