import { gatewayResponse } from "@functions/lib/gateway-envelope";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { apiLogger } from "@functions/shared/logger";
import { handleCapabilitiesGet } from "./capabilities/actions/capabilities-get";
import {
  GatewayAuthError,
  getGatewaySecret,
  verifyServiceToken,
  verifyUserClaim,
} from "./core/auth";
import { CALLER_APP } from "./core/contract";
import { EnvelopeSchema } from "./core/envelope";
import type { GatewayAction } from "./core/types";

/**
 * SkillPassport → LTE internal gateway — the single door for SP to read LTE data.
 * Service-token authenticated (shared secret), so it does NOT depend on the
 * learner's `products` claim (unlike `/api/v1/*`).
 *
 * POST /api/internal/skillpassport
 *   { action, requestId, payload }  +  Bearer <service token>
 *                                   +  X-Lte-Claim / X-Lte-Sig (per-user, 60s)
 *
 * Request pipeline (single security chokepoint, order matters):
 *   1. service token  → verify HMAC signature + expiry + app == CALLER_APP
 *   2. per-user claim → verify HMAC signature + expiry + sub is uuid
 *   3. envelope       → Zod validate { action, requestId, payload }
 *   4. scope          → action must be granted by the service token
 *   5. dispatch       → action REGISTRY (one file per action, zero logic here)
 *
 * Adding an action = one handler file + one REGISTRY line here. No business
 * logic may live in this file.
 */

export const REGISTRY: Record<string, GatewayAction> = {
  "capabilities:get": handleCapabilitiesGet,
};

/** Actions this gateway advertises — derived from the registry so it can't drift. */
export const SUPPORTED_ACTIONS: readonly string[] = Object.keys(REGISTRY);

/**
 * Public origin of the request, used to build deep-links (resumeUrl) that the
 * caller opens in a browser. Production: the real request URL. Local dev under
 * `wrangler pages dev` depends on wrangler.toml `[dev] host = "localhost:8789"`
 * (host WITH port) — a bare host like "localhost" makes the dev proxy rewrite
 * the URL to "http://localhost" and the port is lost from origin.
 */
export function getPublicOrigin(request: Request): string {
  return new URL(request.url).origin;
}

export async function onRequestPost(context: PagesContext<LteEnv>): Promise<Response> {
  const { request, env } = context;

  try {
    const secret = getGatewaySecret(env);

    // 1. Service token
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return gatewayResponse(
        { ok: false, error: { code: "UNAUTHORIZED", message: "Missing bearer token" } },
        crypto.randomUUID(),
        401,
      );
    }
    const serviceClaims = await verifyServiceToken(secret, authHeader.slice("Bearer ".length));
    if (serviceClaims.app !== CALLER_APP) {
      return gatewayResponse(
        { ok: false, error: { code: "FORBIDDEN", message: "Caller app is not authorized" } },
        crypto.randomUUID(),
        403,
      );
    }

    // 2. Per-user claim
    const userClaim = await verifyUserClaim(
      secret,
      request.headers.get("X-Lte-Claim") ?? "",
      request.headers.get("X-Lte-Sig") ?? "",
    );

    // 3. Envelope
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch (error) {
      apiLogger.warn("SkillPassport gateway received an invalid JSON body", {
        error: error instanceof Error ? error.message : "Unknown parse error",
      });
      return gatewayResponse(
        { ok: false, error: { code: "BAD_REQUEST", message: "Request body must be valid JSON" } },
        crypto.randomUUID(),
        400,
      );
    }
    const envelope = EnvelopeSchema.safeParse(rawBody);
    if (!envelope.success) {
      return gatewayResponse(
        { ok: false, error: { code: "VALIDATION_ERROR", message: "Invalid request envelope" } },
        crypto.randomUUID(),
        400,
      );
    }
    const { action, requestId, payload } = envelope.data;

    // 4. Scope: the service token must grant this action
    if (!serviceClaims.actions.includes(action)) {
      return gatewayResponse(
        {
          ok: false,
          error: { code: "FORBIDDEN", message: `Caller not granted action: ${action}` },
        },
        requestId,
        403,
      );
    }

    // 5. Dispatch
    const handler = REGISTRY[action];
    if (!handler) {
      return gatewayResponse(
        { ok: false, error: { code: "UNKNOWN_ACTION", message: `Unknown action: ${action}` } },
        requestId,
        404,
      );
    }

    const result = await handler(
      { env, request, requestId, userId: userClaim.sub, origin: getPublicOrigin(request) },
      payload,
    );
    if (!result.ok) {
      const status =
        {
          VALIDATION_ERROR: 400,
          FORBIDDEN: 403,
          UNKNOWN_ACTION: 404,
          INTERNAL_ERROR: 500,
        }[result.error?.code ?? ""] ?? 500;
      return gatewayResponse(result, requestId, status);
    }
    return gatewayResponse(result, requestId);
  } catch (error) {
    if (error instanceof GatewayAuthError) {
      const status = error.code === "FORBIDDEN" ? 403 : error.code === "BAD_REQUEST" ? 400 : 401;
      return gatewayResponse(
        { ok: false, error: { code: error.code, message: error.message } },
        crypto.randomUUID(),
        status,
      );
    }
    apiLogger.error("SkillPassport gateway action failed", error);
    return gatewayResponse(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Internal gateway error" } },
      crypto.randomUUID(),
      500,
    );
  }
}
