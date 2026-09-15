/**
 * AI Worker Binding Helper (cutover-ready, no callers yet).
 *
 * Typed access to ai-worker (deployed as `ai-api`) via Cloudflare Service
 * Binding RPC. Mirrors the embedding-worker binding pattern and the
 * SkillPassport adapter: per-request accessor, CODE-prefixed error mapping,
 * no cached clients.
 *
 * No caller imports this yet. Flipping the first caller (artifact
 * evaluation) is a separately gated cutover with dual-run diff and rollback.
 */

import type {
  AiError,
  AiResult,
  ExecutionStatus,
  GradeSubmissionInput,
  GradeSubmissionOutput,
} from "@rareminds-eym/ai-protocol";

/** Typed subset of the AiService RPC surface used by LTE. */
export interface LteAiServiceBinding {
  seniorEducator(request: {
    contractVersion: "1";
    requestId: string;
    operationId: string;
    executionAssertion: string;
    actor: { actorId: string; product: string };
    feature: "grade-submission";
    input: GradeSubmissionInput;
  }): Promise<AiResult<GradeSubmissionOutput> | Response>;
  getExecutionStatus(request: {
    contractVersion: "1";
    requestId: string;
    operationId: string;
    executionAssertion: string;
    actor: { actorId: string; product: string };
    input: { executionId: string };
  }): Promise<AiResult<ExecutionStatus>>;
  cancelExecution(request: {
    contractVersion: "1";
    requestId: string;
    operationId: string;
    executionAssertion: string;
    actor: { actorId: string; product: string };
    input: { executionId: string };
  }): Promise<AiResult<ExecutionStatus>>;
}

export interface LteAiServiceEnv {
  /** Service binding to ai-worker (ai-api). Absent until wired per environment. */
  AI_SERVICE?: LteAiServiceBinding;
  [key: string]: unknown;
}

/**
 * Get the typed AI worker binding. Per-request only: never cache the stub
 * in a module global (request-scoped binding rule).
 */
export function getAiWorker(env: LteAiServiceEnv): LteAiServiceBinding {
  if (!env.AI_SERVICE) {
    throw new Error(
      "AI_SERVICE binding is not configured. " +
        "Add [[services]] binding AI_SERVICE service ai-api to wrangler.toml " +
        "or use --service AI_SERVICE=ai-api#AiService in local dev.",
    );
  }
  return env.AI_SERVICE;
}

/** Map a worker CODE-prefixed RPC failure to an HTTP status. */
export function rpcErrorToHttpStatus(error: unknown): number {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith("INVALID_INPUT:")) return 400;
  if (message.startsWith("UNAUTHORIZED:")) return 401;
  if (message.startsWith("FEATURE_ACCESS_DENIED:")) return 403;
  if (message.startsWith("RATE_LIMIT_EXCEEDED:")) return 429;
  if (message.startsWith("BUDGET_EXCEEDED:")) return 429;
  if (message.startsWith("IDEMPOTENCY_CONFLICT:")) return 409;
  if (message.startsWith("DEPENDENCY_UNAVAILABLE:")) return 502;
  if (message.startsWith("DOWNSTREAM_TIMEOUT:")) return 504;
  if (message.startsWith("INVALID_MODEL_OUTPUT:")) return 502;
  if (message.startsWith("INTERNAL_ERROR:")) return 500;
  if (message.includes("binding is not configured")) return 503;
  return 500;
}

export function toAiHttpError(
  error: unknown,
): { status: number; body: { success: false; error: AiError } } {
  const status = rpcErrorToHttpStatus(error);
  const message = error instanceof Error ? error.message : String(error);
  const code = message.split(":")[0] ?? "INTERNAL_ERROR";
  return {
    status,
    body: {
      success: false,
      error: {
        code: code as AiError["code"],
        message: message.slice(0, 500),
        requestId: "lte",
        retryable: status === 429 || status === 504,
      },
    },
  };
}
