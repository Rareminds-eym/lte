import { describe, expect, it } from "vitest";
import { getAiWorker, rpcErrorToHttpStatus, toAiHttpError } from "../binding";
import type { LteAiServiceBinding } from "../binding";

describe("getAiWorker", () => {
  it("throws a wiring error without the binding, returns the stub per request", () => {
    expect(() => getAiWorker({})).toThrow("AI_SERVICE binding is not configured");
    const stub = {} as LteAiServiceBinding;
    expect(getAiWorker({ AI_SERVICE: stub })).toBe(stub);
  });
});

describe("rpcErrorToHttpStatus", () => {
  it("maps worker codes to HTTP statuses", () => {
    expect(rpcErrorToHttpStatus(new Error("INVALID_INPUT: bad"))).toBe(400);
    expect(rpcErrorToHttpStatus(new Error("UNAUTHORIZED: no"))).toBe(401);
    expect(rpcErrorToHttpStatus(new Error("FEATURE_ACCESS_DENIED: no"))).toBe(403);
    expect(rpcErrorToHttpStatus(new Error("RATE_LIMIT_EXCEEDED: slow"))).toBe(429);
    expect(rpcErrorToHttpStatus(new Error("BUDGET_EXCEEDED: spent"))).toBe(429);
    expect(rpcErrorToHttpStatus(new Error("IDEMPOTENCY_CONFLICT: dup"))).toBe(409);
    expect(rpcErrorToHttpStatus(new Error("DEPENDENCY_UNAVAILABLE: down"))).toBe(502);
    expect(rpcErrorToHttpStatus(new Error("DOWNSTREAM_TIMEOUT: slow"))).toBe(504);
    expect(rpcErrorToHttpStatus(new Error("INVALID_MODEL_OUTPUT: bad"))).toBe(502);
    expect(rpcErrorToHttpStatus(new Error("INTERNAL_ERROR: boom"))).toBe(500);
    expect(rpcErrorToHttpStatus(new Error("AI_SERVICE binding is not configured."))).toBe(503);
    expect(rpcErrorToHttpStatus(new Error("weird"))).toBe(500);
  });

  it("builds the shared error body with retryable flags", () => {
    const rate = toAiHttpError(new Error("RATE_LIMIT_EXCEEDED: slow"));
    expect(rate.status).toBe(429);
    expect(rate.body.error.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(rate.body.error.retryable).toBe(true);
    expect(rate.body.error.requestId).toBe("lte");
    const fatal = toAiHttpError(new Error("INVALID_INPUT: bad"));
    expect(fatal.body.error.retryable).toBe(false);
  });
});
