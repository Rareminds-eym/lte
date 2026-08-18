import { clearRefreshCookies, createRefreshCookie, getRefreshCookie } from "@functions/lib/cookies";
import { validateBackendEnv } from "@functions/lib/env";
import { getClientIp, getUserAgent, jsonError, jsonResponse } from "@functions/lib/http";
import { createServiceQueryGateway } from "@functions/lib/query-gateway";
import { refreshLteSession, SsoAuthError } from "@functions/lib/sso-client";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { triggerDailyLoginWithEngagement } from "@functions/lib/xp-engine";
import { authLogger } from "@functions/shared/logger";

export async function onRequestPost(context: PagesContext<LteEnv>): Promise<Response> {
  try {
    validateBackendEnv(context.env);

    authLogger.debug("Request received", {
      url: context.request.url,
      hasCookieHeader: !!context.request.headers.get("Cookie"),
    });

    const refreshToken = getRefreshCookie(context.request);
    authLogger.debug("Extracted refresh token", {
      hasRefreshToken: !!refreshToken,
      tokenLength: refreshToken ? refreshToken.length : 0,
    });

    if (!refreshToken) {
      return jsonError("LTE refresh cookie is missing", 401);
    }

    authLogger.info("Calling SSO refreshLteSession...");

    const refreshed = await refreshLteSession(
      context.env,
      refreshToken,
      getClientIp(context.request),
      getUserAgent(context.request),
    );

    authLogger.info("Refresh successful, returning new tokens");

    // Decode JWT payload (base64url middle part) to extract userId without a full JWT library
    try {
      const payloadB64 = refreshed.access_token.split(".")[1];
      if (payloadB64) {
        const payloadJson = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
        const payload = JSON.parse(payloadJson) as Record<string, unknown>;
        const userId = typeof payload["sub"] === "string" ? payload["sub"] : null;
        if (userId) {
          const qb = createServiceQueryGateway(context.env);
          // Fire-and-forget: award daily login + streak/consistency/legacy XP.
          // Never fails the auth response.
          triggerDailyLoginWithEngagement(qb, userId).catch((err) => {
            authLogger.error("[XP] daily login engagement failed (refresh)", err, { userId });
          });
        }
      }
    } catch {
      // Non-fatal: engagement XP errors must never block token refresh
    }

    const headers = new Headers();
    headers.set(
      "Set-Cookie",
      createRefreshCookie(refreshed.refresh_token, context.request, context.env),
    );

    return jsonResponse({ access_token: refreshed.access_token, expires_in: 900 }, { headers });
  } catch (error) {
    if (error instanceof SsoAuthError) {
      const message = error.message;
      authLogger.info("Session refresh unauthenticated", { message });

      const headers = new Headers();
      for (const cookie of clearRefreshCookies(context.env)) {
        headers.append("Set-Cookie", cookie);
      }

      return jsonError(message, 401, { headers });
    }

    const message = error instanceof Error ? error.message : "Refresh failed";
    authLogger.error(
      "Session refresh system error",
      error instanceof Error ? error : new Error(message),
    );
    return jsonError("Internal server error during session refresh", 500);
  }
}
