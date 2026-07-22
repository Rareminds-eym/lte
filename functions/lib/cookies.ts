const PROD_REFRESH_COOKIE_NAME = "__Host-sso_refresh";
const LOCAL_REFRESH_COOKIE_NAME = "sso_refresh";
const REFRESH_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function getRequestRefreshCookieName(request: Request): string {
	return isLocalHttpRequest(request) ? LOCAL_REFRESH_COOKIE_NAME : PROD_REFRESH_COOKIE_NAME;
}

export function createRefreshCookie(refreshToken: string, request: Request): string {
	const name = getRequestRefreshCookieName(request);
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

export function clearRefreshCookies(): string[] {
	return [
		[`${PROD_REFRESH_COOKIE_NAME}=`, "Path=/", "HttpOnly", "Secure", "SameSite=Lax", "Max-Age=0"].join("; "),
		[`${LOCAL_REFRESH_COOKIE_NAME}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"].join("; "),
	];
}

export function getRefreshCookie(request: Request): string | null {
	return getCookie(request, getRequestRefreshCookieName(request));
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
