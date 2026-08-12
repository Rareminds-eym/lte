import { z } from "zod";

/**
 * Shared response-envelope contract for the LTE ↔ SkillPassport internal gateway.
 *
 * Every gateway response is `{ ok, data | error, requestId }`:
 *   - the server builds it with `gatewayResponse(...)` (functions/api/internal/skillpassport)
 *   - the caller parses it with `GatewayEnvelopeSchema` (functions/lib/skill-gateway.ts,
 *     skillpassport/functions/lib/lte/lte-gateway-client.ts)
 * Both sides share this exact shape; the gateway-contract tests guard drift.
 */
export const GatewayEnvelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: z.object({ code: z.string(), message: z.string() }).optional(),
  requestId: z.string().optional(),
});

export type GatewayEnvelope = z.infer<typeof GatewayEnvelopeSchema>;

/** Result envelope produced by every gateway action (data XOR error). */
export interface GatewayResult {
  ok: boolean;
  data?: unknown;
  error?: { code: string; message: string };
}

/** Build an error result (used by actions and helpers). */
export function errorResult(code: string, message: string): GatewayResult {
  return { ok: false, error: { code, message } };
}

/** Build the full HTTP gateway response envelope (used by the server dispatcher). */
export function gatewayResponse(result: GatewayResult, requestId: string, status = 200): Response {
  const body: Record<string, unknown> = { ok: result.ok, requestId };
  if (result.ok) {
    body["data"] = result.data;
  } else {
    body["error"] = result.error;
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "X-Request-ID": requestId },
  });
}
