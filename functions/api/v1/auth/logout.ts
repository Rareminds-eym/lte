import { clearRefreshCookies, getRefreshCookie } from "@functions/lib/cookies";
import { getClientIp, getUserAgent, jsonResponse } from "@functions/lib/http";
import { authLogger } from "@functions/lib/logger";
import { logoutLteSession } from "@functions/lib/sso-client";
import type { LteEnv, PagesContext } from "@functions/lib/types";

export async function onRequestPost(context: PagesContext<LteEnv>): Promise<Response> {
  const refreshToken = getRefreshCookie(context.request);

  if (refreshToken && context.env.SSO_SERVICE) {
    try {
      await logoutLteSession(
        context.env,
        refreshToken,
        getClientIp(context.request),
        getUserAgent(context.request),
      );
    } catch (error) {
      authLogger.error(
        "Error revoking session on SSO worker during logout",
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  const headers = new Headers();
  for (const cookie of clearRefreshCookies(context.env)) {
    headers.append("Set-Cookie", cookie);
  }

  return jsonResponse({ success: true }, { headers });
}
