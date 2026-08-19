import { jsonError } from "@functions/lib/http";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { createAuth, type SsoServiceBinding } from "@rareminds-eym/auth-core";

const ASSET_PATH_PATTERN = /\.[a-z0-9]{2,5}$/i;

let _authInstance: ReturnType<typeof createAuth> | null = null;

export const onRequest = async ({ request, env }: PagesContext<LteEnv>) => {
  const url = new URL(request.url);
  const { pathname } = url;

  // Delegate browser auth routes to Auth Core
  if (
    env.SSO_SERVICE &&
    (pathname.startsWith("/api/auth/") || pathname.startsWith("/api/v1/auth/"))
  ) {
    try {
      if (!_authInstance) {
        _authInstance = createAuth({
          sso: env.SSO_SERVICE as SsoServiceBinding,
          issuer: "sso-api",
          audience: "sso-client",
          approvedOrigins: [
            "https://lte.rareminds.in",
            "http://localhost:8080",
            "http://localhost:8789",
            "http://127.0.0.1:8080",
            "http://127.0.0.1:8789",
          ],
          csrf: { name: "X-RM-CSRF", value: "1" },
          cookieMaxAgeSeconds: 604800,
          ssoRequestTimeoutMs: 5000,
        });
      }
      const handled = await _authInstance.handleBrowserRequest(request);
      if (handled) return handled;
    } catch {
      // Fall through to 404 if dispatch fails
    }
  }

  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return jsonError("Not Found", 404);
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Not Found", { status: 404 });
  }

  const asset = await env.ASSETS.fetch(request);
  if (asset.status !== 404) return asset;

  if (ASSET_PATH_PATTERN.test(pathname)) return asset;

  return env.ASSETS.fetch(new URL("/index.html", url));
};
