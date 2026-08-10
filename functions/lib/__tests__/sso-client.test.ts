import type { LteEnv } from "@functions/lib/types";
import { describe, expect, it, vi } from "vitest";
import {
  changeSsoPassword,
  exchangeAuthorizationCode,
  getSsoService,
  logoutLteSession,
  refreshLteSession,
  SsoAuthError,
} from "../sso-client";

function envWith(service: unknown) {
  return { SSO_SERVICE: service } as LteEnv;
}

describe("getSsoService", () => {
  it("throws ConfigError when the binding is missing", () => {
    expect(() => getSsoService({} as LteEnv)).toThrowError(/not configured/);
    try {
      getSsoService({} as LteEnv);
    } catch (err) {
      expect((err as Error).name).toBe("ConfigError");
    }
  });

  it("throws ConfigError when the binding is not an object", () => {
    expect(() => getSsoService(envWith("https://sso.example.com"))).toThrowError(
      /not a valid service binding/,
    );
  });

  it("returns the service binding", () => {
    const service = {};
    expect(getSsoService(envWith(service))).toBe(service);
  });
});

describe("exchangeAuthorizationCode", () => {
  it("forwards params with the lte target app", async () => {
    const mockExchangeAuthorizationCode = vi.fn().mockResolvedValue({ success: true });
    await exchangeAuthorizationCode(
      envWith({ exchangeAuthorizationCode: mockExchangeAuthorizationCode }),
      {
        code: "code-1",
        state: "state-1",
        redirectUri: "http://localhost/callback",
      },
    );
    expect(mockExchangeAuthorizationCode).toHaveBeenCalledWith({
      code: "code-1",
      state: "state-1",
      redirectUri: "http://localhost/callback",
      targetApp: "lte",
    });
  });
});

describe("changeSsoPassword", () => {
  it("forwards params and maps null ip/ua to undefined", async () => {
    const changePassword = vi.fn().mockResolvedValue({ success: true });
    const result = await changeSsoPassword(envWith({ changePassword }), {
      current_password: "old",
      new_password: "newpass123",
      access_token: "tok",
      ip: null,
      ua: null,
    });
    expect(result).toEqual({ success: true });
    expect(changePassword).toHaveBeenCalledWith({
      current_password: "old",
      new_password: "newpass123",
      access_token: "tok",
      ip: undefined,
      ua: undefined,
    });
  });
});

describe("refreshLteSession", () => {
  it("uses authenticateSharedSession when available", async () => {
    const authenticateSharedSession = vi.fn().mockResolvedValue({
      success: true,
      access_token: "new-access",
      refresh_token: "new-refresh",
    });
    const result = await refreshLteSession(envWith({ authenticateSharedSession }), "refresh-tok");
    expect(result).toEqual({ access_token: "new-access", refresh_token: "new-refresh" });
    expect(authenticateSharedSession).toHaveBeenCalledWith(
      "refresh-tok",
      "lte",
      undefined,
      undefined,
    );
  });

  it("throws SsoAuthError when authenticateSharedSession fails", async () => {
    const authenticateSharedSession = vi.fn().mockResolvedValue({
      success: false,
      error: "Invalid or revoked session",
    });
    await expect(
      refreshLteSession(envWith({ authenticateSharedSession }), "refresh-tok"),
    ).rejects.toThrow(SsoAuthError);
  });

  it("falls back to refreshSession when authenticateSharedSession is missing", async () => {
    const refreshSession = vi.fn().mockResolvedValue({ access_token: "a", refresh_token: "r" });
    const result = await refreshLteSession(
      envWith({ refreshSession }),
      "refresh-tok",
      "1.2.3.4",
      "UA",
    );
    expect(result).toEqual({ access_token: "a", refresh_token: "r" });
    expect(refreshSession).toHaveBeenCalledWith("refresh-tok", "1.2.3.4", "UA");
  });

  it("maps session-invalid errors to SsoAuthError", async () => {
    const refreshSession = vi.fn().mockRejectedValue(new Error("Session expired"));
    await expect(refreshLteSession(envWith({ refreshSession }), "refresh-tok")).rejects.toThrow(
      SsoAuthError,
    );
  });

  it("rethrows unrelated errors as-is", async () => {
    const networkError = new Error("network down");
    const refreshSession = vi.fn().mockRejectedValue(networkError);
    await expect(refreshLteSession(envWith({ refreshSession }), "refresh-tok")).rejects.toBe(
      networkError,
    );
  });
});

describe("logoutLteSession", () => {
  it("calls logoutSession on the service", async () => {
    const logoutSession = vi.fn().mockResolvedValue({ success: true });
    const result = await logoutLteSession(envWith({ logoutSession }), "refresh-tok");
    expect(result).toEqual({ success: true });
    expect(logoutSession).toHaveBeenCalledWith("refresh-tok", undefined, undefined);
  });
});
