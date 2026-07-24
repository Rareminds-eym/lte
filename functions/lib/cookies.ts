const PROD_REFRESH_COOKIE_NAME = "__Secure-refresh_token";
const LOCAL_REFRESH_COOKIE_NAME = "refresh_token";
const REFRESH_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function getCookieDomain(request: Request, env?: { COOKIE_DOMAIN?: string }): string | null {
  if (env?.COOKIE_DOMAIN) return env.COOKIE_DOMAIN;
  if (isLocalHttpRequest(request)) return null;

  try {
    const hostname = new URL(request.url).hostname;
    const parts = hostname.split(".");
    if (parts.length >= 2) {
      return `.${parts.slice(-2).join(".")}`;
    }
  } catch {
    // fallback if parsing fails
  }

  return null;
}

export function getRequestRefreshCookieName(request: Request): string {
  return isLocalHttpRequest(request) ? LOCAL_REFRESH_COOKIE_NAME : PROD_REFRESH_COOKIE_NAME;
}

export function createRefreshCookie(
  refreshToken: string,
  request: Request,
  env?: { COOKIE_DOMAIN?: string },
): string {
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
    const domain = getCookieDomain(request, env);
    if (domain) {
      parts.push(`Domain=${domain}`);
    }
  }

  return parts.join("; ");
}

const REFRESH_COOKIE_CANDIDATES = [
  "__Secure-refresh_token",
  "refresh_token",
  "__Host-refresh_token",
  "__Host-sso_refresh",
  "sso_refresh",
] as const;

export function clearRefreshCookies(env?: { COOKIE_DOMAIN?: string }): string[] {
  const domainAttr = env?.COOKIE_DOMAIN ? `; Domain=${env.COOKIE_DOMAIN}` : "";
  return REFRESH_COOKIE_CANDIDATES.map((name) => {
    const secure = name.startsWith("__") ? "; Secure" : "";
    const dom = name.startsWith("__Secure-") ? domainAttr : "";
    return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}${dom}`;
  });
}

export function getRefreshCookie(request: Request): string | null {
  for (const candidate of REFRESH_COOKIE_CANDIDATES) {
    const val = getCookie(request, candidate);
    if (val) return val;
  }

  return null;
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
