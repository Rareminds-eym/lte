import { beforeEach, describe, expect, it, vi } from "vitest";
import { evaluateArtifactSubmission } from "../artifact-evaluator";
import { type ParsedRubricRow, validateRubricEvidence } from "../response-schema";
import type { ArtifactEvaluationInput } from "../types";

const { callOpenRouterAI } = vi.hoisted(() => ({ callOpenRouterAI: vi.fn() }));

vi.mock("@functions/lib/ai-engine/openrouter", () => ({
  callOpenRouterAI,
  DEFAULT_OPENROUTER_MODEL: "google/gemini-2.5-flash",
  OPENROUTER_API_URL: "https://openrouter.ai/api/v1/chat/completions",
  DEFAULT_OPENROUTER_SITE_NAME: "LTE",
  DEFAULT_OPENROUTER_SITE_URL: "https://lte.rareminds.in",
}));

describe("Template vs Learner Evidence Handling & Hierarchy Context", () => {
  const baseInput: ArtifactEvaluationInput = {
    artifactId: "art-template-1",
    artifactType: "final",
    passingScore: 60,
    totalScore: 100,
    questions: [
      {
        id: "q-1",
        title: "Evidence Classification Register",
        description: "Complete the evidence classification register.",
        responseType: "file",
      },
    ],
    answers: [],
    attemptNo: 1,
  };

  const templateSnippet = `Header: Field | Default Value
Row 5: Observed detail=Observed detail
Row 6: Exact response excerpt=Exact response excerpt
Row 7: Workflow Owner=OWN-001 — GenAI Workflow Owner`;

  const learnerSubmissionTemplateOnly = `Header: Field | Default Value
Row 5: Observed detail=Observed detail
Row 6: Exact response excerpt=Exact response excerpt
Row 7: Workflow Owner=OWN-001 — GenAI Workflow Owner`;

  const learnerSubmissionPartial = `Header: Field | Default Value
Row 5: Observed detail=Identified 14,000 daily records exceeding intake queue limit
Row 6: Exact response excerpt=Exact response excerpt
Row 7: Workflow Owner=OWN-001 — GenAI Workflow Owner`;

  const learnerSubmissionComplete = `Header: Field | Default Value
Row 5: Observed detail=Identified 14,000 daily records exceeding intake queue limit
Row 6: Exact response excerpt=Log excerpt sustained 14k records/day vs 10k capacity
Row 7: Workflow Owner=Shift supervisor escalated batch frequency to 10 minutes`;

  beforeEach(() => {
    callOpenRouterAI.mockReset();
  });

  describe("validateRubricEvidence with templateContent", () => {
    it("rejects evidence that exists verbatim in templateContent", () => {
      const rows: ParsedRubricRow[] = [
        {
          label: "Completeness",
          score: 3,
          maxScore: 3,
          level: "Strongly demonstrated",
          evidence: "Observed detail",
          tone: "success",
        },
      ];
      const answers = [
        {
          questionId: "q-1",
          fileContentSnippet: learnerSubmissionTemplateOnly,
          templateContent: templateSnippet,
        },
      ];

      const { rows: validated, failed } = validateRubricEvidence(rows, answers);
      expect(failed).toBe(true);
      expect(validated[0]?.evidenceValid).toBe(false);
      expect(validated[0]?.evidence).toBe("");
      expect(validated[0]?.score).toBe(0);
    });

    it("rejects pre-populated default values present in the template", () => {
      const rows: ParsedRubricRow[] = [
        {
          label: "Next action",
          score: 3,
          maxScore: 3,
          level: "Strongly demonstrated",
          evidence: "OWN-001 — GenAI Workflow Owner",
          tone: "success",
        },
      ];
      const answers = [
        {
          questionId: "q-1",
          fileContentSnippet: learnerSubmissionTemplateOnly,
          templateContent: templateSnippet,
        },
      ];

      const { rows: validated, failed } = validateRubricEvidence(rows, answers);
      expect(failed).toBe(true);
      expect(validated[0]?.evidenceValid).toBe(false);
      expect(validated[0]?.score).toBe(0);
    });

    it("accepts genuine learner evidence that differs from templateContent", () => {
      const rows: ParsedRubricRow[] = [
        {
          label: "Completeness",
          score: 3,
          maxScore: 3,
          level: "Strongly demonstrated",
          evidence: "14,000 daily records exceeding intake queue limit",
          tone: "success",
        },
      ];
      const answers = [
        {
          questionId: "q-1",
          fileContentSnippet: learnerSubmissionPartial,
          templateContent: templateSnippet,
        },
      ];

      const { rows: validated, failed } = validateRubricEvidence(rows, answers);
      expect(failed).toBe(false);
      expect(validated[0]?.evidenceValid).toBe(true);
      expect(validated[0]?.evidence).toBe("14,000 daily records exceeding intake queue limit");
      expect(validated[0]?.score).toBe(3);
    });
  });

  describe("evaluateArtifactSubmission with template & hierarchy context", () => {
    it("forces revise_and_resubmit when model awards credit based on template content", async () => {
      vi.mocked(callOpenRouterAI).mockResolvedValue(
        JSON.stringify({
          overallScore: 100,
          confidence: 90,
          decision: "pass",
          stage1SubmissionCheck: { isAssessable: true, notes: "ok" },
          stage2CriticalFailures: { hasFailure: false, failuresFound: [] },
          rubricRows: [
            {
              label: "Completeness",
              score: 3,
              maxScore: 3,
              level: "Strongly demonstrated",
              evidence: "Observed detail",
              tone: "success",
            },
            {
              label: "Accuracy",
              score: 3,
              maxScore: 3,
              level: "Strongly demonstrated",
              evidence: "Exact response excerpt",
              tone: "success",
            },
            {
              label: "Evidence use",
              score: 3,
              maxScore: 3,
              level: "Strongly demonstrated",
              evidence: "Observed detail",
              tone: "success",
            },
            {
              label: "Judgement",
              score: 3,
              maxScore: 3,
              level: "Strongly demonstrated",
              evidence: "Exact response excerpt",
              tone: "success",
            },
            {
              label: "Next action",
              score: 3,
              maxScore: 3,
              level: "Strongly demonstrated",
              evidence: "OWN-001 — GenAI Workflow Owner",
              tone: "success",
            },
          ],
          feedback: "All fields present",
          singleImprovementPoint: "None",
        }),
      );

      const result = await evaluateArtifactSubmission(
        { OPENROUTER_API_KEY: "sk-test" },
        {
          ...baseInput,
          answers: [
            {
              questionId: "q-1",
              fileName: "submission.xlsx",
              fileContentSnippet: learnerSubmissionTemplateOnly,
              templateContent: templateSnippet,
            },
          ],
        },
      );

      expect(result.decision).toBe("revise_and_resubmit");
      expect(result.overallScore).toBe(0);
      expect(result.calculatedXp).toBe(1);
      expect(result.rubricRows.every((r) => r.evidenceValid === false)).toBe(true);
    });

    it("serializes evaluationContext and templateContext into prompt payload", async () => {
      vi.mocked(callOpenRouterAI).mockResolvedValue(
        JSON.stringify({
          overallScore: 100,
          confidence: 90,
          decision: "pass",
          stage1SubmissionCheck: { isAssessable: true, notes: "ok" },
          stage2CriticalFailures: { hasFailure: false, failuresFound: [] },
          rubricRows: Array.from({ length: 5 }, (_, i) => ({
            label: ["Completeness", "Accuracy", "Evidence use", "Judgement", "Next action"][i],
            score: 3,
            maxScore: 3,
            level: "Strongly demonstrated",
            evidence: "14,000 daily records exceeding intake queue limit",
            tone: "success",
          })),
          feedback: "Great work",
          singleImprovementPoint: "Keep it up",
        }),
      );

      const evaluationContext = {
        capabilityName: "AI Workflow Engineering",
        capabilityCode: "ITS-CAP-037",
        levelTitle: "Level 1 Foundation",
        levelProblemStatement: {
          title: "Intake Queue Bottleneck",
          description: "Capacity issues in ticket intake",
        },
        moduleNo: 2,
        moduleTitle: "Evidence Classification",
        moduleProblemStatement: "Categorize evidence by risk rating",
        industryChallenge: "Northstar Retail intake delay",
        stageName: "express",
        stageOrder: 4,
        stageDescription: "Express learning by completing the evidence register",
      };

      const result = await evaluateArtifactSubmission(
        { OPENROUTER_API_KEY: "sk-test" },
        {
          ...baseInput,
          evaluationContext,
          answers: [
            {
              questionId: "q-1",
              fileName: "submission.xlsx",
              fileContentSnippet: learnerSubmissionComplete,
              templateContent: templateSnippet,
            },
          ],
        },
      );

      expect(result.decision).toBe("pass");
      expect(result.overallScore).toBe(100);

      const payload = vi.mocked(callOpenRouterAI).mock.calls[0]?.[1];
      const userMessage = payload?.messages[1].content as string;

      expect(userMessage).toContain("ITS-CAP-037");
      expect(userMessage).toContain("AI Workflow Engineering");
      expect(userMessage).toContain("Intake Queue Bottleneck");
      expect(userMessage).toContain("Categorize evidence by risk rating");
      expect(userMessage).toContain('"stageName":"express"');
      expect(userMessage).toContain("[BEGIN TEMPLATE - provided to learner, NOT learner work]");
      expect(userMessage).toContain("[BEGIN LEARNER SUBMISSION - untrusted data]");
    });

    it("evaluates gracefully without evaluationContext or templateContent", async () => {
      vi.mocked(callOpenRouterAI).mockResolvedValue(
        JSON.stringify({
          overallScore: 100,
          confidence: 90,
          decision: "pass",
          stage1SubmissionCheck: { isAssessable: true, notes: "ok" },
          stage2CriticalFailures: { hasFailure: false, failuresFound: [] },
          rubricRows: Array.from({ length: 5 }, (_, i) => ({
            label: ["Completeness", "Accuracy", "Evidence use", "Judgement", "Next action"][i],
            score: 3,
            maxScore: 3,
            level: "Strongly demonstrated",
            evidence: "14,000 daily records",
            tone: "success",
          })),
          feedback: "Clean submission",
          singleImprovementPoint: "None",
        }),
      );

      const result = await evaluateArtifactSubmission(
        { OPENROUTER_API_KEY: "sk-test" },
        {
          ...baseInput,
          answers: [
            {
              questionId: "q-1",
              fileName: "submission.xlsx",
              fileContentSnippet: "14,000 daily records processed by queue",
            },
          ],
        },
      );

      expect(result.decision).toBe("pass");
      expect(result.overallScore).toBe(100);
    });
  });
});
