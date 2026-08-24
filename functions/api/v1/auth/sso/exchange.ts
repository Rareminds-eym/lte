import { createRefreshCookie } from "@functions/lib/cookies";
import { validateBackendEnv } from "@functions/lib/env";
import {
  getClientIp,
  getUserAgent,
  jsonError,
  jsonResponse,
  readJsonObject,
} from "@functions/lib/http";
import { createServiceQueryGateway } from "@functions/lib/query-gateway";
import { exchangeAuthorizationCode } from "@functions/lib/sso-client";
import { syncSsoShadowData } from "@functions/lib/sync-shadow";
import type {
  AuthSuccessResponse,
  LteEnv,
  PagesContext,
  SsoExchangeResponse,
  SsoServiceBinding,
} from "../../../../lib/types";
import { triggerDailyLoginWithEngagement } from "../../../../lib/xp-engine";
import { toAuthApiUser } from "../../../../middleware/auth";
import { ssoLogger } from "../../../../shared/logger";

// Outbound SSO RPCs must be bounded so a hung SSO worker cannot stall the isolate.
const SSO_RPC_TIMEOUT_MS = 8_000;

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${SSO_RPC_TIMEOUT_MS}ms`)),
      SSO_RPC_TIMEOUT_MS,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function getStringField(body: Record<string, unknown>, field: string): string | null {
  const value = body[field];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function onRequestPost(context: PagesContext<LteEnv>): Promise<Response> {
  const requestId = crypto.randomUUID();
  const ssoService = context.env.SSO_SERVICE as SsoServiceBinding;
  try {
    validateBackendEnv(context.env);
    ssoLogger.debug("SSO_SERVICE binding available");

    const body = await readJsonObject(context.request);
    const code = getStringField(body, "code");
    const state = getStringField(body, "state");
    const redirectUri = getStringField(body, "redirectUri");

    if (!code || !state || !redirectUri) {
      return jsonError("code, state, and redirectUri are required", 400);
    }

    ssoLogger.info("Exchanging authorization code for tokens...");

    let exchange: SsoExchangeResponse;
    try {
      exchange = await withTimeout(
        ssoService.exchangeAuthorizationCode({
          code,
          state,
          redirectUri,
          targetApp: "lte",
          ip: context.request.headers.get("CF-Connecting-IP") || undefined,
          ua: context.request.headers.get("User-Agent") || undefined,
        }),
        "SSO authorization-code exchange",
      );
    } catch (err) {
      // Full detail stays server-side; the client gets a sanitized message (OWASP).
      ssoLogger.error("SSO exchange failed", err instanceof Error ? err : new Error(String(err)), {
        requestId,
      });
      return jsonError("Authentication failed", 401, {
        code: "AUTH_EXCHANGE_FAILED",
        requestId,
      });
    }

    ssoLogger.info("Exchange successful", { userId: exchange.user.sub });

    if (!exchange.user.products.includes("lte")) {
      return jsonError("LTE access is required", 403, { requestId });
    }

    // BLOCKING and FAIL-CLOSED: must complete before any tokens are issued.
    // authClient.initialize() fires immediately after this response, rotating the
    // session and running get_jwt_claims(). If provisioning did not succeed, that
    // rotation would fail — issuing a known-bad session is worse than retryable 503.
    let provisioned = false;
    try {
      const provision = await withTimeout(
        ssoService.provisionLteAccess({
          userId: exchange.user.sub,
          orgId: exchange.user.org_id,
        }),
        "LTE provisioning",
      );
      provisioned = provision.success === true;
    } catch (err) {
      ssoLogger.error(
        "LTE provisioning threw unexpectedly",
        err instanceof Error ? err : new Error(String(err)),
        {
          userId: exchange.user.sub,
          requestId,
        },
      );
    }
    if (!provisioned) {
      ssoLogger.error("LTE provisioning failed — failing closed", undefined, {
        userId: exchange.user.sub,
        requestId,
      });
      return jsonError("Account setup is incomplete. Please try signing in again.", 503, {
        code: "LTE_PROVISIONING_FAILED",
        requestId,
      });
    }
    ssoLogger.debug("LTE product provisioned", { userId: exchange.user.sub, requestId });

    const headers = new Headers();
    const cookieName = "__Host-rm-refresh";
    const attributes = "Secure; HttpOnly; Path=/; SameSite=Strict";
    const maxAge = 604800; // 7-day refresh token lifetime
    const cookieHeader = `${cookieName}=${exchange.refresh_token}; ${attributes}; Max-Age=${maxAge}`;
    ssoLogger.debug("Setting refresh cookie", {
      cookieName,
      url: context.request.url,
    });
    headers.set("Set-Cookie", cookieHeader);

    try {
      const supabase = createServiceSupabase(context.env);
      await syncSsoShadowData(supabase, exchange.user, exchange.subscription);
      // Background task: award daily login + streak/consistency/legacy XP.
      // Registered with waitUntil to ensure execution finishes after response is returned.
      const bgTask = triggerDailyLoginWithEngagement(supabase, exchange.user.sub).catch((err) => {
        ssoLogger.error("[XP] daily login engagement failed (exchange)", err, {
          userId: exchange.user.sub,
        });
      });
      if (typeof context.waitUntil === "function") {
        context.waitUntil(bgTask);
      }
    } catch (err) {
      ssoLogger.error(
        "SSO shadow sync failed",
        err instanceof Error ? err : new Error(String(err)),
        {
          requestId,
        },
      );
      return jsonError("Internal server error during authentication sync", 500, { requestId });
    }

    return jsonResponse<AuthSuccessResponse>(
      {
        access_token: exchange.access_token,
        user: toAuthApiUser(exchange.user),
        expires_in: exchange.expires_in ?? 900,
      },
      { headers },
    );
  } catch (error) {
    const requestId = crypto.randomUUID();
    ssoLogger.error("SSO request processing failed", error, { requestId });
    return jsonError("Internal server error during authentication", 500, {
      code: "AUTH_EXCHANGE_FAILED",
      requestId,
    });
  }
}
