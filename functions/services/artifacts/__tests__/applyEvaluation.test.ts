import { describe, expect, it } from "vitest";
import type { QueryGateway } from "@functions/lib/query-gateway";
import {
  applyEvaluationProposal,
  toEvaluationProposal,
} from "../applyEvaluation";
import type { EvaluationProposal } from "../applyEvaluation";
import { LTE_CRITERIA_LABELS } from "@functions/lib/artifact-evaluator/response-schema";
import type { AIEvaluationResult } from "@functions/lib/artifact-evaluator/types";

interface RecordedCall {
  method: string;
  policy: unknown;
  payload: unknown;
}

/** Recording QueryGateway double: captures policy + payload per call. */
function fakeGateway(behavior: { upsert?: (payload: unknown) => Promise<unknown> } = {}): {
  gateway: QueryGateway;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  const gateway = {
    read: async () => null,
    insert: async () => null,
    update: async (policy: unknown, payload: unknown) => {
      calls.push({ method: "update", policy, payload });
      return null;
    },
    upsert: async (policy: unknown, payload: unknown) => {
      calls.push({ method: "upsert", policy, payload });
      if (behavior.upsert) return behavior.upsert(payload);
      return null;
    },
    delete: async () => null,
    rpc: async () => null,
  } as unknown as QueryGateway;
  return { gateway, calls };
}

const ofMethod = (calls: RecordedCall[], method: string) =>
  calls.filter((c) => c.method === method).map((c) => c.payload as Record<string, unknown>);

const TEXT = "I planned the audit scope, documented the risk register, and validated the controls.";

function proposal(overrides: Partial<EvaluationProposal> = {}): EvaluationProposal {
  return {
    decision: "pass",
    overallScore: 100,
    passingScore: 60,
    feedback: "Comprehensive submission.",
    singleImprovementPoint: "None.",
    rubricRows: LTE_CRITERIA_LABELS.map((label) => ({
      label,
      score: 3,
      maxScore: 3 as const,
      level: "Strongly demonstrated" as const,
      evidence: TEXT.slice(0, 24),
      evidenceValid: true,
      tone: "success" as const,
      feedback: "Well evidenced.",
    })),
    stage1SubmissionCheck: { isAssessable: true, notes: "Assessable." },
    stage2CriticalFailures: { hasFailure: false, failuresFound: [] },
    modelUsed: "google/gemini-2.5-flash",
    provider: "openrouter",
    confidence: 90,
    calculatedXp: 20,
    requiresManualReview: false,
    evaluationSource: "ai",
    debugTelemetry: {
      provider: "openrouter",
      latencyMs: 5,
      modelUsed: "google/gemini-2.5-flash",
      timestamp: new Date().toISOString(),
      calculatedXp: 20,
      confidence: 90,
      validatedDecision: "pass",
      wasDecisionOverridden: false,
      extractionCharCounts: { "q-1": 10 },
      promptCharCount: 500,
      stage1Check: { isAssessable: true, notes: "Assessable." },
      stage2Failures: { hasFailure: false, failuresFound: [] },
    },
    ...overrides,
  };
}

const baseArgs = {
  submissionId: "sub-1",
  moduleProgressId: "mp-1",
  userId: "u-9",
  artifactId: "art-1",
  artifactType: "final" as const,
  attemptNo: 1,
};

