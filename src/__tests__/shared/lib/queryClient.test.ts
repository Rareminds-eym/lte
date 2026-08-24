import { ApiError } from "@/shared/api/ApiError";
import { queryClient, shouldRetryQuery } from "@/shared/lib/queryClient";

const abortError = () => {
  const e = new DOMException("Aborted", "AbortError");
  return e;
};

describe("shouldRetryQuery (global TanStack retry policy)", () => {
  it("never retries 4xx client errors", () => {
    expect(shouldRetryQuery(0, new ApiError("Nope", 404))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError("Unauthorized", 401))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError("Forbidden", 403))).toBe(false);
    expect(shouldRetryQuery(3, new ApiError("Unprocessable", 422))).toBe(false);
  });

  it("never retries aborted requests", () => {
    expect(shouldRetryQuery(0, abortError())).toBe(false);
    const named = new Error("abort");
    named.name = "AbortError";
    expect(shouldRetryQuery(0, named)).toBe(false);
  });

  it("retries network dropouts / 5xx exactly once", () => {
    expect(shouldRetryQuery(0, new Error("fetch failed"))).toBe(true);
    expect(shouldRetryQuery(1, new Error("fetch failed"))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError("Boom", 503))).toBe(true);
    expect(shouldRetryQuery(1, new ApiError("Boom", 503))).toBe(false);
  });
});

describe("queryClient cache telemetry listeners", () => {
  it("wires QueryCache and MutationCache error listeners for centralized logging", () => {
    const onError = queryClient.getQueryCache().config.onError;
    const onMutationError = queryClient.getMutationCache().config.onError;
    expect(typeof onError).toBe("function");
    expect(typeof onMutationError).toBe("function");

    // Invoking them must not throw even with non-Error payloads (unknown reasons).
    expect(() =>
      (onError as (e: unknown, q: unknown) => void)(new Error("x"), { queryKey: ["k"] }),
    ).not.toThrow();
    expect(() =>
      (onMutationError as (e: unknown, v: unknown, c: unknown, m: unknown) => void)(
        "string reason",
        {},
        {},
        { options: {} },
      ),
    ).not.toThrow();
  });
});
