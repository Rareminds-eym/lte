import { createRefreshCookie, getRefreshCookie } from "../../lib/cookies";
import { getClientIp, getUserAgent, jsonError, jsonResponse } from "../../lib/http";
import { refreshLteSession } from "../../lib/sso-client";
import { authLogger } from "../../lib/logger";
import type { LteEnv, PagesContext } from "../../lib/types";

export async function onRequestPost(context: PagesContext<LteEnv>): Promise<Response> {
	try {
		if (!context.env.SSO_SERVICE) {
			authLogger.error("SSO_SERVICE binding missing!");
			return jsonError("SSO service not available. Ensure sso-worker is running.", 500);
		}

		authLogger.debug("Request received", {
			url: context.request.url,
			hasCookieHeader: !!context.request.headers.get("Cookie"),
		});

		const refreshToken = getRefreshCookie(context.request, context.env);
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
		headers.set("Set-Cookie", createRefreshCookie(refreshed.refresh_token, context.env, context.request));

		return jsonResponse({ access_token: refreshed.access_token, expires_in: 900 }, { headers });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Refresh failed";
		authLogger.error("Session refresh failed", error instanceof Error ? error : new Error(message));
		return jsonError(message, 401);
	}
}

