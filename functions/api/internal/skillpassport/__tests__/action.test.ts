import { errorResult } from "@functions/lib/gateway-envelope";
import { createServiceSupabase } from "@functions/lib/supabase";
import type { LteEnv } from "@functions/lib/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { defineAction } from "../action";
import type { GatewayContext } from "../types";

vi.mock("@functions/lib/supabase", () => ({
  createServiceSupabase: vi.fn(() => ({ mockClient: true })),
}));

const USER_ID = "11111111-1111-4111-8111-111111111111";

const ctx = {
  env: { LTE_PUBLIC_URL: "https://lte.test" } as unknown as LteEnv,
  request: new Request("http://lte.test/api/internal/skillpassport"),
  requestId: "req-1",
  userId: USER_ID,
} as unknown as GatewayContext;

const PayloadSchema = z.object({ userId: z.string().uuid(), extra: z.string().optional() });

describe("defineAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates the payload against the schema before running the handler", async () => {
    const run = vi.fn(async () => "ran");
    const action = defineAction({ payloadSchema: PayloadSchema, run });

    const result = await action(ctx, { userId: "not-a-uuid", extra: 42 } as never);

    expect(result).toEqual({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: expect.any(String) },
    });
    expect(run).not.toHaveBeenCalled();
  });

  it("rejects payloads whose userId does not match the authenticated claim", async () => {
    const run = vi.fn(async () => "ran");
    const action = defineAction({ payloadSchema: PayloadSchema, run });

    const result = await action(ctx, { userId: "22222222-2222-4222-8222-222222222222" });

    expect(result).toEqual({
      ok: false,
      error: { code: "FORBIDDEN", message: expect.any(String) },
    });
    expect(run).not.toHaveBeenCalled();
  });

  it("runs the handler and wraps its result in a success envelope", async () => {
    const run = vi.fn(async () => ({ capabilities: ["a"] }));
    const action = defineAction({ payloadSchema: PayloadSchema, run });

    const result = await action(ctx, { userId: USER_ID });

    expect(result).toEqual({ ok: true, data: { capabilities: ["a"] } });
    expect(createServiceSupabase).toHaveBeenCalledWith(ctx.env);
    expect(run).toHaveBeenCalledOnce();
    expect(run).toHaveBeenCalledWith(
      ctx,
      { userId: USER_ID },
      expect.objectContaining({ mockClient: true }),
    );
  });

  it("wraps whatever the handler returns — even an error envelope — as success data", async () => {
    const action = defineAction({
      payloadSchema: PayloadSchema,
      run: async () => errorResult("NOT_FOUND", "No data"),
    });

    const result = await action(ctx, { userId: USER_ID });

    expect(result).toEqual({
      ok: true,
      data: { ok: false, error: { code: "NOT_FOUND", message: "No data" } },
    });
  });

  it("catches handler exceptions and maps them to an INTERNAL_ERROR envelope", async () => {
    const action = defineAction({
      payloadSchema: PayloadSchema,
      run: async () => {
        throw new Error("db exploded");
      },
    });

    const result = await action(ctx, { userId: USER_ID });

    expect(result).toEqual({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "db exploded" },
    });
  });
});