describe("applyEvaluationProposal", () => {
  it("applies a pass proposal across all four writes with XP", async () => {
    const { gateway, calls } = fakeGateway();
    const awards: unknown[] = [];
    const out = await applyEvaluationProposal(
      gateway,
      async (...awardArgs: unknown[]) => {
        awards.push(awardArgs);
      },
      { ...baseArgs, proposal: proposal() },
    );
    expect(out.overallStatus).toBe("accepted");
    expect(out.evalResult.eventType).toBe("final_artifact_accepted_1");
    const upserts = ofMethod(calls, "upsert");
    expect(upserts).toHaveLength(1);
    expect(upserts[0]).toMatchObject({ submission_id: "sub-1", score: 100, decision: "pass" });
    const updates = ofMethod(calls, "update");
    expect(updates).toHaveLength(2);
    expect((updates[0] as { data: Record<string, unknown> }).data).toMatchObject({
      status: "accepted",
    });
    expect((updates[0] as { data: Record<string, unknown> }).data.sealed_at).not.toBeNull();
    expect((updates[1] as { data: Record<string, unknown> }).data).toMatchObject({
      artifact_approval_status: "approved",
      module_status: "mastered",
    });
    expect(awards).toHaveLength(1);
    expect(awards[0]).toMatchObject(["u-9", "final_artifact_accepted_1", 100, 1, "openrouter", 20]);
  });

  it("applies revise decisions without sealing or mastering", async () => {
    const { gateway, calls } = fakeGateway();
    const awards: unknown[] = [];
    const out = await applyEvaluationProposal(
      gateway,
      async (...awardArgs: unknown[]) => {
        awards.push(awardArgs);
      },
      {
        ...baseArgs,
        proposal: proposal({ decision: "revise_and_resubmit", overallScore: 40, calculatedXp: 1 }),
      },
    );
    expect(out.overallStatus).toBe("resubmission_required");
    const updates = ofMethod(calls, "update");
    expect((updates[0] as { data: Record<string, unknown> }).data).toMatchObject({
      status: "resubmission_required",
      sealed_at: null,
    });
    expect((awards[0] as unknown[]).slice(0, 2)).toEqual(["u-9", "final_artifact_failed"]);
  });

  it("keeps human_review XP-neutral with no award call", async () => {
    const { gateway } = fakeGateway();
    const awards: unknown[] = [];
    const out = await applyEvaluationProposal(
      gateway,
      async (...awardArgs: unknown[]) => {
        awards.push(awardArgs);
      },
      {
        ...baseArgs,
        proposal: proposal({ decision: "human_review", overallScore: 0, calculatedXp: 0 }),
      },
    );
    expect(out.overallStatus).toBe("human_review");
    expect(out.evalResult.eventType).toBeUndefined();
    expect(awards).toHaveLength(0);
  });

  it("forces rogue fallback proposals to human_review with 0 XP (P0-1)", async () => {
    const { gateway } = fakeGateway();
    const awards: unknown[] = [];
    const out = await applyEvaluationProposal(
      gateway,
      async (...awardArgs: unknown[]) => {
        awards.push(awardArgs);
      },
      {
        ...baseArgs,
        proposal: proposal({ provider: "fallback", decision: "pass", overallScore: 90, calculatedXp: 20 }),
      },
    );
    expect(out.evalResult.decision).toBe("human_review");
    expect(out.evalResult.overallScore).toBe(0);
    expect(out.evalResult.calculatedXp).toBe(0);
    expect(out.overallStatus).toBe("human_review");
    expect(awards).toHaveLength(0);
  });

  it("rejects stale revisions before any write", async () => {
    const { gateway, calls } = fakeGateway();
    await expect(
      applyEvaluationProposal(gateway, async () => {}, {
        ...baseArgs,
        currentAttemptNo: 2,
        expectedAttemptNo: 1,
        proposal: proposal(),
      }),
    ).rejects.toThrow("Stale evaluation result");
    expect(calls).toHaveLength(0);
  });

  it("re-applies idempotently through the flow upsert", async () => {
    const { gateway, calls } = fakeGateway();
    const args = { ...baseArgs, proposal: proposal() };
    await applyEvaluationProposal(gateway, async () => {}, args);
    await applyEvaluationProposal(gateway, async () => {}, args);
    expect(ofMethod(calls, "upsert")).toHaveLength(2);
  });

  it("surfaces flow write failures without partial application claims", async () => {
    const { gateway } = fakeGateway({
      upsert: async () => {
        throw new Error("db down");
      },
    });
    await expect(
      applyEvaluationProposal(gateway, async () => {}, { ...baseArgs, proposal: proposal() }),
    ).rejects.toThrow("Failed to save artifact evaluation flow");
  });
});

describe("toEvaluationProposal", () => {
  it("projects the inline result and strips raw telemetry", () => {
    const inline = {
      ...proposal(),
      debugTelemetry: {
        ...(proposal().debugTelemetry as Record<string, unknown>),
        rawPromptContent: "prompt",
        rawResponseContent: "response",
      },
    } as unknown as AIEvaluationResult;
    const projected = toEvaluationProposal(inline);
    expect(projected.decision).toBe("pass");
    expect(projected.debugTelemetry).not.toHaveProperty("rawPromptContent");
    expect(projected.debugTelemetry).not.toHaveProperty("rawResponseContent");
  });
});
