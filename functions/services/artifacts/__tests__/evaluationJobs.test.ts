import { describe, expect, it } from "vitest";
import type { GradeSubmissionOutput } from "@rareminds-eym/ai-protocol";
import {
  buildGradeSubmissionJob,
  GRADE_SUBMISSION_ENTITLEMENT,
  operationIdForSubmission,
  requestGradeSubmission,
} from "../evaluationJobs";
import type { LteAiServiceBinding } from "@functions/lib/ai/binding";

const SECRET = "lte-jobs-secret-min-32-chars-000000";
const NOW = 1_700_000_000_000;

const EVAL_INPUT = {
  artifactId: "art-1",
  artifactType: "final" as const,
  passingScore: 60 as number | null,
  totalScore: 100,
  questions: [
    {
      id: "q1",
      title: "Report",
      description: "",
      responseType: "text" as const,
      instructions: null,
    },
  ],
  answers: [
    {
      questionId: "q1",
      textResponse: "Revenue was 100.",
      urlResponse: "",
      fileName: "",
      fileContentSnippet: "",
      templateContent: "",
    },
  ],
  attemptNo: 1,
  evaluationContext: null,
};

function decodePayload(assertion: string): Record<string, unknown> {
  const [, payload] = assertion.split(".");
  const b64 = (payload ?? "").replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(Buffer.from(b64, "base64").toString("utf-8")) as Record<string, unknown>;
}

describe("operationIdForSubmission", () => {
  it("derives stable per-submission operation identity", () => {
    expect(operationIdForSubmission("sub-1")).toBe("lte-eval-sub-1");
    expect(operationIdForSubmission("sub-1")).toBe(operationIdForSubmission("sub-1"));
  });
});

describe("buildGradeSubmissionJob", () => {
  it("builds a scoped worker request with stable identity", async () => {
    const job = await buildGradeSubmissionJob(SECRET, {
      submissionId: "sub-1",
      userId: "u-9",
      evalInput: EVAL_INPUT,
      requestId: "r-1",
      nowMs: NOW,
    });
    expect(job.operationId).toBe("lte-eval-sub-1");
    expect(job.body).toMatchObject({
      contractVersion: "1",
      requestId: "r-1",
      operationId: "lte-eval-sub-1",
      actor: { actorId: "u-9", product: "lte" },
      feature: "grade-submission",
    });
    expect(job.body.input).toBe(EVAL_INPUT);
    expect(decodePayload(job.body.executionAssertion)).toMatchObject({
      issuer: "lte",
      audience: "ai-api",
      action: "seniorEducator.grade-submission",
      userId: "u-9",
      product: "lte",
      entitlements: [GRADE_SUBMISSION_ENTITLEMENT],
    });
  });
});

describe("requestGradeSubmission", () => {
  const args = {
    submissionId: "sub-1",
    userId: "u-9",
    evalInput: EVAL_INPUT,
    requestId: "r-1",
    nowMs: NOW,
  };

  it("returns the validated proposal on success", async () => {
    const proposal = { decision: "pass" } as GradeSubmissionOutput;
    const binding = {
      seniorEducator: async () => ({ ok: true, data: proposal, requestId: "r-1", traceId: "t-1" }),
    } as unknown as LteAiServiceBinding;
    const out = await requestGradeSubmission({ AI_SERVICE: binding, AI_ASSERT_SECRET: SECRET }, args);
    expect(out).toMatchObject({ ok: true, proposal });
  });

  it("passes worker error results through with their code", async () => {
    const binding = {
      seniorEducator: async () => ({
        ok: false,
        error: { code: "RATE_LIMIT_EXCEEDED", message: "slow", requestId: "r-1", retryable: true },
      }),
    } as unknown as LteAiServiceBinding;
    const out = await requestGradeSubmission({ AI_SERVICE: binding, AI_ASSERT_SECRET: SECRET }, args);
    expect(out).toMatchObject({
      ok: false,
      error: expect.objectContaining({ code: "RATE_LIMIT_EXCEEDED", retryable: true }),
    });
  });

  it("normalizes transport throws and unexpected streams", async () => {
    const throwing = {
      seniorEducator: async () => {
        throw new Error("DOWNSTREAM_TIMEOUT: upstream slow");
      },
    } as unknown as LteAiServiceBinding;
    const out = await requestGradeSubmission({ AI_SERVICE: throwing, AI_ASSERT_SECRET: SECRET }, args);
    expect(out).toMatchObject({ ok: false, error: expect.objectContaining({ code: "DOWNSTREAM_TIMEOUT" }) });

    const streaming = {
      seniorEducator: async () => new Response("x"),
    } as unknown as LteAiServiceBinding;
    const outStream = await requestGradeSubmission({ AI_SERVICE: streaming, AI_ASSERT_SECRET: SECRET }, args);
    expect(outStream).toMatchObject({ ok: false, error: expect.objectContaining({ code: "INTERNAL_ERROR" }) });
  });

  it("throws on missing wiring, never as an evaluation outcome", async () => {
    await expect(requestGradeSubmission({} as never, args)).rejects.toThrow("AI_ASSERT_SECRET");
    await expect(
      requestGradeSubmission({ AI_ASSERT_SECRET: SECRET } as never, args),
    ).rejects.toThrow("AI_SERVICE binding is not configured");
  });
});
