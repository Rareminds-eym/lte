import { beforeEach, describe, expect, it, vi } from "vitest";
import { levelId, signedContext, snapshot } from "./helpers";

const f = vi.hoisted(() => ({ evaluate: vi.fn(), rpc: vi.fn(), read: vi.fn() }));
vi.mock("@functions/lib/artifact-evaluator", () => ({ evaluateArtifactSubmission: f.evaluate }));
vi.mock("@functions/lib/query-gateway", () => ({
  createServiceQueryGateway: () => ({ rpc: f.rpc, read: f.read }),
}));

import { onRequestPost } from "../equivalence";

const payload = {
  levelId,
  fingerprint: "a".repeat(32),
  evidenceContent: "Here is my actual implementation and validation evidence. ".repeat(8),
};
beforeEach(() => {
  vi.clearAllMocks();
  f.rpc.mockResolvedValue(snapshot());
  f.read.mockResolvedValue({
    title: "Frontend L2",
    description: "Demonstrate the required implementation.",
    observable_behavior: ["Build and test the solution."],
  });
  f.evaluate.mockResolvedValue({
    provider: "openrouter",
    evaluationSource: "ai",
    requiresManualReview: false,
    decision: "pass",
    confidence: 90,
    overallScore: 100,
    modelUsed: "fixture-model",
    feedback: "Evidence demonstrates all criteria.",
    stage1SubmissionCheck: { isAssessable: true },
    stage2CriticalFailures: { hasFailure: false },
    rubricRows: Array.from({ length: 5 }, () => ({ score: 3, evidenceValid: true })),
  });
});

describe("independent equivalent evidence AI evaluation", () => {
  it("uses the existing validated evaluator with actual evidence and authoritative level context", async () => {
    const response = await onRequestPost(await signedContext("equivalence", payload));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ decision: "approved", model: "fixture-model" });
    expect(f.evaluate.mock.calls[0]?.[1].answers[0].textResponse).toBe(
      payload.evidenceContent.trim(),
    );
  });
  it("does not treat a link or short credential claim as assessable evidence", async () => {
    const response = await onRequestPost(
      await signedContext("equivalence", { ...payload, evidenceContent: "I have a certificate." }),
    );
    expect(response.status).toBe(400);
    expect(f.evaluate).not.toHaveBeenCalled();
  });
  it("never approves fallback evaluation", async () => {
    f.evaluate.mockResolvedValueOnce({
      provider: "fallback",
      evaluationSource: "fallback",
      requiresManualReview: true,
      decision: "pass",
      confidence: 0,
      overallScore: 100,
      feedback: "Retry evaluation.",
      modelUsed: "fallback",
      rubricRows: [],
    });
    expect(
      await (await onRequestPost(await signedContext("equivalence", payload))).json(),
    ).toMatchObject({ decision: "pending" });
  });
  it("does not accept a model pass without verified supporting evidence", async () => {
    f.evaluate.mockResolvedValueOnce({
      provider: "openrouter",
      evaluationSource: "ai",
      requiresManualReview: false,
      decision: "pass",
      confidence: 90,
      overallScore: 100,
      feedback: "Unsupported evidence.",
      modelUsed: "fixture-model",
      stage1SubmissionCheck: { isAssessable: true },
      stage2CriticalFailures: { hasFailure: false },
      rubricRows: Array.from({ length: 5 }, () => ({ score: 3, evidenceValid: false })),
    });
    expect(
      await (await onRequestPost(await signedContext("equivalence", payload))).json(),
    ).toMatchObject({ decision: "rejected" });
  });
  it("rejects unsigned requests before running AI", async () => {
    const ctx = await signedContext("equivalence", payload);
    ctx.request.headers.delete("x-lte-signature");
    const response = await onRequestPost(ctx);
    expect(response.status).toBe(401);
    expect(f.evaluate).not.toHaveBeenCalled();
  });
});

it.each([
  1, 2,
])("returns 503 for snapshot failure at read %i, without claiming content changed", async (read) => {
  if (read === 1) f.rpc.mockRejectedValueOnce(new Error("Synthetic DB outage"));
  else
    f.rpc.mockResolvedValueOnce(snapshot()).mockRejectedValueOnce(new Error("Synthetic DB outage"));
  const response = await onRequestPost(await signedContext("equivalence", payload));
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("Learning content changed");
  if (read === 1) expect(f.evaluate).not.toHaveBeenCalled();
});
it("rejects malformed snapshot output before AI evaluation", async () => {
  f.rpc.mockResolvedValueOnce({ levels: [{ garbage: true }] });
  expect((await onRequestPost(await signedContext("equivalence", payload))).status).toBe(503);
  expect(f.evaluate).not.toHaveBeenCalled();
});
it.each([1, 2])("preserves a genuine content conflict at read %i", async (read) => {
  const changed = snapshot();
  const level = changed.levels[0];
  if (!level) throw new Error("Missing fixture level");
  level.fingerprint = "c".repeat(32);
  if (read === 1) f.rpc.mockResolvedValueOnce(changed);
  else f.rpc.mockResolvedValueOnce(snapshot()).mockResolvedValueOnce(changed);
  expect((await onRequestPost(await signedContext("equivalence", payload))).status).toBe(409);
});
it("rejects missing criteria as unavailable before running AI", async () => {
  f.read.mockResolvedValueOnce(null);
  expect((await onRequestPost(await signedContext("equivalence", payload))).status).toBe(503);
  expect(f.evaluate).not.toHaveBeenCalled();
});
