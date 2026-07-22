import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exchangeSsoCode, fetchMe, logoutSession, refreshSession } from "../shared/api/authApi";

describe("authApi", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("exchangeSsoCode sends POST to /api/v1/auth/sso/exchange", async () => {
    const mockResponse = {
      access_token: ["mock", "access", "token"].join("-"),
      expires_in: 900,
      user: {
        id: "user-123",
        email: "test@example.com",
        org_id: "org-123",
        roles: ["learner"],
        products: ["lte"],
        membership_status: "active" as const,
        is_email_verified: true,
        user_metadata: {},
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await exchangeSsoCode({
      code: "test-code",
      state: "test-state",
      redirectUri: "http://localhost:8789/auth/callback",
    });

    expect(globalThis.fetch).toHaveBeenCalledWith("/api/v1/auth/sso/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        code: "test-code",
        state: "test-state",
        redirectUri: "http://localhost:8789/auth/callback",
      }),
    });

    expect(result).toEqual(mockResponse);
  });

  it("refreshSession sends POST to /api/v1/auth/refresh", async () => {
    const mockResponse = {
      access_token: ["new", "access", "token"].join("-"),
      expires_in: 900,
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await refreshSession();

    expect(globalThis.fetch).toHaveBeenCalledWith("/api/v1/auth/refresh", {
      method: "POST",
      credentials: "include",
    });

    expect(result).toEqual(mockResponse);
  });

  it("fetchMe sends GET to /api/v1/auth/me with Bearer token", async () => {
    const mockResponse = {
      user: {
        id: "user-123",
        email: "test@example.com",
        org_id: "org-123",
        roles: ["learner"],
        products: ["lte"],
        membership_status: "active" as const,
        is_email_verified: true,
        user_metadata: {},
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await fetchMe("valid-token");

    expect(globalThis.fetch).toHaveBeenCalledWith("/api/v1/auth/me", {
      method: "GET",
      headers: { Authorization: "Bearer valid-token" },
      credentials: "include",
    });

    expect(result).toEqual(mockResponse);
  });

  it("logoutSession sends POST to /api/v1/auth/logout", async () => {
    const mockResponse = { success: true };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await logoutSession();

    expect(globalThis.fetch).toHaveBeenCalledWith("/api/v1/auth/logout", {
      method: "POST",
      credentials: "include",
    });

    expect(result).toEqual(mockResponse);
  });

  it("throws error message on failed HTTP response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: "Unauthorized",
      json: async () => ({ error: "Invalid token" }),
    } as Response);

    await expect(fetchMe("invalid-token")).rejects.toThrow("Invalid token");
  });
});
