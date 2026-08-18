import { errorResult } from "@functions/lib/gateway/gateway-envelope";
import { createServiceSupabase } from "@functions/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import type { GatewayAction, GatewayContext } from "./types";

export { errorResult } from "@functions/lib/gateway/gateway-envelope";

type ServiceSupabase = SupabaseClient;

/**
 * Builds a GatewayAction from only the parts that differ per action: the payload
 * schema and the business logic. Centralizes ONCE the response envelope, the
 * action-payload validation, the service supabase client creation, and the
 * security check that the requested `userId` must equal the authenticated claim
 * subject. Handlers no longer repeat that boilerplate.
 *
 * The `run` callback returns only the `data` payload; it is wrapped as
 * `{ ok: true, data }`. Business errors are surfaced by throwing — they are
 * caught here and mapped to an `INTERNAL_ERROR` envelope, which the
 * dispatcher turns into a 500. Handlers may also return an error envelope
 * via `errorResult` (wrapped as data).
 */
export function defineAction<TPayload extends { userId: string }>(opts: {
  payloadSchema: z.ZodType<TPayload>;
  run: (ctx: GatewayContext, payload: TPayload, supabase: ServiceSupabase) => Promise<unknown>;
}): GatewayAction {
  return async (ctx, payload) => {
    const parsed = opts.payloadSchema.safeParse(payload);
    if (!parsed.success) {
      return errorResult("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid payload");
    }

    if (parsed.data.userId !== ctx.userId) {
      return errorResult("FORBIDDEN", "Requested user does not match the authenticated claim");
    }

    const supabase = createServiceSupabase(ctx.env);
    try {
      const data = await opts.run(ctx, parsed.data, supabase);
      return { ok: true, data };
    } catch (error) {
      return errorResult(
        "INTERNAL_ERROR",
        error instanceof Error ? error.message : "Unknown action error",
      );
    }
  };
}
