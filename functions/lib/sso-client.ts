import type { AuthUser, MembershipStatus } from "@rareminds-eym/auth-core";
import type { LteEnv, SsoExchangeResponse } from "./types";

export function getSsoService(env: Pick<LteEnv, "SSO_SERVICE">) {
	if (!env.SSO_SERVICE) {
		throw new Error("SSO_SERVICE binding is not configured. Make sure sso-worker is running on port 8787.");
	}
	
	// Verify it's actually a service binding object
	if (typeof env.SSO_SERVICE !== 'object') {
		throw new Error(`SSO_SERVICE is not a valid service binding. Got type: ${typeof env.SSO_SERVICE}`);
	}
	
	return env.SSO_SERVICE;
}

export async function exchangeAuthorizationCode(
	env: Pick<LteEnv, "SSO_SERVICE">,
	params: {
		code: string;
		state: string;
		redirectUri: string;
		ip?: string | null;
		ua?: string | null;
	},
): Promise<SsoExchangeResponse> {
	return getSsoService(env).exchangeAuthorizationCode({
		...params,
		targetApp: "lte",
	});
}

export async function refreshLteSession(
	env: Pick<LteEnv, "SSO_SERVICE">,
	refreshToken: string,
	ip?: string | null,
	ua?: string | null,
): Promise<{ access_token: string; refresh_token: string }> {
	return getSsoService(env).refreshSession(refreshToken, ip ?? undefined, ua ?? undefined);
}

export async function logoutLteSession(
	env: Pick<LteEnv, "SSO_SERVICE">,
	refreshToken: string,
	ip?: string | null,
	ua?: string | null,
): Promise<{ success: boolean }> {
	return getSsoService(env).logoutSession(refreshToken, ip ?? undefined, ua ?? undefined);
}

export async function getMe(env: Pick<LteEnv, "SSO_SERVICE">, accessToken: string): Promise<AuthUser> {
	const result = await getSsoService(env).getMe(accessToken);
	return normalizeAuthUser(result);
}

function isMembershipStatus(value: string): value is MembershipStatus {
	return ["active", "inactive", "suspended", "expired"].includes(value);
}

export function normalizeAuthUser(value: Record<string, unknown>): AuthUser {
	const roles = Array.isArray(value["roles"])
		? value["roles"].filter((role): role is string => typeof role === "string")
		: [];
	const products = Array.isArray(value["products"])
		? value["products"].filter((product): product is string => typeof product === "string")
		: [];
	const membershipStatus = value["membership_status"];

	if (
		typeof value["sub"] !== "string" ||
		typeof value["email"] !== "string" ||
		typeof value["org_id"] !== "string" ||
		typeof value["is_email_verified"] !== "boolean" ||
		typeof membershipStatus !== "string"
	) {
		throw new Error("Invalid SSO user claims");
	}

	if (!isMembershipStatus(membershipStatus)) {
		throw new Error("Invalid SSO membership status");
	}

	const userMetadata =
		value["user_metadata"] && typeof value["user_metadata"] === "object" && !Array.isArray(value["user_metadata"])
			? (value["user_metadata"] as Record<string, unknown>)
			: {};

	return {
		sub: value["sub"],
		email: value["email"],
		org_id: value["org_id"],
		roles,
		products,
		membership_status: membershipStatus,
		is_email_verified: value["is_email_verified"],
		user_metadata: userMetadata,
	};
}
