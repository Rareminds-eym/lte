import { gatewayResponse } from "@functions/lib/gateway/gateway-envelope";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { apiLogger } from "@functions/shared/logger";
import { GatewayAuthError, getGatewaySecret, verifyServiceToken, verifyUserClaim } from "./auth";
import { EnvelopeSchema } from "./envelope";
import type { GatewayAction } from "./types";

/**
 * Per-caller configuration for the internal gateway. Each caller owns its own
 * secret (env var) and its own action registry, so one project can never
 * verify or dispatch another project's tokens.
 */
export interface CallerConfig {
  /** Must equal the `app` claim of the caller's signed service token. */
  app: string;
  /** Env var holding this caller's HMAC secret. */
  secretEnvKey: string;
  /** Actions this caller may dispatch (one handler per action name). */
  actions: Record<string, GatewayAction>;
}

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

/**
 * Build a complete internal gateway from a caller's config. The returned
 * function is a Pages Functions `onRequestPost` handler.
 *
 * Request pipeline (single security chokepoint, order matters):
 *   1. service token  → verify HMAC signature + expiry + app == caller.app
 *   2. per-user claim → verify HMAC signature + expiry + sub is uuid
 *   3. envelope       → Zod validate { action, requestId, payload }
 *   4. scope          → action must be granted by the service token
 *   5. dispatch       → action must exist in the CALLER's registry (zero logic here)
 *
 * Adding a caller = one `CallerConfig` + one thin endpoint file. No business
 * logic may live in the endpoint files.
 */
export function createInternalGateway(caller: CallerConfig) {
  return async function onRequestPost(context: PagesContext<LteEnv>): Promise<Response> {
    const { request, env } = context;

    try {
      const secret = getGatewaySecret(env, caller.secretEnvKey);

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
      if (serviceClaims.app !== caller.app) {
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
        apiLogger.warn("Internal gateway received an invalid JSON body", {
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

      // 5. Dispatch: the action must exist in THIS caller's registry
      const handler = caller.actions[action];
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
        // Map an error envelope code to an HTTP status. Codes not present here
        // (or a missing code) deliberately fall back to 500 so an unregistered
        // error code cannot masquerade as a success.
        const errorCode = result.error?.code ?? "";
        const statusMap: Record<string, number> = {
          VALIDATION_ERROR: 400,
          FORBIDDEN: 403,
          UNKNOWN_ACTION: 404,
          INTERNAL_ERROR: 500,
        };
        const status = statusMap[errorCode] ?? 500;
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
      apiLogger.error(`Internal gateway action failed (${caller.app})`, error);
      return gatewayResponse(
        { ok: false, error: { code: "INTERNAL_ERROR", message: "Internal gateway error" } },
        crypto.randomUUID(),
        500,
      );
    }
  };
}
