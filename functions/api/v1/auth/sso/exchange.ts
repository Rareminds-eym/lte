import { toAuthApiUser } from "@functions/lib/auth";
import { createRefreshCookie } from "@functions/lib/cookies";
import { validateBackendEnv } from "@functions/lib/env";
import {
  getClientIp,
  getUserAgent,
  jsonError,
  jsonResponse,
  readJsonObject,
} from "@functions/lib/http";
import { ssoLogger } from "@functions/lib/logger";
import { exchangeAuthorizationCode } from "@functions/lib/sso-client";
import { createServiceSupabase } from "@functions/lib/supabase";
import { syncSsoShadowData } from "@functions/lib/sync-shadow";
import type {
  AuthSuccessResponse,
  LteEnv,
  PagesContext,
  SsoExchangeResponse,
} from "@functions/lib/types";

function getStringField(body: Record<string, unknown>, field: string): string | null {
  const value = body[field];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function onRequestPost(context: PagesContext<LteEnv>): Promise<Response> {
  try {
    validateBackendEnv(context.env);
    ssoLogger.debug("SSO_SERVICE binding available");

    const body = await readJsonObject(context.request);
    const code = getStringField(body, "code");
    const state = getStringField(body, "state");
    const redirectUri = getStringField(body, "redirectUri");

    if (!code || !state || !redirectUri) {
      return jsonError("code, state, and redirectUri are required", 400);
    }

    ssoLogger.info("Exchanging authorization code for tokens...");

    let exchange: SsoExchangeResponse;
    try {
      exchange = await exchangeAuthorizationCode(context.env, {
        code,
        state,
        redirectUri,
        ip: getClientIp(context.request),
        ua: getUserAgent(context.request),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "SSO exchange failed";
      ssoLogger.error("SSO exchange failed", err instanceof Error ? err : new Error(message));
      return jsonError(message, 401);
    }

    ssoLogger.info("Exchange successful", { userId: exchange.user.sub });

    if (!exchange.user.products.includes("lte")) {
      return jsonError("LTE access is required", 403);
    }

    const headers = new Headers();
    const cookieHeader = createRefreshCookie(exchange.refresh_token, context.request, context.env);
    ssoLogger.debug("Setting refresh cookie", {
      cookieName: cookieHeader.split("=")[0],
      url: context.request.url,
    });
    headers.set("Set-Cookie", cookieHeader);

    try {
      const supabase = createServiceSupabase(context.env);
      await syncSsoShadowData(supabase, exchange.user, exchange.subscription);
    } catch (err) {
      const message = err instanceof Error ? err.message : "SSO shadow sync failed";
      ssoLogger.error("SSO shadow sync failed", err instanceof Error ? err : new Error(message));
      return jsonError("Internal server error during authentication sync", 500);
    }

    return jsonResponse<AuthSuccessResponse>(
      {
        access_token: exchange.access_token,
        user: toAuthApiUser(exchange.user),
        expires_in: exchange.expires_in ?? 900,
      },
      { headers },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    ssoLogger.error(
      "SSO request processing failed",
      error instanceof Error ? error : new Error(message),
    );
    return jsonError(message, 500);
  }
}
