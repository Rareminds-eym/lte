import { jsonError } from "@functions/lib/http";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { apiLogger } from "@functions/shared/logger";
import { createSsoGateway } from "@rareminds-eym/sso-gateway";

const ASSET_PATH_PATTERN = /\.[a-z0-9]{2,5}$/i;

export const onRequest = async ({ request, env }: PagesContext<LteEnv>) => {
  const url = new URL(request.url);
  const { pathname } = url;

  // Delegate browser auth routes to SSO Gateway
  if (
    env.SSO_SERVICE &&
    (pathname.startsWith("/api/auth/") || pathname.startsWith("/api/v1/auth/")) &&
    pathname !== "/api/v1/auth/sso/exchange"
  ) {
    try {
      const gateway = createSsoGateway({
        sso: env.SSO_SERVICE as unknown as Parameters<typeof createSsoGateway>[0]["sso"],
        issuer: "sso-api",
        audience: "sso-client",
        approvedOrigins: [
          "https://lte.rareminds.in",
          "http://localhost:8080",
          "http://localhost:8789",
          "http://127.0.0.1:8080",
          "http://127.0.0.1:8789",
          "http://localhost",
          "http://127.0.0.1",
        ],
        csrf: { name: "X-RM-CSRF", value: "1" },
        cookieMaxAgeSeconds: 604800,
        ssoRequestTimeoutMs: 5000,
      });
      const handled = await gateway.handleBrowserRequest(request);
      if (handled) return handled;
    } catch (error) {
      apiLogger.error("SSO Gateway request dispatch failed", error, { pathname });
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
