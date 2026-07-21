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
	const service = getSsoService(env) as unknown as {
		authenticateSharedSession?: (
			refreshToken: string,
			targetApp: string,
			ip?: string,
			ua?: string,
		) => Promise<{ success?: boolean; access_token?: string; refresh_token?: string; error?: string }>;
		refreshSession: (
			refreshToken: string,
			ip?: string,
			ua?: string,
		) => Promise<{ access_token: string; refresh_token: string }>;
	};
	if (typeof service.authenticateSharedSession === "function") {
		const res = await service.authenticateSharedSession(refreshToken, "lte", ip ?? undefined, ua ?? undefined);
		if (!res?.success || !res?.access_token) {
			throw new Error(res?.error || "Invalid or revoked session");
		}
		return { access_token: res.access_token, refresh_token: res.refresh_token || refreshToken };
	}
	return service.refreshSession(refreshToken, ip ?? undefined, ua ?? undefined);
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
interface RawSsoUser {
	sub?: unknown;
	email?: unknown;
	org_id?: unknown;
	is_email_verified?: unknown;
	membership_status?: unknown;
	roles?: unknown;
	products?: unknown;
	user_metadata?: unknown;
}

export function normalizeAuthUser(value: RawSsoUser): AuthUser {
	const roles = Array.isArray(value.roles)
		? value.roles.filter((role: unknown): role is string => typeof role === "string")
		: [];
	const products = Array.isArray(value.products)
		? value.products.filter((product: unknown): product is string => typeof product === "string")
		: [];
	const membershipStatus = value.membership_status;

	if (
		typeof value.sub !== "string" ||
		typeof value.email !== "string" ||
		typeof value.org_id !== "string" ||
		typeof value.is_email_verified !== "boolean" ||
		typeof membershipStatus !== "string"
	) {
		throw new Error("Invalid SSO user claims");
	}

	if (!isMembershipStatus(membershipStatus)) {
		throw new Error("Invalid SSO membership status");
	}

	const userMetadata =
		value.user_metadata && typeof value.user_metadata === "object" && !Array.isArray(value.user_metadata)
			? (value.user_metadata as Record<string, unknown>)
			: {};

	return {
		sub: value.sub,
		email: value.email,
		org_id: value.org_id,
		roles,
		products,
		membership_status: membershipStatus,
		is_email_verified: value.is_email_verified,
		user_metadata: userMetadata,
	};
}
