import { validateBackendEnv } from "../../../../lib/env";
import { jsonError, jsonResponse, readJsonObject } from "../../../../lib/http";
import { createServiceSupabase } from "../../../../lib/supabase";
import { syncSsoShadowData } from "../../../../lib/sync-shadow";
import type {
  AuthSuccessResponse,
  LteEnv,
  PagesContext,
  SsoExchangeResponse,
  SsoServiceBinding,
} from "../../../../lib/types";
import { triggerDailyLoginWithEngagement } from "../../../../lib/xp-engine";
import { toAuthApiUser } from "../../../../middleware/auth";
import { ssoLogger } from "../../../../shared/logger";

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
      exchange = await (context.env.SSO_SERVICE as SsoServiceBinding).exchangeAuthorizationCode({
        code,
        state,
        redirectUri,
        targetApp: "lte",
        ip: context.request.headers.get("CF-Connecting-IP") || undefined,
        ua: context.request.headers.get("User-Agent") || undefined,
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
    const cookieName = "__Host-rm-refresh";
    const attributes = "Secure; HttpOnly; Path=/; SameSite=Strict";
    const maxAge = exchange.expires_in ?? 604800;
    const cookieHeader = `${cookieName}=${exchange.refresh_token}; ${attributes}; Max-Age=${maxAge}`;
    ssoLogger.debug("Setting refresh cookie", {
      cookieName,
      url: context.request.url,
    });
    headers.set("Set-Cookie", cookieHeader);

    try {
      const supabase = createServiceSupabase(context.env);
      await syncSsoShadowData(supabase, exchange.user, exchange.subscription);
      // Fire-and-forget: award daily login + streak/consistency/legacy XP.
      // Wrapped in try/catch — never fails the auth response.
      triggerDailyLoginWithEngagement(supabase, exchange.user.sub).catch((err) => {
        ssoLogger.error("[XP] daily login engagement failed (exchange)", err, {
          userId: exchange.user.sub,
        });
      });
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
