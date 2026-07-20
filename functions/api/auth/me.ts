import { requireAuth, toAuthApiUser } from "../../lib/auth";
import { jsonError, jsonResponse } from "../../lib/http";
import type { LteEnv, PagesContext } from "../../lib/types";

export async function onRequestGet(context: PagesContext<LteEnv>): Promise<Response> {
	try {
		const user = await requireAuth(context.request, context.env);
		return jsonResponse({ user: toAuthApiUser(user) });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unauthenticated";
		return jsonError(message, 401);
	}
}
