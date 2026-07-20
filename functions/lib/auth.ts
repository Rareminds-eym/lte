import type { AuthUser } from "@rareminds-eym/auth-core";
import type { LteEnv } from "./types";
import { getMe } from "./sso-client";

export function extractBearerToken(request: Request): string | null {
	const authorization = request.headers.get("Authorization");
	if (!authorization?.startsWith("Bearer ")) return null;
	const token = authorization.slice("Bearer ".length).trim();
	return token || null;
}

export async function requireAuth(request: Request, env: Pick<LteEnv, "SSO_SERVICE">): Promise<AuthUser> {
	const token = extractBearerToken(request);
	if (!token) {
		throw new Error("Missing bearer token");
	}

	const user = await getMe(env, token);
	if (!user.products.includes("lte")) {
		throw new Error("LTE access is required");
	}

	return user;
}

export function toAuthApiUser(user: AuthUser) {
	return {
		id: user.sub,
		email: user.email,
		org_id: user.org_id,
		roles: user.roles,
		products: user.products,
		membership_status: user.membership_status,
		is_email_verified: user.is_email_verified,
		user_metadata: user.user_metadata ?? {},
	};
}
