import { createQueryGateway, type QueryGateway } from "@functions/lib/query-gateway";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callOpenRouterAI } from "../../ai-engine/openrouter";
import { awardXp } from "../../xp-engine";
import { processAndSaveArtifactEvaluation } from "../artifact-evaluator";
import { LTE_CRITERIA_LABELS } from "../response-schema";
import type { ArtifactEvaluationInput } from "../types";

vi.mock("../../ai-engine/openrouter", () => ({
  callOpenRouterAI: vi.fn(),
  DEFAULT_OPENROUTER_MODEL: "test-model",
}));

vi.mock("../../xp-engine", () => ({
  awardXp: vi.fn().mockResolvedValue({ success: true, xpAwarded: 0, alreadyAwarded: false }),
}));

interface QueryResult {
  data: unknown;
  error: { message: string; code?: string } | null;
}

const ok = (data: unknown): QueryResult => ({ data, error: null });
const err = (message: string): QueryResult => ({ data: null, error: { message } });

interface MockChain {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  then: (resolve: (value: QueryResult) => unknown) => Promise<unknown>;
}

function mockChain() {
  const chain: Partial<MockChain> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.upsert = vi.fn(() => Promise.resolve(ok(null)));
  // biome-ignore lint/suspicious/noThenProperty: this mocks awaited Supabase query builders.
  chain.then = vi.fn((resolve: (value: QueryResult) => unknown) =>
    Promise.resolve(ok(null)).then(resolve),
  );
  return chain as MockChain;
}

/** update(...).eq(...) is awaited - the chain must be thenable AND chainable. */
function failingUpdate(message: string): ReturnType<typeof vi.fn> {
  return vi.fn(() => {
    const result = Promise.resolve(err(message));
    return Object.assign(result, { eq: vi.fn(() => result) });
  });
}

function createSupabase(chains: Record<string, MockChain>): SupabaseClient {
  return {
    from: vi.fn((table: string) => chains[table] ?? mockChain()),
  } as unknown as SupabaseClient;
}

function createGateway(chains: Record<string, MockChain>): QueryGateway {
  return createQueryGateway(createSupabase(chains));
}

const TEXT_ANSWER =
  "I planned the audit scope, documented the risk register, and validated the controls with the team.";

function makeInput(overrides: Partial<ArtifactEvaluationInput> = {}): ArtifactEvaluationInput {
  return {
    artifactId: "artifact-1",
    artifactType: "final",
    passingScore: 60,
    totalScore: 100,
    questions: [
      {
        id: "q-1",
        title: "Plan the audit",
        description: "",
        responseType: "text",
        instructions: "",
      },
    ],
    answers: [{ questionId: "q-1", textResponse: TEXT_ANSWER }],
    attemptNo: 1,
    ...overrides,
  };
}

/** A schema-valid LLM response whose evidence quotes verify verbatim. */
function aiResponse(decision: "pass" | "revise_and_resubmit", confidence: number): string {
  return JSON.stringify({
    overallScore: 90,
    confidence,
    decision,
    stage1SubmissionCheck: { isAssessable: true, notes: "Assessable." },
    stage2CriticalFailures: { hasFailure: false, failuresFound: [] },
    rubricRows: LTE_CRITERIA_LABELS.map((label) => ({
      label,
      score: 3,
      maxScore: 3,
      level: "Strongly demonstrated",
      evidence: TEXT_ANSWER.slice(0, 24),
      tone: "success",
      feedback: "Well evidenced.",
    })),
    feedback: "Comprehensive submission.",
    singleImprovementPoint: "None.",
  });
}

