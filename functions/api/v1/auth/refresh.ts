import { clearRefreshCookies, createRefreshCookie, getRefreshCookie } from "@functions/lib/cookies";
import { validateBackendEnv } from "@functions/lib/env";
import { getClientIp, getUserAgent, jsonError, jsonResponse } from "@functions/lib/http";
import { authLogger } from "@functions/lib/logger";
import { refreshLteSession, SsoAuthError } from "@functions/lib/sso-client";
import type { LteEnv, PagesContext } from "@functions/lib/types";

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
