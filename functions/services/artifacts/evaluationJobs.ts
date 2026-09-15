/**
 * Evaluation job handoff for the worker `grade-submission` migration
 * (cutover-ready, no callers yet).
 *
 * Builds the stable worker request for a submission (operation identity is
 * derived from the submission id so retries reuse it), mints the scoped
 * `seniorEducator.grade-submission` assertion, calls the worker through the
 * typed binding, and normalizes failures. Persistence of the scheduling
 * intent stays with the submit flow (it owns the idempotency/rollback
 * envelope); the returned intent object is what the caller persists.
 *
 * Flipping the first caller (queries.ts submit path) is a separately gated
 * cutover with dual-run diff and rollback.
 */

import { apiLogger } from "@functions/shared/logger";
import type {
  AiResult,
  GradeSubmissionInput,
  GradeSubmissionOutput,
} from "@rareminds-eym/ai-protocol";
import { getAiWorker } from "@functions/lib/ai/binding";
import type { LteAiServiceEnv } from "@functions/lib/ai/binding";
import { issueExecutionAssertion } from "@functions/lib/ai/assertion";

/** Entitlement the worker's `seniorEducator.grade-submission` policy requires. */
export const GRADE_SUBMISSION_ENTITLEMENT = "artifact_evaluation";

export interface GradeSubmissionJobArgs {
  submissionId: string;
  userId: string;
  evalInput: GradeSubmissionInput;
  requestId: string;
  /** Stable per submission; retries of the same submission reuse it. */
  operationId?: string;
  entitlements?: string[];
  nowMs?: number;
}

export interface GradeSubmissionJob {
  operationId: string;
  requestId: string;
  submissionId: string;
  userId: string;
  body: {
    contractVersion: "1";
    requestId: string;
    operationId: string;
    executionAssertion: string;
    actor: { actorId: string; product: string };
    feature: "grade-submission";
    input: GradeSubmissionInput;
  };
}

export function operationIdForSubmission(submissionId: string): string {
  return `lte-eval-${submissionId}`;
}

/** Pure request builder: stable identity, scoped assertion, no I/O besides HMAC. */
export async function buildGradeSubmissionJob(
  assertSecret: string,
  args: GradeSubmissionJobArgs,
): Promise<GradeSubmissionJob> {
  const operationId = args.operationId ?? operationIdForSubmission(args.submissionId);
  const executionAssertion = await issueExecutionAssertion(
    assertSecret,
    {
      issuer: "lte",
      action: "seniorEducator.grade-submission",
      userId: args.userId,
      product: "lte",
      entitlements: args.entitlements ?? [GRADE_SUBMISSION_ENTITLEMENT],
    },
    args.nowMs ?? Date.now(),
  );
  return {
    operationId,
    requestId: args.requestId,
    submissionId: args.submissionId,
    userId: args.userId,
    body: {
      contractVersion: "1",
      requestId: args.requestId,
      operationId,
      executionAssertion,
      actor: { actorId: args.userId, product: "lte" },
      feature: "grade-submission",
      input: args.evalInput,
    },
  };
}

export type GradeSubmissionJobResult =
  | { ok: true; proposal: GradeSubmissionOutput; executionId?: string }
  | { ok: true; pending: true; executionId: string; workflowId: string; state: "queued" }
  | { ok: true; pending: true; executionId: string; state: "queued"; duplicate: true }
  | { ok: false; error: { code: string; message: string; retryable: boolean } };

function normalizeFailure(error: unknown): GradeSubmissionJobResult {
  const message = error instanceof Error ? error.message : String(error);
  const code = message.split(":")[0] ?? "INTERNAL_ERROR";
  const retryable =
    code === "RATE_LIMIT_EXCEEDED" ||
    code === "BUDGET_EXCEEDED" ||
    code === "DEPENDENCY_UNAVAILABLE" ||
    code === "DOWNSTREAM_TIMEOUT";
  apiLogger.warn("Worker grade-submission request failed.", { code });
  return { ok: false, error: { code, message: message.slice(0, 500), retryable } };
}

/**
 * Call the worker for a submission. Returns the validated proposal on
 * success; normalizes worker/transport failures into a typed result (never
 * throws for evaluation failures). Missing binding/secret throws: that is a
 * cutover wiring error, not an evaluation outcome.
 */
export async function requestGradeSubmission(
  env: LteAiServiceEnv & { AI_ASSERT_SECRET?: string },
  args: GradeSubmissionJobArgs,
): Promise<GradeSubmissionJobResult> {
  const secret = typeof env.AI_ASSERT_SECRET === "string" ? env.AI_ASSERT_SECRET : "";
  if (!secret) {
    throw new Error("AI_ASSERT_SECRET is not configured.");
  }
  const job = await buildGradeSubmissionJob(secret, args);
  const worker = getAiWorker(env);
  let result: AiResult<GradeSubmissionOutput> | { executionId: string; workflowId: string; state: string; requestId?: string; traceId?: string } | { duplicate: true; executionId: string; requestId: string } | Response;
  try {
    result = (await worker.seniorEducator(job.body)) as unknown as typeof result;
  } catch (error) {
    return normalizeFailure(error);
  }
  if (result instanceof Response) {
    return normalizeFailure(new Error("INTERNAL_ERROR:Unexpected streaming response for a bounded evaluation"));
  }
  // Durable acceptance: worker returns AiJobAccepted { executionId, workflowId, state: "queued" }
  if (result && typeof result === "object" && "state" in result && (result as { state: string }).state === "queued") {
    const j = result as { executionId: string; workflowId: string; state: "queued" };
    apiLogger.warn("Worker grade-submission queued durable job.", { executionId: j.executionId, workflowId: j.workflowId });
    return { ok: true, pending: true, executionId: j.executionId, workflowId: j.workflowId, state: "queued" };
  }
  // Idempotent duplicate pointer: no new spend, caller should poll existing execution
  if (result && typeof result === "object" && "duplicate" in result && (result as { duplicate: boolean }).duplicate === true) {
    const d = result as { executionId: string; requestId: string };
    apiLogger.warn("Worker grade-submission duplicate operation.", { executionId: d.executionId });
    return { ok: true, pending: true, executionId: d.executionId, state: "queued", duplicate: true as const };
  }
  if (result && typeof result === "object" && "ok" in result) {
    const r = result as AiResult<GradeSubmissionOutput>;
    if (!r.ok) {
      apiLogger.warn("Worker grade-submission returned an error result.", { code: r.error.code });
      return {
        ok: false,
        error: { code: r.error.code, message: r.error.message, retryable: r.error.retryable },
      };
    }
    return { ok: true, proposal: r.data };
  }
  return normalizeFailure(new Error("INTERNAL_ERROR:Unexpected worker response shape for grade-submission"));
}