describe("processAndSaveArtifactEvaluation", () => {
  beforeEach(() => {
    vi.mocked(callOpenRouterAI).mockReset();
    vi.mocked(awardXp).mockReset();
    vi.mocked(awardXp).mockResolvedValue({ success: true, xpAwarded: 0, alreadyAwarded: false });
  });

  it("routes the missing-key fallback to human_review with 0 XP and neutral progress", async () => {
    const flows = mockChain();
    const submissions = mockChain();
    const progress = mockChain();
    const gateway = createGateway({
      artifact_evaluation_flows: flows,
      artifact_submissions: submissions,
      user_module_progress: progress,
    });

    const result = await processAndSaveArtifactEvaluation(
      gateway,
      { OPENROUTER_API_KEY: "" },
      "submission-1",
      makeInput(),
      "user-1",
      "progress-1",
    );

    // P0-1: the fallback can never pass or award XP.
    expect(result.decision).toBe("human_review");
    expect(result.overallScore).toBe(0);
    expect(result.calculatedXp).toBe(0);

    const flowPayload = flows.upsert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(flowPayload["decision"]).toBe("human_review");
    expect(flowPayload["overall_status"]).toBe("human_review");
    expect(flowPayload["progression_triggered"]).toBe(false);
    expect((flowPayload["metadata"] as Record<string, unknown>)["calculated_xp"]).toBe(0);
    // P1-3: raw prompt/response never persisted.
    const telemetry = (flowPayload["metadata"] as Record<string, unknown>)[
      "debug_telemetry"
    ] as Record<string, unknown>;
    expect(telemetry["rawPromptContent"]).toBeNull();
    expect(telemetry["rawResponseContent"]).toBeNull();

    expect(submissions.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "human_review", sealed_at: null }),
    );
    expect(progress.update).toHaveBeenCalledWith(
      expect.objectContaining({ artifact_approval_status: "human_review" }),
    );
    expect(awardXp).not.toHaveBeenCalled();
  });

  it("persists a passing final-artifact attempt 1 and awards final_artifact_accepted_1 XP", async () => {
    vi.mocked(callOpenRouterAI).mockResolvedValue(aiResponse("pass", 90));
    const flows = mockChain();
    const submissions = mockChain();
    const progress = mockChain();
    const gateway = createGateway({
      artifact_evaluation_flows: flows,
      artifact_submissions: submissions,
      user_module_progress: progress,
    });

    const result = await processAndSaveArtifactEvaluation(
      gateway,
      { OPENROUTER_API_KEY: "sk-test" },
      "submission-1",
      makeInput(),
      "user-1",
      "progress-1",
    );

    expect(result.decision).toBe("pass");
    expect(result.calculatedXp).toBe(20);

    const flowPayload = flows.upsert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(flowPayload["decision"]).toBe("pass");
    expect(flowPayload["overall_status"]).toBe("accepted");
    expect(flowPayload["progression_triggered"]).toBe(true);
    expect((flowPayload["metadata"] as Record<string, unknown>)["calculated_xp"]).toBe(20);

    expect(submissions.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "accepted", sealed_at: expect.any(String) }),
    );
    expect(submissions.eq).toHaveBeenCalledWith("id", "submission-1");
    expect(progress.update).toHaveBeenCalledWith(
      expect.objectContaining({
        artifact_approval_status: "approved",
        artifact_submitted: true,
        module_status: "mastered",
      }),
    );
    expect(progress.eq).toHaveBeenCalledWith("id", "progress-1");
    expect(awardXp).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "final_artifact_accepted_1",
      "artifact_submissions",
      "submission-1",
      expect.objectContaining({ score: expect.any(Number), attempt_no: 1 }),
      20,
    );
  });

  it("selects the tiered XP event type by attempt for later passes", async () => {
    vi.mocked(callOpenRouterAI).mockResolvedValue(aiResponse("pass", 90));
    const gateway = createGateway({});

    await processAndSaveArtifactEvaluation(
      gateway,
      { OPENROUTER_API_KEY: "sk-test" },
      "submission-1",
      makeInput({ artifactType: "practice", attemptNo: 2 }),
      "user-1",
      "progress-1",
    );
    expect(awardXp).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "practice_artifact_accepted",
      "artifact_submissions",
      "submission-1",
      expect.anything(),
      2,
    );

    vi.mocked(awardXp).mockClear();
    await processAndSaveArtifactEvaluation(
      gateway,
      { OPENROUTER_API_KEY: "sk-test" },
      "submission-2",
      makeInput({ attemptNo: 4 }),
      "user-1",
      "progress-1",
    );
    expect(awardXp).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "final_artifact_accepted_3",
      "artifact_submissions",
      "submission-2",
      expect.anything(),
      10,
    );
  });

  it("awards failure XP when a pass decision is overridden by low confidence (human_review is neutral)", async () => {
    // Confidence below MIN_AI_CONFIDENCE (60) overrides a pass to human_review.
    vi.mocked(callOpenRouterAI).mockResolvedValue(aiResponse("pass", 40));
    const flows = mockChain();
    const submissions = mockChain();
    const progress = mockChain();
    const gateway = createGateway({
      artifact_evaluation_flows: flows,
      artifact_submissions: submissions,
      user_module_progress: progress,
    });

    const result = await processAndSaveArtifactEvaluation(
      gateway,
      { OPENROUTER_API_KEY: "sk-test" },
      "submission-1",
      makeInput(),
      "user-1",
      "progress-1",
    );

    expect(result.decision).toBe("human_review");
    expect(result.calculatedXp).toBe(0);
    expect(submissions.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "human_review", sealed_at: null }),
    );
    // human_review is neutral: no failure event, no engagement XP.
    expect(awardXp).not.toHaveBeenCalled();
  });

  it("throws on evaluation-flow persist failure so the submit flow can roll back", async () => {
    vi.mocked(callOpenRouterAI).mockResolvedValue(aiResponse("pass", 90));
    const flows = mockChain();
    flows.upsert = vi.fn(() => Promise.resolve(err("flows table down")));
    const gateway = createGateway({ artifact_evaluation_flows: flows });

    await expect(
      processAndSaveArtifactEvaluation(
        gateway,
        { OPENROUTER_API_KEY: "sk-test" },
        "submission-1",
        makeInput(),
        "user-1",
        "progress-1",
      ),
    ).rejects.toThrow(/Failed to save artifact evaluation flow/);
  });

  it("throws on submission status update failure", async () => {
    vi.mocked(callOpenRouterAI).mockResolvedValue(aiResponse("pass", 90));
    const submissions = mockChain();
    submissions.update = failingUpdate("update failed");
    const gateway = createGateway({ artifact_submissions: submissions });

    await expect(
      processAndSaveArtifactEvaluation(
        gateway,
        { OPENROUTER_API_KEY: "sk-test" },
        "submission-1",
        makeInput(),
        "user-1",
        "progress-1",
      ),
    ).rejects.toThrow(/Failed to update submission status/);
  });

  it("throws on module progress update failure", async () => {
    vi.mocked(callOpenRouterAI).mockResolvedValue(aiResponse("pass", 90));
    const progress = mockChain();
    progress.update = failingUpdate("progress down");
    const gateway = createGateway({ user_module_progress: progress });

    await expect(
      processAndSaveArtifactEvaluation(
        gateway,
        { OPENROUTER_API_KEY: "sk-test" },
        "submission-1",
        makeInput(),
        "user-1",
        "progress-1",
      ),
    ).rejects.toThrow(/Failed to update module progress/);
  });

  it("swallows XP award failures after the evaluation is persisted", async () => {
    vi.mocked(callOpenRouterAI).mockResolvedValue(aiResponse("pass", 90));
    vi.mocked(awardXp).mockRejectedValue(new Error("xp engine down"));
    const flows = mockChain();
    const submissions = mockChain();
    const progress = mockChain();
    const gateway = createGateway({
      artifact_evaluation_flows: flows,
      artifact_submissions: submissions,
      user_module_progress: progress,
    });

    const result = await processAndSaveArtifactEvaluation(
      gateway,
      { OPENROUTER_API_KEY: "sk-test" },
      "submission-1",
      makeInput(),
      "user-1",
      "progress-1",
    );

    expect(result.decision).toBe("pass");
    expect(flows.upsert).toHaveBeenCalled();
    expect(submissions.update).toHaveBeenCalled();
  });
});
