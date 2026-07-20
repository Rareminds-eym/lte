import type { LteEnv } from "./types";

const DEFAULT_REFRESH_COOKIE_NAME = "__Host-lte_refresh";
const LOCAL_REFRESH_COOKIE_NAME = "lte_refresh";
const REFRESH_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function getRefreshCookieName(env: Pick<LteEnv, "REFRESH_COOKIE_NAME">): string {
	return env.REFRESH_COOKIE_NAME || DEFAULT_REFRESH_COOKIE_NAME;
}

export function getRequestRefreshCookieName(request: Request, env: Pick<LteEnv, "REFRESH_COOKIE_NAME">): string {
	return isLocalHttpRequest(request) ? LOCAL_REFRESH_COOKIE_NAME : getRefreshCookieName(env);
}

export function createRefreshCookie(
	refreshToken: string,
	env: Pick<LteEnv, "REFRESH_COOKIE_NAME">,
	request: Request,
): string {
	const name = getRequestRefreshCookieName(request, env);
	const parts = [
		`${name}=${refreshToken}`,
		"Path=/",
		"HttpOnly",
		"SameSite=Lax",
		`Max-Age=${REFRESH_MAX_AGE_SECONDS}`,
	];

	if (!isLocalHttpRequest(request)) {
		parts.splice(3, 0, "Secure");
	}

	return parts.join("; ");
}

export function clearRefreshCookies(env: Pick<LteEnv, "REFRESH_COOKIE_NAME">): string[] {
	return [
		[`${getRefreshCookieName(env)}=`, "Path=/", "HttpOnly", "Secure", "SameSite=Lax", "Max-Age=0"].join("; "),
		[`${LOCAL_REFRESH_COOKIE_NAME}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"].join("; "),
	];
}

export function getRefreshCookie(request: Request, env: Pick<LteEnv, "REFRESH_COOKIE_NAME">): string | null {
	return getCookie(request, getRequestRefreshCookieName(request, env)) ?? getCookie(request, getRefreshCookieName(env));
}

export function getCookie(request: Request, name: string): string | null {
	const cookieHeader = request.headers.get("Cookie");
	if (!cookieHeader) return null;

	for (const part of cookieHeader.split(";")) {
		const [rawKey, ...rawValueParts] = part.trim().split("=");
		if (rawKey === name) {
			const rawValue = rawValueParts.join("=");
			return rawValue ? decodeURIComponent(rawValue) : "";
		}
	}

	return null;
}

function isLocalHttpRequest(request: Request): boolean {
	const url = new URL(request.url);
	return url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
}
