import type { LteEnv, SsoExchangeResponse } from "./types";

export function getSsoService(env: Pick<LteEnv, "SSO_SERVICE">) {
  if (!env.SSO_SERVICE) {
    const err = new Error("SSO_SERVICE binding is not configured.");
    err.name = "ConfigError";
    throw err;
  }

  // Verify it's actually a service binding object
  if (typeof env.SSO_SERVICE !== "object") {
    const err = new Error(
      `SSO_SERVICE is not a valid service binding. Got type: ${typeof env.SSO_SERVICE}`,
    );
    err.name = "ConfigError";
    throw err;
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

export async function changeSsoPassword(
  env: Pick<LteEnv, "SSO_SERVICE">,
  params: {
    current_password: string;
    new_password: string;
    access_token: string;
    ip?: string | null;
    ua?: string | null;
  },
): Promise<{ success: boolean; message?: string }> {
  return getSsoService(env).changePassword({
    current_password: params.current_password,
    new_password: params.new_password,
    access_token: params.access_token,
    ip: params.ip ?? undefined,
    ua: params.ua ?? undefined,
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
    ) => Promise<{
      success?: boolean;
      access_token?: string;
      refresh_token?: string;
      error?: string;
    }>;
    refreshSession: (
      refreshToken: string,
      ip?: string,
      ua?: string,
    ) => Promise<{ access_token: string; refresh_token: string }>;
  };
  try {
    if (typeof service.authenticateSharedSession === "function") {
      const res = await service.authenticateSharedSession(
        refreshToken,
        "lte",
        ip ?? undefined,
        ua ?? undefined,
      );
      if (!res?.success || !res?.access_token) {
        throw new SsoAuthError(res?.error || "Invalid or revoked session");
      }
      return { access_token: res.access_token, refresh_token: res.refresh_token || refreshToken };
    }
    return await service.refreshSession(refreshToken, ip ?? undefined, ua ?? undefined);
  } catch (error) {
    if (error instanceof SsoAuthError) {
      throw error;
    }
    const msg = error instanceof Error ? error.message : String(error);
    const isSessionInvalid =
      msg.includes("Session not found") ||
      msg.includes("Session expired") ||
      msg.includes("Invalid refresh token") ||
      msg.includes("revoked") ||
      msg.includes("expired") ||
      msg.includes("Invalid or revoked session") ||
      msg.includes("invalid_grant") ||
      msg.includes("Unauthenticated");

    if (isSessionInvalid) {
      throw new SsoAuthError(msg);
    }
    throw error;
  }
}

export async function logoutLteSession(
  env: Pick<LteEnv, "SSO_SERVICE">,
  refreshToken: string,
  ip?: string | null,
  ua?: string | null,
): Promise<{ success: boolean }> {
  return getSsoService(env).logoutSession(refreshToken, ip ?? undefined, ua ?? undefined);
}

export class SsoAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsoAuthError";
  }
}
