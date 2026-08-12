import { beforeEach, describe, expect, it, vi } from "vitest";
import { callSkill } from "../skill-gateway";

describe("Skill Gateway client", () => {
  const env = {
    SKILLPASSPORT_INTERNAL_URL: "https://skillpassport.test",
    SKILLPASSPORT_INTERNAL_SECRET: "mock-secret-at-least-32-chars-long-here",
  };
  const userId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("should fail-fast if environment config is missing or invalid secret", async () => {
    const badEnv = {
      SKILLPASSPORT_INTERNAL_URL: "",
      SKILLPASSPORT_INTERNAL_SECRET: "short",
    };
    await expect(callSkill(badEnv, "ping", {}, userId)).rejects.toThrow(
      "Skill gateway env is not configured",
    );
  });

  it("should execute fetch call with correct headers and payload format", async () => {
    const mockResponse = {
      ok: true,
      data: { pong: true },
      requestId: "test-req-id",
    };

    vi.mocked(globalThis.fetch).mockResolvedValue({
      status: 200,
      json: async () => mockResponse,
    } as unknown as Response);

    const result = await callSkill(env, "ping", { foo: "bar" }, userId);
    expect(result).toEqual({ pong: true });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://skillpassport.test/api/internal/lte/v1",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: expect.stringContaining("Bearer "),
          "X-Lte-Claim": expect.any(String),
          "X-Lte-Sig": expect.any(String),
        }),
      }),
    );

    // Verify request body contains expected parameters
    const fetchArgs = vi.mocked(globalThis.fetch).mock.calls[0]?.[1];
    const body = JSON.parse(fetchArgs?.body as string);
    expect(body).toEqual({
      action: "ping",
      requestId: expect.any(String),
      payload: { foo: "bar" },
    });
  });

  it("should throw GatewayCallError on non-200 HTTP status response", async () => {
    const errorResponse = {
      ok: false,
      error: { code: "FORBIDDEN", message: "Forbidden" },
    };

    vi.mocked(globalThis.fetch).mockResolvedValue({
      status: 403,
      json: async () => errorResponse,
    } as unknown as Response);

    await expect(callSkill(env, "learning-track:get", { userId }, userId)).rejects.toThrow(
      "Forbidden",
    );
  });

  it("should fall back to HTTP status code when gateway error payload lacks a code/message", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      status: 502,
      json: async () => ({ ok: false }),
    } as unknown as Response);

    await expect(callSkill(env, "ping", {}, userId)).rejects.toThrow("Skill gateway returned 502");
    await expect(callSkill(env, "ping", {}, userId)).rejects.toMatchObject({
      code: "HTTP_502",
    });
  });

  it("should throw GatewayCallError when gateway returns malformed JSON", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token");
      },
    } as unknown as Response);

    await expect(callSkill(env, "ping", {}, userId)).rejects.toThrow("Skill gateway returned 200");
  });

  it("should throw GatewayCallError if fetch throws network error", async () => {
    vi.mocked(globalThis.fetch).mockRejectedValue(new Error("Network connection failure"));

    await expect(callSkill(env, "ping", {}, userId)).rejects.toThrow("Skill gateway unreachable");
  });

  it("should throw Timeout error on abort signal trigger", async () => {
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    vi.mocked(globalThis.fetch).mockRejectedValue(abortError);

    await expect(callSkill(env, "ping", {}, userId)).rejects.toThrow("Skill gateway timed out");
  });
});
