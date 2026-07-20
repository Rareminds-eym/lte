import { clearRefreshCookies, getRefreshCookie } from "../../lib/cookies";
import { getClientIp, getUserAgent, jsonResponse } from "../../lib/http";
import { logoutLteSession } from "../../lib/sso-client";
import type { LteEnv, PagesContext } from "../../lib/types";

export async function onRequestPost(context: PagesContext<LteEnv>): Promise<Response> {
	const refreshToken = getRefreshCookie(context.request, context.env);
	if (refreshToken) {
		await logoutLteSession(context.env, refreshToken, getClientIp(context.request), getUserAgent(context.request)).catch(
			() => ({ success: false }),
		);
	}

	const headers = new Headers();
	for (const cookie of clearRefreshCookies(context.env)) {
		headers.append("Set-Cookie", cookie);
	}

	return jsonResponse({ success: true }, { headers });
}
