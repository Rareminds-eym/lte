import { describe, expect, it } from "vitest";
import { errorResult, GatewayEnvelopeSchema, gatewayResponse } from "../gateway-envelope";

describe("errorResult", () => {
  it("builds an error envelope", () => {
    expect(errorResult("FORBIDDEN", "Nope")).toEqual({
      ok: false,
      error: { code: "FORBIDDEN", message: "Nope" },
    });
  });

  it("preserves the PROVIDES error shape contract", () => {
    const result = errorResult("VALIDATION_ERROR", "Invalid payload");
    expect(GatewayEnvelopeSchema.safeParse({ ...result, requestId: "r1" }).success).toBe(true);
  });
});

describe("gatewayResponse", () => {
  it("serializes success envelopes with status 200 and request id header", async () => {
    const response = gatewayResponse({ ok: true, data: { pong: true } }, "req-1");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(response.headers.get("X-Request-ID")).toBe("req-1");
    await expect(response.json()).resolves.toEqual({
      ok: true,
      requestId: "req-1",
      data: { pong: true },
    });
  });

  it("serializes error envelopes and honors a custom status code", async () => {
    const response = gatewayResponse(
      { ok: false, error: { code: "FORBIDDEN", message: "Nope" } },
      "req-2",
      403,
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      requestId: "req-2",
      error: { code: "FORBIDDEN", message: "Nope" },
    });
  });

  it("produces a body that matches the shared envelope schema", async () => {
    const body = await gatewayResponse({ ok: true, data: [1, 2] }, "req-3").json();
    expect(GatewayEnvelopeSchema.safeParse(body).success).toBe(true);
  });
});
