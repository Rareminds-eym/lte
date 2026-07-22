import { createRefreshCookie } from "@functions/lib/cookies";
import { toAuthApiUser } from "@functions/lib/auth";
import { getClientIp, getUserAgent, jsonError, jsonResponse, readJsonObject } from "@functions/lib/http";
import { exchangeAuthorizationCode } from "@functions/lib/sso-client";
import { createServiceSupabase } from "@functions/lib/supabase";
import { syncSsoShadowData } from "@functions/lib/sync-shadow";
import { ssoLogger } from "@functions/lib/logger";
import type { AuthSuccessResponse, LteEnv, PagesContext } from "@functions/lib/types";

function getStringField(body: Record<string, unknown>, field: string): string | null {
	const value = body[field];
	return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function onRequestPost(context: PagesContext<LteEnv>): Promise<Response> {
	try {
		if (!context.env.SSO_SERVICE) {
			ssoLogger.error("SSO_SERVICE binding missing!");
			return jsonError("SSO service not available. Ensure sso-worker is running.", 500);
		}
		ssoLogger.debug("SSO_SERVICE binding available");

		const body = await readJsonObject(context.request);
		const code = getStringField(body, "code");
		const state = getStringField(body, "state");
		const redirectUri = getStringField(body, "redirectUri");

		if (!code || !state || !redirectUri) {
			return jsonError("code, state, and redirectUri are required", 400);
		}

		ssoLogger.info("Exchanging authorization code for tokens...");

		const exchange = await exchangeAuthorizationCode(context.env, {
			code,
			state,
			redirectUri,
			ip: getClientIp(context.request),
			ua: getUserAgent(context.request),
		});

		ssoLogger.info("Exchange successful", { userId: exchange.user.sub });

		if (!exchange.user.products.includes("lte")) {
			return jsonError("LTE access is required", 403);
		}

		const headers = new Headers();
		const cookieHeader = createRefreshCookie(exchange.refresh_token, context.request);
		ssoLogger.debug("Setting refresh cookie", { cookieName: cookieHeader.split("=")[0], url: context.request.url });
		headers.set("Set-Cookie", cookieHeader);

		const supabase = createServiceSupabase(context.env);
		await syncSsoShadowData(supabase, exchange.user, exchange.subscription);

		return jsonResponse<AuthSuccessResponse>(
			{
				access_token: exchange.access_token,
				user: toAuthApiUser(exchange.user),
				expires_in: exchange.expires_in ?? 900,
			},
			{ headers },
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : "SSO exchange failed";
		ssoLogger.error("SSO exchange failed", error instanceof Error ? error : new Error(message));
		return jsonError(message, 401);
	}
}
