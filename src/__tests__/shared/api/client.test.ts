import { beforeEach, describe, expect, it, vi } from "vitest";
import { authClient } from "@/shared/api/authClient";
import { apiFetch, apiPreAuthFetch } from "@/shared/api/client";

vi.mock("@/shared/api/authClient", () => ({
  authClient: { request: vi.fn() },
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const okJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("apiFetch (authenticated path via authClient.request)", () => {
  it("parses JSON responses through authClient.request", async () => {
    (authClient.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(okJson({ id: 7 }));

    await expect(apiFetch("/api/v1/dashboard/journey")).resolves.toEqual({ id: 7 });
    expect(authClient.request).toHaveBeenCalledWith(
      "/api/v1/dashboard/journey",
      expect.objectContaining({ signal: expect.any(Object) }),
    );
  });

  it("preserves code/details/requestId from nested error bodies in ApiError", async () => {
    (authClient.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      okJson(
        { error: { message: "Nope", code: "SERVER_ERROR", details: { z: 1 }, requestId: "req-9" } },
        500,
      ),
    );

    await expect(apiFetch("/api/v1/x")).rejects.toMatchObject({
      status: 500,
      code: "SERVER_ERROR",
      requestId: "req-9",
      details: { z: 1 },
      message: "Nope",
    });
  });

  it("propagates the thrown error when authClient.request fails in production mode", async () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("NODE_ENV", "production");
    (authClient.request as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("The authenticated session is unavailable."),
    );

    await expect(apiFetch("/api/v1/x")).rejects.toThrow(
      "The authenticated session is unavailable.",
    );
    expect(fetchMock).not.toHaveBeenCalled(); // no silent fallback outside tests
    vi.unstubAllEnvs();
  });
});

describe("apiPreAuthFetch (pre-auth exchange path)", () => {
  it("posts JSON with include credentials without requiring a session", async () => {
    fetchMock.mockResolvedValueOnce(okJson({ access_token: "at" }));

    await expect(
      apiPreAuthFetch("/api/v1/auth/sso/exchange", {
        method: "POST",
        body: JSON.stringify({ code: "c" }),
      }),
    ).resolves.toEqual({ access_token: "at" });

    const call = fetchMock.mock.calls[0];
    if (!call) throw new Error("expected a fetch call");
    const init = call[1] as RequestInit & { headers: Headers };
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(init.headers.get("Content-Type")).toBe("application/json");
    expect(authClient.request).not.toHaveBeenCalled();
  });

  it("maps failure bodies to a rich ApiError", async () => {
    fetchMock.mockResolvedValueOnce(
      okJson(
        {
          error: { message: "Authentication failed", code: "AUTH_EXCHANGE_FAILED" },
          requestId: "req-1",
        },
        401,
      ),
    );

    await expect(
      apiPreAuthFetch("/api/v1/auth/sso/exchange", { method: "POST" }),
    ).rejects.toMatchObject({
      status: 401,
      code: "AUTH_EXCHANGE_FAILED",
      requestId: "req-1",
      message: "Authentication failed",
    });
  });

  it("aborts the request when the upstream exceeds the bounded timeout", async () => {
    vi.useFakeTimers();
    let capturedInit: RequestInit = {};
    fetchMock.mockImplementationOnce(
      (_path: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          capturedInit = init;
          init.signal?.addEventListener("abort", () =>
            reject(init.signal?.reason ?? new Error("aborted")),
          );
        }),
    );

    const pending = apiPreAuthFetch("/api/v1/auth/sso/exchange", { method: "POST" });
    pending.catch(() => {}); // no unhandled rejection noise
    await vi.advanceTimersByTimeAsync(15_000);

    expect((capturedInit.signal as AbortSignal).aborted).toBe(true);
    await expect(pending).rejects.toBeTruthy();
    vi.useRealTimers();
  });
});
